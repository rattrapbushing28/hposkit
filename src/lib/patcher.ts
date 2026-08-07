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
    // If the start is inside a string or comment, skip this match
    if (isIndexInsideStringOrComment(content, idx)) {
      // advance lastIndex and continue without replacing
      continue;
    }
    out += content.slice(lastIndex, idx);
    const repl = replacementFn(...m, idx, content);
    out += repl;
    lastIndex = idx + m[0].length;
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
  const pattern = /get_post_meta\s*\(\s*\$(order_id|order|post_id|postid|id)\s*,\s*(['"][^'"]+['"])\s*(?:,\s*(true|false)\s*)?\)\s*;?/gi;
  return safeReplace(content, pattern, (_match: string, variable: string, key: string, single?: string) => {
    // Ensure we only patch full statements (ending with semicolon) to avoid expression context issues
    return `wc_get_order( $${variable} )->get_meta( ${key}${single ? ', ' + single : ''} )`;
  });
}

function patchAddPostMeta(content: string): string {
  // Only patch standalone statements where arguments are simple (no nested parentheses)
  const pattern = /add_post_meta\s*\(\s*\$(order_id|order|post_id|postid|id)\s*,\s*(['"][^'"]+['"])\s*,\s*([^;\n\)]+)\)\s*;?/gi;
  return safeReplace(content, pattern, (_match: string, variable: string, key: string, value: string) => {
    const trimmedValue = value.trim();
    // If value contains parentheses which may indicate a complex expression, skip auto-patch
    if (/\(|\[|\{/.test(trimmedValue)) return _match;
    return `$order = wc_get_order( $${variable} ); $order->add_meta_data( ${key}, ${trimmedValue} ); $order->save();`;
  });
}

function patchUpdatePostMeta(content: string): string {
  const pattern = /update_post_meta\s*\(\s*\$(order_id|order|post_id|postid|id)\s*,\s*(['"][^'"]+['"])\s*,\s*([^;\n\)]+)\)\s*;?/gi;
  return safeReplace(content, pattern, (_match: string, variable: string, key: string, value: string) => {
    const trimmedValue = value.trim();
    if (/\(|\[|\{/.test(trimmedValue)) return _match;
    return `$order = wc_get_order( $${variable} ); $order->update_meta_data( ${key}, ${trimmedValue} ); $order->save();`;
  });
}

function patchDeletePostMeta(content: string): string {
  const pattern = /delete_post_meta\s*\(\s*\$(order_id|order|post_id|postid|id)\s*,\s*(['"][^'"]+['"])\s*(?:,\s*([^;\n\)]+)\s*)?\)\s*;?/gi;
  return safeReplace(content, pattern, (_match: string, variable: string, key: string) => {
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
  // Insert a valid declare_compatibility snippet. This exact snippet is safe
  // and matches WooCommerce guidance. Backslashes are double-escaped for the
  // TypeScript string literal.
  const declaration = `\n\n// Declare HPOS compatibility.\nadd_action( 'before_woocommerce_init', function() {\n    if ( class_exists( '\\Automattic\\WooCommerce\\Utilities\\FeaturesUtil' ) ) {\n        \\Automattic\\WooCommerce\\Utilities\\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__ );\n    }\n} );\n\n`;

  // Prefer to insert directly after the plugin header block if present.
  const pluginHeaderMatch = content.match(/\/\*[\s\S]*?Plugin Name:\s*.+?\*[\s\S]*?\*\//i);
  if (pluginHeaderMatch && pluginHeaderMatch.index !== undefined) {
    const headerEnd = pluginHeaderMatch.index + pluginHeaderMatch[0].length;
    return content.substring(0, headerEnd) + declaration + content.substring(headerEnd);
  }

  // Fallback: insert at top of the file.
  return declaration + content;
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

  // Attempt to find the plugin header block and insert before its closing */
  const pluginHeaderMatch = content.match(/\/\*[\s\S]*?Plugin Name:\s*.+?\*[\s\S]*?\*\//i);
  if (pluginHeaderMatch && pluginHeaderMatch.index !== undefined) {
    const headerStart = pluginHeaderMatch.index;
    const header = pluginHeaderMatch[0];
    const headerEnd = headerStart + header.length;
    // Insert before closing */ inside header
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
