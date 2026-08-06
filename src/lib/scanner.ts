/**
 * HPOS incompatibility scanner — TypeScript port of the PHP scanner logic.
 * Analyzes PHP plugin files for patterns that break under WooCommerce HPOS.
 */

export type Severity = "critical" | "warning" | "info";

export type IssueType =
  | "get_post"
  | "get_post_meta"
  | "add_post_meta"
  | "update_post_meta"
  | "delete_post_meta"
  | "wp_query_orders"
  | "get_posts_orders"
  | "wpdb_get_results"
  | "wpdb_insert_posts"
  | "deprecated_hook"
  | "missing_compat_declaration"
  | "missing_wc_header";

export interface Issue {
  type: IssueType;
  severity: Severity;
  file: string;
  line: number;
  code: string;
  title: string;
  description: string;
  fix: string;
  patchable: boolean;
}

export interface PluginScanResult {
  name: string;
  version: string;
  files: ScannedFile[];
  issues: Issue[];
  status: "compatible" | "needs_fix" | "critical";
  issueCount: number;
}

export interface ScannedFile {
  path: string;
  content: string;
}

export interface ScanSummary {
  totalFiles: number;
  totalIssues: number;
  criticalIssues: number;
  warningIssues: number;
  infoIssues: number;
}

export interface ScanReport {
  summary: ScanSummary;
  issues: Issue[];
}

const DEPRECATED_HOOKS = [
  "woocommerce_payment_complete",
  "woocommerce_thankyou",
  "woocommerce_order_status_changed",
  "woocommerce_order_status_pending",
  "woocommerce_order_status_processing",
  "woocommerce_order_status_on-hold",
  "woocommerce_order_status_completed",
  "woocommerce_order_status_cancelled",
  "woocommerce_order_status_failed",
  "woocommerce_order_status_refunded",
  "woocommerce_order_status_pending_to_processing",
  "woocommerce_order_status_pending_to_on-hold",
  "woocommerce_order_status_processing_to_completed",
  "woocommerce_order_fully_refunded",
  "woocommerce_order_partially_refunded",
  "woocommerce_order_refunded",
  "woocommerce_new_order",
  "woocommerce_edit_order",
  "woocommerce_update_order",
];

/**
 * Scan a set of PHP files for HPOS incompatibility issues.
 */
export function scanFiles(files: ScannedFile[]): ScanReport {
  const allIssues: Issue[] = [];

  for (const file of files) {
    const issues = scanFileContent(file.content, file.path);
    allIssues.push(...issues);
  }

  const summary: ScanSummary = {
    totalFiles: files.length,
    totalIssues: allIssues.length,
    criticalIssues: allIssues.filter((i) => i.severity === "critical").length,
    warningIssues: allIssues.filter((i) => i.severity === "warning").length,
    infoIssues: allIssues.filter((i) => i.severity === "info").length,
  };

  return { summary, issues: allIssues };
}

/**
 * Scan a single file's content.
 */
export function scanFileContent(content: string, filePath: string): Issue[] {
  const lines = content.split("\n");
  const issues: Issue[] = [];

  issues.push(...findGetPost(content, lines, filePath));
  issues.push(...findGetPostMeta(content, lines, filePath));
  issues.push(...findAddPostMeta(content, lines, filePath));
  issues.push(...findUpdatePostMeta(content, lines, filePath));
  issues.push(...findDeletePostMeta(content, lines, filePath));
  issues.push(...findWpQueryOrders(content, lines, filePath));
  issues.push(...findGetPostsOrders(content, lines, filePath));
  issues.push(...findWpdbQueries(content, lines, filePath));
  issues.push(...findDeprecatedHooks(content, lines, filePath));

  return issues;
}

function lineFromOffset(content: string, offset: number): number {
  return content.substring(0, offset).split("\n").length;
}

function findGetPost(content: string, lines: string[], file: string): Issue[] {
  const issues: Issue[] = [];
  const pattern = /get_post\s*\(\s*\$(order_id|order|post_id|postid|id)\b[^)]*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const line = lineFromOffset(content, match.index);
    issues.push({
      type: "get_post",
      severity: "critical",
      file,
      line,
      code: (lines[line - 1] || "").trim(),
      title: "Direct get_post() on order ID",
      description:
        "Uses get_post() to fetch an order as a WP_Post object. Under HPOS, orders are not stored in wp_posts. Use wc_get_order( $order_id ) to get a WC_Order object instead.",
      fix: "wc_get_order( $order_id )",
      patchable: true,
    });
  }
  return issues;
}

function findGetPostMeta(content: string, lines: string[], file: string): Issue[] {
  const issues: Issue[] = [];
  const pattern = /get_post_meta\s*\(\s*\$(order_id|order|post_id|postid|id)\b[^)]*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const line = lineFromOffset(content, match.index);
    issues.push({
      type: "get_post_meta",
      severity: "warning",
      file,
      line,
      code: (lines[line - 1] || "").trim(),
      title: "Direct get_post_meta() on order",
      description:
        "Uses get_post_meta() to read order metadata. Under HPOS, order data is stored in custom tables, not wp_postmeta. Use wc_get_order( $order_id )->get_meta( 'key' ) instead.",
      fix: "wc_get_order( $order_id )->get_meta( 'key' )",
      patchable: true,
    });
  }
  return issues;
}

