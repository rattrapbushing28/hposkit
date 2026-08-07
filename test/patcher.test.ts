import { describe, it, expect } from "vitest";
import { applyPatch, patchAllIssues, computeDiff } from "../src/lib/patcher";
import type { Issue, ScannedFile } from "../src/lib/scanner";

describe("patcher: statement context behavior", () => {
  it("patches standalone statements", () => {
    const content = `<?php\n$order = get_post( $order_id );\n`;
    const issue: Issue = {
      type: "get_post",
      severity: "critical",
      file: "test.php",
      line: 2,
      code: "get_post( $order_id )",
      title: "test",
      description: "test",
      fix: "test",
      patchable: true,
    };
    const result = applyPatch(content, issue);
    expect(result).toContain("wc_get_order( $order_id )");
    expect(result).not.toContain("get_post( $order_id )");
  });

  it("does NOT patch calls inside function arguments", () => {
    const content = `<?php\n$meta = get_post_meta( get_post( $order_id )->ID, '_total', true );\n`;
    const issue: Issue = {
      type: "get_post",
      severity: "critical",
      file: "test.php",
      line: 2,
      code: "get_post( $order_id )",
      title: "test",
      description: "test",
      fix: "test",
      patchable: true,
    };
    const result = applyPatch(content, issue);
    // The inner get_post is followed by "->ID" not a semicolon, so it should NOT be patched
    expect(result).toContain("get_post( $order_id )->ID");
  });

  it("does NOT patch calls inside expressions (assignment without semicolon)", () => {
    const content = `<?php\nif ( get_post( $order_id ) ) {\n  return true;\n}\n`;
    const issue: Issue = {
      type: "get_post",
      severity: "critical",
      file: "test.php",
      line: 2,
      code: "get_post( $order_id )",
      title: "test",
      description: "test",
      fix: "test",
      patchable: true,
    };
    const result = applyPatch(content, issue);
    // get_post is followed by " )" then " )", not a semicolon — should not patch
    expect(result).toContain("get_post( $order_id )");
  });

  it("does NOT patch calls inside string literals", () => {
    const content = `<?php\n$msg = "Call get_post( $order_id ) to fetch order";\nget_post( $order_id );\n`;
    const issue: Issue = {
      type: "get_post",
      severity: "critical",
      file: "test.php",
      line: 2,
      code: "get_post( $order_id )",
      title: "test",
      description: "test",
      fix: "test",
      patchable: true,
    };
    const result = applyPatch(content, issue);
    // First occurrence is inside a string — should NOT be patched
    expect(result).toContain('"Call get_post( $order_id ) to fetch order"');
    // Second occurrence is a standalone statement — SHOULD be patched
    expect(result).toContain("wc_get_order( $order_id );");
  });

  it("does NOT patch calls inside comments", () => {
    const content = `<?php\n// Use get_post( $order_id ) to fetch the order\nget_post( $order_id );\n`;
    const issue: Issue = {
      type: "get_post",
      severity: "critical",
      file: "test.php",
      line: 2,
      code: "get_post( $order_id )",
      title: "test",
      description: "test",
      fix: "test",
      patchable: true,
    };
    const result = applyPatch(content, issue);
    // Comment line should NOT be patched
    expect(result).toContain("// Use get_post( $order_id ) to fetch the order");
    // Standalone statement SHOULD be patched
    expect(result).toContain("wc_get_order( $order_id );");
  });
});

