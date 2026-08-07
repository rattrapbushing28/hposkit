/**
 * Auto-patching engine — TypeScript port of the PHP patcher logic.
 * Applies automated fixes for detected HPOS issues.
 */

import type { Issue, ScannedFile } from "./scanner";
import { isIndexInsideStringOrComment } from "./protection";

export interface PatchResult {
  file: string;
  originalContent: string;
  patchedContent: string;
  diff: string;
  applied: boolean;
  error?: string;
}

/**
 * Find the matching closing parenthesis for an opening paren at position `start`.
 * Handles nested parens, strings (single/double quoted), and comments.
 * Returns the index of the matching `)`, or -1 if not found.
 */
function findMatchingParen(content: string, start: number): number {
  let depth = 0;
  let i = start;
  let state: "code" | "single" | "double" | "block" | "line" = "code";
  const len = content.length;

  while (i < len) {
    const ch = content[i];
    const next = i + 1 < len ? content[i + 1] : "";

    if (state === "code") {
      if (ch === "'") { state = "single"; i++; continue; }
      if (ch === '"') { state = "double"; i++; continue; }
      if (ch === "/" && next === "*") { state = "block"; i += 2; continue; }
      if (ch === "/" && next === "/") { state = "line"; i += 2; continue; }
      if (ch === "#") { state = "line"; i++; continue; }
      if (ch === "(") { depth++; i++; continue; }
      if (ch === ")") {
        depth--;
        if (depth === 0) return i;
        i++; continue;
      }
      i++; continue;
    }

    if (state === "single") {
      if (ch === "\\") { i += 2; continue; }
      if (ch === "'") { state = "code"; i++; continue; }
      i++; continue;
    }

    if (state === "double") {
      if (ch === "\\") { i += 2; continue; }
      if (ch === '"') { state = "code"; i++; continue; }
      i++; continue;
    }

    if (state === "block") {
      if (ch === "*" && next === "/") { state = "code"; i += 2; continue; }
      i++; continue;
    }

    if (state === "line") {
      if (ch === "\n" || ch === "\r") { state = "code"; i++; continue; }
      i++; continue;
    }
  }

  return -1;
}

/**
 * Split a function's argument string (content between outer parens) into
 * individual arguments, respecting nested parens, strings, and comments.
 */