function findAddPostMeta(content: string, lines: string[], file: string): Issue[] {
  const issues: Issue[] = [];
  const pattern = /add_post_meta\s*\(\s*\$(order_id|order|post_id|postid|id)\b[^)]*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const line = lineFromOffset(content, match.index);
    issues.push({
      type: "add_post_meta",
      severity: "critical",
      file,
      line,
      code: (lines[line - 1] || "").trim(),
      title: "Direct add_post_meta() on order",
      description:
        "Uses add_post_meta() to add order metadata. Under HPOS, this writes to wp_postmeta which is not synced to the orders table. Use $order = wc_get_order( $order_id ); $order->add_meta_data( 'key', $value ); $order->save(); instead.",
      fix: "$order->add_meta_data( 'key', $value ); $order->save();",
      patchable: true,
    });
  }
  return issues;
}

function findUpdatePostMeta(content: string, lines: string[], file: string): Issue[] {
  const issues: Issue[] = [];
  const pattern = /update_post_meta\s*\(\s*\$(order_id|order|post_id|postid|id)\b[^)]*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const line = lineFromOffset(content, match.index);
    issues.push({
      type: "update_post_meta",
      severity: "critical",
      file,
      line,
      code: (lines[line - 1] || "").trim(),
      title: "Direct update_post_meta() on order",
      description:
        "Uses update_post_meta() to write order metadata. Under HPOS, this writes to wp_postmeta which is not synced to the orders table. Use $order = wc_get_order( $order_id ); $order->update_meta_data( 'key', $value ); $order->save(); instead.",
      fix: "$order->update_meta_data( 'key', $value ); $order->save();",
      patchable: true,
    });
  }
  return issues;
}

function findDeletePostMeta(content: string, lines: string[], file: string): Issue[] {
  const issues: Issue[] = [];
  const pattern = /delete_post_meta\s*\(\s*\$(order_id|order|post_id|postid|id)\b[^)]*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const line = lineFromOffset(content, match.index);
    issues.push({
      type: "delete_post_meta",
      severity: "critical",
      file,
      line,
      code: (lines[line - 1] || "").trim(),
      title: "Direct delete_post_meta() on order",
      description:
        "Uses delete_post_meta() to remove order metadata. Under HPOS, this does not affect the orders table. Use $order->delete_meta_data( 'key' ); $order->save(); instead.",
      fix: "$order->delete_meta_data( 'key' ); $order->save();",
      patchable: true,
    });
  }
  return issues;
}