describe("patcher: semicolon preservation", () => {
  it("preserves trailing semicolons in get_post_meta patches", () => {
    const content = `<?php\n$value = get_post_meta( $order_id, '_total', true );\n`;
    const issue: Issue = {
      type: "get_post_meta",
      severity: "critical",
      file: "test.php",
      line: 2,
      code: "get_post_meta( $order_id, '_total', true )",
      title: "test",
      description: "test",
      fix: "test",
      patchable: true,
    };
    const result = applyPatch(content, issue);
    expect(result).toContain("wc_get_order( $order_id )->get_meta( '_total', true );");
    // Should end with semicolon
    expect(result!.trim().endsWith(";")).toBe(true);
  });

  it("preserves semicolons in update_post_meta patches", () => {
    const content = `<?php\nupdate_post_meta( $order_id, '_status', 'completed' );\n`;
    const issue: Issue = {
      type: "update_post_meta",
      severity: "critical",
      file: "test.php",
      line: 2,
      code: "update_post_meta( $order_id, '_status', 'completed' )",
      title: "test",
      description: "test",
      fix: "test",
      patchable: true,
    };
    const result = applyPatch(content, issue);
    expect(result).toContain("$order->save();");
    expect(result).toContain("$order->update_meta_data( '_status', 'completed' );");
  });
});

describe("patcher: header insertion fallbacks", () => {
  it("inserts declaration after plugin header block", () => {
    const content = `<?php\n/**\n * Plugin Name: Test Plugin\n * Version: 1.0.0\n */\n\necho "hello";\n`;
    const issue: Issue = {
      type: "missing_compat_declaration",
      severity: "warning",
      file: "test.php",
      line: 1,
      code: "",
      title: "test",
      description: "test",
      fix: "test",
      patchable: true,
    };
    const result = applyPatch(content, issue);
    expect(result).toContain("declare_compatibility");
    expect(result).toContain("FeaturesUtil");
    // Declaration should come after the header block
    const headerEnd = result!.indexOf("*/");
    const declStart = result!.indexOf("declare_compatibility");
    expect(declStart).toBeGreaterThan(headerEnd);
  });

  it("inserts declaration after <?php when no header block exists", () => {
    const content = `<?php\necho "hello";\n`;
    const issue: Issue = {
      type: "missing_compat_declaration",
      severity: "warning",
      file: "test.php",
      line: 1,
      code: "",
      title: "test",
      description: "test",
      fix: "test",
      patchable: true,
    };
    const result = applyPatch(content, issue);
    expect(result).toContain("declare_compatibility");
    expect(result!.startsWith("<?php")).toBe(true);
  });

  it("prepends <?php wrapper when file has no <?php tag", () => {
    const content = `echo "hello";\n`;
    const issue: Issue = {
      type: "missing_compat_declaration",
      severity: "warning",
      file: "test.php",
      line: 1,
      code: "",
      title: "test",
      description: "test",
      fix: "test",
      patchable: true,
    };
    const result = applyPatch(content, issue);
    expect(result!.startsWith("<?php")).toBe(true);
    expect(result).toContain("declare_compatibility");
  });
});

describe("patcher: complex expression handling", () => {
  it("patches add_post_meta even when value contains nested function calls", () => {
    const content = `<?php\nadd_post_meta( $order_id, '_total', calculate_total( $items ) );\n`;
    const issue: Issue = {
      type: "add_post_meta",
      severity: "critical",
      file: "test.php",
      line: 2,
      code: "add_post_meta( $order_id, '_total', calculate_total( $items ) )",
      title: "test",
      description: "test",
      fix: "test",
      patchable: true,
    };
    const result = applyPatch(content, issue);
    // Now patches with balanced paren parser — value is preserved correctly
    expect(result).toContain("add_meta_data( '_total', calculate_total( $items ) )");
    expect(result).toContain("$order->save();");
  });
});

describe("patcher: patchAllIssues integration", () => {
  it("reports manual review required when no safe patch applied", () => {
    const content = `<?php\nif ( get_post( $order_id ) ) { return; }\n`;
    const files: ScannedFile[] = [{ path: "test.php", content }];
    const issues: Issue[] = [
      {
        type: "get_post",
        severity: "critical",
        file: "test.php",
        line: 2,
        code: "get_post( $order_id )",
        title: "test",
        description: "test",
        fix: "test",
        patchable: true,
      },
    ];
    const { results } = patchAllIssues(files, issues);
    expect(results[0].applied).toBe(false);
    expect(results[0].error).toContain("manual review");
  });
});
