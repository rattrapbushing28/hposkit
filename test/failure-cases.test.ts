import { describe, it, expect } from "vitest";
import { applyPatch } from "../src/lib/patcher";
import type { Issue } from "../src/lib/scanner";

function makeIssue(type: Issue["type"]): Issue {
  return {
    type,
    severity: "critical",
    file: "test.php",
    line: 1,
    code: "",
    title: "test",
    description: "test",
    fix: "test",
    patchable: true,
  };
}

describe("patcher: real-world cases that now work", () => {
  it("patches multi-line update_post_meta calls", () => {
    const content = `<?php\nupdate_post_meta( $order_id, '_usd_price',\n    $usd_price\n);\n`;
    const result = applyPatch(content, makeIssue("update_post_meta"));
    expect(result).toContain("update_meta_data");
    expect(result).toContain("wc_get_order");
    expect(result).not.toContain("update_post_meta( $order_id");
  });

  it("patches update_post_meta with function call in value", () => {
    const content = `<?php\nupdate_post_meta( $order_id, '_total', number_format( $total, 2 ) );\n`;
    const result = applyPatch(content, makeIssue("update_post_meta"));
    expect(result).toContain("update_meta_data");
    expect(result).toContain("number_format( $total, 2 )");
  });

  it("patches update_post_meta with variable key", () => {
    const content = `<?php\nupdate_post_meta( $order_id, $meta_key, $value );\n`;
    const result = applyPatch(content, makeIssue("update_post_meta"));
    expect(result).toContain("update_meta_data");
    expect(result).toContain("$meta_key");
  });

  it("patches multi-line get_post_meta calls", () => {
    const content = `<?php\n$total = get_post_meta(\n    $order_id,\n    '_order_total',\n    true\n);\n`;
    const result = applyPatch(content, makeIssue("get_post_meta"));
    expect(result).toContain("wc_get_order( $order_id )->get_meta( '_order_total', true )");
  });

  it("patches add_post_meta with function call in value", () => {
    const content = `<?php\nadd_post_meta( $order_id, '_total', wc_format_decimal( $total ) );\n`;
    const result = applyPatch(content, makeIssue("add_post_meta"));
    expect(result).toContain("add_meta_data");
    expect(result).toContain("wc_format_decimal( $total )");
  });

  it("patches delete_post_meta with variable key", () => {
    const content = `<?php\ndelete_post_meta( $order_id, $key );\n`;
    const result = applyPatch(content, makeIssue("delete_post_meta"));
    expect(result).toContain("delete_meta_data");
    expect(result).toContain("$key");
  });

  it("still does NOT patch calls inside function arguments", () => {
    const content = `<?php\n$meta = get_post_meta( get_post( $order_id )->ID, '_total', true );\n`;
    const result = applyPatch(content, makeIssue("get_post"));
    expect(result).toContain("get_post( $order_id )->ID");
  });

  it("still does NOT patch calls inside strings", () => {
    const content = `<?php\n$msg = "Call get_post( $order_id ) to fetch";\nget_post( $order_id );\n`;
    const result = applyPatch(content, makeIssue("get_post"));
    expect(result).toContain('"Call get_post( $order_id ) to fetch"');
    expect(result).toContain("wc_get_order( $order_id );");
  });
});