function splitArguments(argsStr: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = "";
  let state: "code" | "single" | "double" | "block" | "line" = "code";
  const len = argsStr.length;

  for (let i = 0; i < len; i++) {
    const ch = argsStr[i];
    const next = i + 1 < len ? argsStr[i + 1] : "";

    if (state === "code") {
      if (ch === "'") { state = "single"; current += ch; continue; }
      if (ch === '"') { state = "double"; current += ch; continue; }
      if (ch === "/" && next === "*") { state = "block"; current += ch + next; i++; continue; }
      if (ch === "/" && next === "/") { state = "line"; current += ch + next; i++; continue; }
      if (ch === "#") { state = "line"; current += ch; continue; }
      if (ch === "(") { depth++; current += ch; continue; }
      if (ch === ")") { depth--; current += ch; continue; }
      if (ch === "," && depth === 0) {
        args.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
      continue;
    }

    if (state === "single") {
      current += ch;
      if (ch === "\\") { current += next; i++; continue; }
      if (ch === "'") { state = "code"; continue; }
      continue;
    }

    if (state === "double") {
      current += ch;
      if (ch === "\\") { current += next; i++; continue; }
      if (ch === '"') { state = "code"; continue; }
      continue;
    }

    if (state === "block") {
      current += ch;
      if (ch === "*" && next === "/") { current += next; state = "code"; i++; continue; }
      continue;
    }

    if (state === "line") {
      current += ch;
      if (ch === "\n" || ch === "\r") { state = "code"; continue; }
      continue;
    }
  }

  if (current.trim()) args.push(current.trim());
  return args;
}

interface FunctionCallMatch {
  fullMatch: string;
  startIndex: number;
  endIndex: number; // index after the closing )
  args: string[];
}

/**
 * Find all calls to a named PHP function in content, using balanced paren matching.
 * Only matches in code context (not inside strings/comments).
 * Returns matches with their parsed arguments.
 */
function findFunctionCalls(content: string, funcName: string): FunctionCallMatch[] {
  const results: FunctionCallMatch[] = [];
  // Match function name followed by optional whitespace and opening paren
  const namePattern = new RegExp(`\\b${funcName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(`, "gi");
  let m: RegExpExecArray | null;

  while ((m = namePattern.exec(content)) !== null) {
    const callStart = m.index;

    // Skip if inside string or comment
    if (isIndexInsideStringOrComment(content, callStart)) continue;

    // Find the opening paren position
    const parenStart = callStart + m[0].length - 1; // position of (
    const parenEnd = findMatchingParen(content, parenStart);

    if (parenEnd === -1) continue;

    // Extract arguments between parens
    const argsStr = content.slice(parenStart + 1, parenEnd);
    const args = splitArguments(argsStr);

    results.push({
      fullMatch: content.slice(callStart, parenEnd + 1),
      startIndex: callStart,
      endIndex: parenEnd + 1,
      args,
    });
  }

  return results;
}

/**
 * Check if a match is in standalone statement context (followed by ; or newline/EOF).
 */
function isStatementContext(content: string, afterIndex: number): boolean {
  const restSlice = content.slice(afterIndex);
  return /^\s*;/.test(restSlice) ||
         /^\s*(\/\/|\/\*|\#|\r|\n|$)/.test(restSlice);
}

/**
 * Check if the first argument is an order-related variable ($order_id, $order, $post_id, $postid, $id).
 */
function isOrderVar(arg: string): string | null {
  const m = /^\$(order_id|order|post_id|postid|id)\b/.exec(arg.trim());
  return m ? m[1] : null;
}

/**
 * Generic meta function patcher using balanced paren parsing.
 * Handles multi-line calls, nested parens in values, and variable keys.
 */
function patchMetaFunction(
  content: string,
  funcName: string,
  buildReplacement: (variable: string, args: string[], originalMatch: string) => string | null
): string {
  const calls = findFunctionCalls(content, funcName);
  if (calls.length === 0) return content;

  let result = "";
  let lastIndex = 0;

  for (const call of calls) {
    // Must be in statement context
    if (!isStatementContext(content, call.endIndex)) continue;

    // First argument must be an order variable
    if (call.args.length < 2) continue;
    const varName = isOrderVar(call.args[0]);
    if (!varName) continue;

    const replacement = buildReplacement(varName, call.args, call.fullMatch);
    if (replacement === null) continue;

    result += content.slice(lastIndex, call.startIndex);

    // Preserve trailing semicolon
    const afterMatch = content.slice(call.endIndex);
    const semicolonMatch = /^\s*;/.exec(afterMatch);
    let repl = replacement;
    if (semicolonMatch && !/;\s*$/.test(repl)) {
      repl = repl + ";";
    }

    result += repl;
    lastIndex = call.endIndex;
    // Skip past the semicolon if we consumed it
    if (semicolonMatch) {
      lastIndex = call.endIndex + semicolonMatch[0].length;
    }
  }

  result += content.slice(lastIndex);
  return result;
}

/**
 * Helper: perform replacements only for matches that are not inside strings/comments.
 * replacementFn receives (match, ...groups, matchIndex, fullString) and should
 * return the replacement string for that match.
 */
function safeReplace(content: string, pattern: RegExp, replacementFn: (...args: any[]) => string): string {
  let out = "";
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  // Ensure global flag
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  while ((m = re.exec(content)) !== null) {
    const idx = m.index;
    const matchText = m[0];

    // If the start is inside a string or comment, skip this match
    if (isIndexInsideStringOrComment(content, idx)) {
      continue;
    }

    // Determine whether this match is used as a standalone statement.
    // We consider it a statement if, immediately after the match, we have:
    //  - a semicolon ; OR
    //  - only whitespace then a semicolon or end-of-line/comment
    const afterIndex = idx + matchText.length;
    const restSlice = content.slice(afterIndex);
    const isStatement =
      /^\s*;/.test(restSlice) || // semicolon after optional whitespace
      /^\s*(\/\/|\/\*|\#|\r|\n|$)/.test(restSlice); // followed by comment/newline or EOF

    // If this is not a statement context, skip auto-patch to avoid injecting
    // multiple statements into an expression or argument list.
    if (!isStatement) {
      continue;
    }

    out += content.slice(lastIndex, idx);
    let repl = replacementFn(...m, idx, content);
    // Preserve trailing semicolon from original match if present
    if (/;\s*$/.test(matchText) && !/;\s*$/.test(repl)) {
      repl = repl + ";";
    }
    out += repl;
    lastIndex = idx + matchText.length;
  }
  out += content.slice(lastIndex);
  return out;
}

/**
 * Apply a single patch to a file's content.
 */
export function applyPatch(content: string, issue: Issue): string | null {
  switch (issue.type) {
    case "get_post":
      return patchGetPost(content);
    case "get_post_meta":
      return patchGetPostMeta(content);
    case "add_post_meta":
      return patchAddPostMeta(content);
    case "update_post_meta":
      return patchUpdatePostMeta(content);
    case "delete_post_meta":
      return patchDeletePostMeta(content);
    case "wp_query_orders":
      return patchWpQueryOrders(content);
    case "get_posts_orders":
      return patchGetPostsOrders(content);
    case "missing_compat_declaration":
      return patchMissingDeclaration(content);
    case "missing_wc_header":
      return patchMissingHeader(content, issue);
    default:
      return null;
  }
}

function patchGetPost(content: string): string {
  // Replace get_post( $id ) with wc_get_order( $id ) only when in code context.
  const pattern = /get_post\s*\(\s*\$(order_id|order|post_id|postid|id)\b[^)]*\)/gi;
  return safeReplace(content, pattern, (_match: string, variable: string) => {
    return `wc_get_order( $${variable} )`;
  });
}

function patchGetPostMeta(content: string): string {
  return patchMetaFunction(content, "get_post_meta", (variable, args) => {
    // get_post_meta( $order_id, $key, $single )
    if (args.length < 2) return null;
    const key = args[1].trim();
    const single = args[2] ? args[2].trim() : "";
    const singleArg = single && (single === "true" || single === "false") ? `, ${single}` : "";
    return `wc_get_order( $${variable} )->get_meta( ${key}${singleArg} )`;
  });
}

function patchAddPostMeta(content: string): string {
  return patchMetaFunction(content, "add_post_meta", (variable, args) => {
    // add_post_meta( $order_id, $key, $value, $unique )
    if (args.length < 3) return null;
    const key = args[1].trim();
    const value = args[2].trim();
    return `$order = wc_get_order( $${variable} ); $order->add_meta_data( ${key}, ${value} ); $order->save();`;
  });
}

function patchUpdatePostMeta(content: string): string {
  return patchMetaFunction(content, "update_post_meta", (variable, args) => {
    // update_post_meta( $order_id, $key, $value, $prev_value )
    if (args.length < 3) return null;
    const key = args[1].trim();
    const value = args[2].trim();
    return `$order = wc_get_order( $${variable} ); $order->update_meta_data( ${key}, ${value} ); $order->save();`;
  });
}

function patchDeletePostMeta(content: string): string {
  return patchMetaFunction(content, "delete_post_meta", (variable, args) => {
    // delete_post_meta( $order_id, $key, $value )
    if (args.length < 2) return null;
    const key = args[1].trim();
    return `$order = wc_get_order( $${variable} ); $order->delete_meta_data( ${key} ); $order->save();`;
  });
}

function patchWpQueryOrders(content: string): string {
  const pattern = /new\s+WP_Query\s*\(\s*(\[\s*(?:[^\]]*?)post_type['"]\s*=>\s*['"]shop_order['"][^\]]*\]|\s*array\s*\(\s*(?:[^)]*?)post_type['"]\s*=>\s*['"]shop_order['"][^)]*\))\s*\)/gi;
  return safeReplace(content, pattern, (_match: string, args: string) => {
    const cleaned = args.replace(/['"]post_type['"]\s*=>\s*['"]shop_order['"]\s*,?\s*/i, "").trim().replace(/^[,\s]+|[,\s]+$/g, "");
    return `wc_get_orders( ${cleaned} )`;
  });
}

function patchGetPostsOrders(content: string): string {
  const pattern = /get_posts\s*\(\s*(\[\s*(?:[^\]]*?)post_type['"]\s*=>\s*['"]shop_order['"][^\]]*\]|\s*array\s*\(\s*(?:[^)]*?)post_type['"]\s*=>\s*['"]shop_order['"][^)]*\))\s*\)/gi;
  return safeReplace(content, pattern, (_match: string, args: string) => {
    const cleaned = args.replace(/['"]post_type['"]\s*=>\s*['"]shop_order['"]\s*,?\s*/i, "").trim().replace(/^[,\s]+|[,\s]+$/g, "");
    return `wc_get_orders( ${cleaned} )`;
  });
}

function patchMissingDeclaration(content: string): string {
  // Insert a valid declare_compatibility snippet.
  const declaration = `\n\n// Declare HPOS compatibility.\nadd_action( 'before_woocommerce_init', function() {\n    if ( class_exists( '\\Automattic\\WooCommerce\\Utilities\\FeaturesUtil' ) ) {\n        \\Automattic\\WooCommerce\\Utilities\\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__ );\n    }\n});\n\n`;

  // Prefer to insert directly after the plugin header block if present (search top of file).
  const topSegment = content.slice(0, 2000);
  const headerRegex = /\/\*\s*[\s\S]*?Plugin Name:\s*[\s\S]*?\*\/\s*/im;
  const headerMatch = headerRegex.exec(topSegment);
  if (headerMatch && headerMatch.index !== undefined) {
    const headerEnd = headerMatch.index + headerMatch[0].length;
    return content.substring(0, headerEnd) + declaration + content.substring(headerEnd);
  }

  // If file starts with <?php, insert after it.
  const phpOpen = /^\s*<\?php[ \t]*\r?\n?/i;
  if (phpOpen.test(content)) {
    return content.replace(phpOpen, (m) => m + declaration);
  }

  // Last resort: prepend a <?php wrapper with the declaration to keep the file valid.
  return "<?php\n" + declaration + "\n" + content;
}

function patchMissingHeader(content: string, issue: Issue): string {
  const hasWcTested = /\*\s*WC tested up to:\s*([0-9.]+)/i.test(content);
  const hasRequires = /\*\s*Requires Plugins:\s*woocommerce/i.test(content);

  const insertions: string[] = [];
  if (!hasRequires) {
    insertions.push(" * Requires Plugins: woocommerce");
  }
  if (!hasWcTested) {
    insertions.push(" * WC tested up to: 9.4");
  }

  if (insertions.length === 0) return content;

  // Attempt to find the plugin header block and insert before its closing */ (only search top of file)
  const topSegment = content.slice(0, 2000);
  const pluginHeaderMatch = /\/\*\s*[\s\S]*?Plugin Name:\s*[\s\S]*?\*\//im.exec(topSegment);
  if (pluginHeaderMatch && pluginHeaderMatch.index !== undefined) {
    const headerStart = pluginHeaderMatch.index;
    const header = pluginHeaderMatch[0];
    const headerEnd = headerStart + header.length;
    const closingIndex = header.lastIndexOf("*/");
    if (closingIndex !== -1) {
      const insertPos = headerStart + closingIndex;
      const insert = "\n" + insertions.join("\n") + "\n";
      return content.substring(0, insertPos) + insert + content.substring(insertPos);
    }
  }

  // Fallback: add header at top
  const headerBlock = `/*\n${insertions.join("\n")}\n*/\n`;
  return headerBlock + content;
}

/**
 * Generate a unified diff between original and patched content.
 */
export function computeDiff(original: string, patched: string, filename: string): string {
  const origLines = original.split("\n");
  const newLines = patched.split("\n");
  const diff: string[] = [`--- a/${filename}`, `+++ b/${filename}`];

  const max = Math.max(origLines.length, newLines.length);
  for (let i = 0; i < max; i++) {
    const orig = origLines[i] ?? null;
    const next = newLines[i] ?? null;
    if (orig === next) continue;
    if (orig !== null && orig !== next) {
      diff.push(`-${orig}`);
    }
    if (next !== null && orig !== next) {
      diff.push(`+${next}`);
    }
  }
  return diff.join("\n");
}

/**
 * Patch all issues across all files. Returns patched files and per-issue results.
 */
export function patchAllIssues(
  files: ScannedFile[],
  issues: Issue[]
): { patchedFiles: ScannedFile[]; results: PatchResult[] } {
  // Group issues by file.
  const issuesByFile = new Map<string, Issue[]>();
  for (const issue of issues) {
    if (!issue.patchable) continue;
    const existing = issuesByFile.get(issue.file) || [];
    existing.push(issue);
    issuesByFile.set(issue.file, existing);
  }

  const patchedFiles: ScannedFile[] = [];
  const results: PatchResult[] = [];

  for (const file of files) {
    let content = file.content;
    const fileIssues = issuesByFile.get(file.path) || [];

    if (fileIssues.length > 0) {
      const original = content;
      try {
        for (const issue of fileIssues) {
          const patched = applyPatch(content, issue);
          if (patched !== null && patched !== content) {
            content = patched;
          }
        }

        if (content !== original) {
          const diff = computeDiff(original, content, file.path);
          results.push({
            file: file.path,
            originalContent: original,
            patchedContent: content,
            diff,
            applied: true,
          });
          patchedFiles.push({ path: file.path, content });
        } else {
          // No changes but file had patchable issues that couldn't be auto-applied
          results.push({
            file: file.path,
            originalContent: original,
            patchedContent: original,
            diff: "",
            applied: false,
            error: "No safe auto-patch applied; manual review required.",
          });
          patchedFiles.push(file);
        }
      } catch (err: any) {
        results.push({
          file: file.path,
          originalContent: content,
          patchedContent: content,
          diff: "",
          applied: false,
          error: err instanceof Error ? err.message : String(err),
        });
        patchedFiles.push(file);
      }
    } else {
      patchedFiles.push(file);
    }
  }

  return { patchedFiles, results };
}
