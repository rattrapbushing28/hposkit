/**
 * Auto-patching engine — TypeScript port of the PHP patcher logic.
 * Applies automated fixes for detected HPOS issues.
 */

import type { Issue, ScannedFile } from "./scanner";

export interface PatchResult {
  file: string;
  originalContent: string;
  patchedContent: string;
  diff: string;
  applied: boolean;
  error?: string;
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
  // Match get_post( $order_id ) or get_post( $order_id, $output, $filter )
  // Replace just the get_post call, preserve any extra args by dropping them
  // since wc_get_order doesn't accept $output/$filter params.
  const pattern = /get_post\s*\(\s*\$(order_id|order|post_id|postid|id)\b[^)]*\)/gi;
  return content.replace(pattern, (_match, variable) => {
    return `wc_get_order( $${variable} )`;
  });
}

function patchGetPostMeta(content: string): string {
  const pattern = /get_post_meta\s*\(\s*\$(order_id|order|post_id|postid|id)\s*,\s*(['"][^'"]+['"])\s*(?:,\s*(true|false)\s*)?\)/gi;
  return content.replace(pattern, (_match, variable, key, single) => {
    return `wc_get_order( $${variable} )->get_meta( ${key}${single ? ', ' + single : ''} )`;
  });
}

function patchAddPostMeta(content: string): string {
  const pattern = /add_post_meta\s*\(\s*\$(order_id|order|post_id|postid|id)\s*,\s*(['"][^'"]+['"])\s*,\s*([\s\S]+?)\s*\)\s*;?/g;
  return content.replace(pattern, (_match, variable, key, value) => {
    const trimmedValue = value.trim();
    return `$order = wc_get_order( $${variable} ); $order->add_meta_data( ${key}, ${trimmedValue} ); $order->save();`;
  });
}

function patchUpdatePostMeta(content: string): string {
  const pattern = /update_post_meta\s*\(\s*\$(order_id|order|post_id|postid|id)\s*,\s*(['"][^'"]+['"])\s*,\s*([\s\S]+?)\s*\)\s*;?/g;
  return content.replace(pattern, (_match, variable, key, value) => {
    const trimmedValue = value.trim();
    return `$order = wc_get_order( $${variable} ); $order->update_meta_data( ${key}, ${trimmedValue} ); $order->save();`;
  });
}

function patchDeletePostMeta(content: string): string {
  const pattern = /delete_post_meta\s*\(\s*\$(order_id|order|post_id|postid|id)\s*,\s*(['"][^'"]+['"])\s*(?:,\s*([\s\S]+?)\s*)?\)\s*;?/g;
  return content.replace(pattern, (_match, variable, key) => {
    return `$order = wc_get_order( $${variable} ); $order->delete_meta_data( ${key} ); $order->save();`;
  });
}

function patchWpQueryOrders(content: string): string {
  const pattern = /new\s+WP_Query\s*\(\s*(\[\s*(?:[^\]]*?)post_type['"]\s*=>\s*['"]shop_order['"][^\]]*\]|\s*array\s*\(\s*(?:[^)]*?)post_type['"]\s*=>\s*['"]shop_order['"][^)]*\))\s*\)/gi;
  return content.replace(pattern, (_match, args) => {
    const cleaned = args.replace(/['"]post_type['"]\s*=>\s*['"]shop_order['"]\s*,?\s*/i, "").trim().replace(/^[,\s]+|[,\s]+$/g, "");
    return `wc_get_orders( ${cleaned} )`;
  });
}

function patchGetPostsOrders(content: string): string {
  const pattern = /get_posts\s*\(\s*(\[\s*(?:[^\]]*?)post_type['"]\s*=>\s*['"]shop_order['"][^\]]*\]|\s*array\s*\(\s*(?:[^)]*?)post_type['"]\s*=>\s*['"]shop_order['"][^)]*\))\s*\)/gi;
  return content.replace(pattern, (_match, args) => {
    const cleaned = args.replace(/['"]post_type['"]\s*=>\s*['"]shop_order['"]\s*,?\s*/i, "").trim().replace(/^[,\s]+|[,\s]+$/g, "");
    return `wc_get_orders( ${cleaned} )`;
  });
}

function patchMissingDeclaration(content: string): string {
  // Per WooCommerce docs and webkul.com guide:
  // Use FeaturesUtil::class syntax with true (compatible) parameter.
  const declaration = `\n\n// Declare HPOS compatibility.\nadd_action( 'before_woocommerce_init', function() {\n\tif ( class_exists( \\Automattic\\WooCommerce\\Utilities\\FeaturesUtil::class ) ) {\n\t\t\\Automattic\\WooCommerce\\Utilities\\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );\n\t}\n} );\n`;

  const headerEnd = content.indexOf("*/");
  if (headerEnd !== -1) {
    const pos = headerEnd + 2;
    return content.substring(0, pos) + declaration + content.substring(pos);
  }
  return declaration + "\n" + content;
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

  const headerEnd = content.indexOf("*/");
  if (headerEnd !== -1) {
    const insert = "\n" + insertions.join("\n") + "\n";
    return content.substring(0, headerEnd) + insert + content.substring(headerEnd);
  }
  return content;
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
      for (const issue of fileIssues) {
        const patched = applyPatch(content, issue);
        if (patched !== null) {
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
        patchedFiles.push(file);
      }
    } else {
      patchedFiles.push(file);
    }
  }

  return { patchedFiles, results };
}