function findWpQueryOrders(content: string, lines: string[], file: string): Issue[] {
  const issues: Issue[] = [];
  const pattern = /new\s+WP_Query\s*\(\s*(?:array\s*\(|\[)[\s\S]*?(?:post_type["']\s*=>\s*["']shop_order)["'][\s\S]*?\)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const line = lineFromOffset(content, match.index);
    issues.push({
      type: "wp_query_orders",
      severity: "critical",
      file,
      line,
      code: (lines[line - 1] || "").trim(),
      title: "WP_Query for shop_order post type",
      description:
        "Uses WP_Query with post_type=shop_order to fetch orders. Under HPOS, orders are not stored as posts. Use wc_get_orders( [ ... ] ) instead.",
      fix: "wc_get_orders( [ 'limit' => -1 ] )",
      patchable: true,
    });
  }
  return issues;
}

function findGetPostsOrders(content: string, lines: string[], file: string): Issue[] {
  const issues: Issue[] = [];
  const pattern = /get_posts\s*\(\s*(?:array\s*\(|\[)[\s\S]*?(?:post_type["']\s*=>\s*["']shop_order)["'][\s\S]*?\)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const line = lineFromOffset(content, match.index);
    issues.push({
      type: "get_posts_orders",
      severity: "critical",
      file,
      line,
      code: (lines[line - 1] || "").trim(),
      title: "get_posts() for shop_order post type",
      description:
        "Uses get_posts() with post_type=shop_order. Under HPOS, orders are not stored as posts. Use wc_get_orders() instead.",
      fix: "wc_get_orders( [ 'limit' => -1 ] )",
      patchable: true,
    });
  }
  return issues;
}

function findWpdbQueries(content: string, lines: string[], file: string): Issue[] {
  const issues: Issue[] = [];

  // $wpdb->get_results with shop_order — manual fix only, can't safely auto-convert SQL
  const pattern1 = /\$wpdb->get_results\s*\([\s\S]*?(?:shop_order|post_type\s*=\s*['"]shop_order)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern1.exec(content)) !== null) {
    const line = lineFromOffset(content, match.index);
    issues.push({
      type: "wpdb_get_results",
      severity: "critical",
      file,
      line,
      code: (lines[line - 1] || "").trim(),
      title: "Direct $wpdb query for orders",
      description:
        "Uses $wpdb->get_results() with a query targeting shop_order posts. Under HPOS, this query returns no results because orders live in custom tables. Must be rewritten manually to use wc_get_orders() or the Order CRUD API.",
      fix: "Rewrite to use wc_get_orders() or wc_get_order( $order_id )",
      patchable: false,
    });
  }

  // $wpdb->insert into $wpdb->posts
  const pattern2 = /\$wpdb->insert\s*\(\s*\$wpdb->posts\b/gi;
  while ((match = pattern2.exec(content)) !== null) {
    const line = lineFromOffset(content, match.index);
    issues.push({
      type: "wpdb_insert_posts",
      severity: "critical",
      file,
      line,
      code: (lines[line - 1] || "").trim(),
      title: "Direct $wpdb->insert into wp_posts",
      description:
        "Inserts directly into wp_posts table. If creating orders, use wc_create_order() instead. Direct inserts bypass HPOS data integrity.",
      fix: "wc_create_order()",
      patchable: false,
    });
  }

  // $wpdb->update or $wpdb->delete on wp_posts with shop_order
  const pattern3 = /\$wpdb->(update|delete)\s*\(\s*\$wpdb->posts\b[\s\S]*?shop_order/gi;
  while ((match = pattern3.exec(content)) !== null) {
    const line = lineFromOffset(content, match.index);
    const op = match[1];
    issues.push({
      type: "wpdb_insert_posts",
      severity: "critical",
      file,
      line,
      code: (lines[line - 1] || "").trim(),
      title: `Direct $wpdb->${op} on wp_posts for orders`,
      description:
        `Uses $wpdb->${op}() on wp_posts targeting shop_order. Under HPOS, orders are in custom tables. Use WC_Order CRUD methods instead.`,
      fix: `Use \$order = wc_get_order( \$order_id ); \$order->save(); or \$order->delete();`,
      patchable: false,
    });
  }

  return issues;
}

function findDeprecatedHooks(content: string, lines: string[], file: string): Issue[] {
  const issues: Issue[] = [];
  for (const hook of DEPRECATED_HOOKS) {
    const escapedHook = hook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `(?:add_action|do_action)\\s*\\(\\s*["']${escapedHook}["']`,
      "gi"
    );
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const line = lineFromOffset(content, match.index);
      issues.push({
        type: "deprecated_hook",
        severity: "warning",
        file,
        line,
        code: (lines[line - 1] || "").trim(),
        title: `Deprecated hook: ${hook}`,
        description:
          "This hook historically passes $order_id (an integer). Under HPOS, prefer hooks that pass the WC_Order object directly. Verify your callback signature and use wc_get_order() to obtain the order object if needed.",
        fix: "Use wc_get_order( $order_id ) to get the order object in your callback.",
        patchable: false,
      });
    }
  }
  return issues;
}

/**
 * Check plugin main file header for required WC fields and compatibility declaration.
 */
export function scanPluginHeader(mainFileContent: string, allFiles: ScannedFile[], mainFilePath: string): Issue[] {
  const issues: Issue[] = [];

  const hasWcTested = /\*\s*WC tested up to:\s*([0-9.]+)/i.test(mainFileContent);
  const hasRequiresPlugins = /\*\s*Requires Plugins:\s*woocommerce/i.test(mainFileContent);

  if (!hasWcTested) {
    issues.push({
      type: "missing_wc_header",
      severity: "info",
      file: mainFilePath,
      line: 0,
      code: "",
      title: 'Missing "WC tested up to" header',
      description:
        'Plugin header should declare "WC tested up to: 9.4" to indicate HPOS compatibility testing.',
      fix: "Add: * WC tested up to: 9.4",
      patchable: true,
    });
  }

  if (!hasRequiresPlugins) {
    issues.push({
      type: "missing_wc_header",
      severity: "info",
      file: mainFilePath,
      line: 0,
      code: "",
      title: 'Missing "Requires Plugins: woocommerce" header',
      description:
        'Plugin header should declare "Requires Plugins: woocommerce" for proper dependency management.',
      fix: "Add: * Requires Plugins: woocommerce",
      patchable: true,
    });
  }

  // Check all files for declare_compatibility call.
  const hasDecl = allFiles.some((f) =>
    /declare_compatibility\s*\(\s*['"]custom_order_tables['"]/i.test(f.content)
  );
  if (!hasDecl) {
    issues.push({
      type: "missing_compat_declaration",
      severity: "warning",
      file: mainFilePath,
      line: 0,
      code: "",
      title: "Missing HPOS compatibility declaration",
      description:
        "Plugin does not call FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__ ). Without this, WooCommerce cannot confirm HPOS compatibility and may show warnings or disable the plugin.",
      fix:
        "add_action( 'before_woocommerce_init', function() {\n    if ( class_exists( '\\Automattic\\WooCommerce\\Utilities\\FeaturesUtil' ) ) {\n        \\Automattic\\WooCommerce\\Utilities\\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__ );\n    }\n} );",
      patchable: true,
    });
  }

  return issues;
}

/**
 * Determine overall status from issues.
 */
export function determineStatus(issues: Issue[]): "compatible" | "needs_fix" | "critical" {
  if (issues.length === 0) return "compatible";
  if (issues.some((i) => i.severity === "critical")) return "critical";
  return "needs_fix";
}
