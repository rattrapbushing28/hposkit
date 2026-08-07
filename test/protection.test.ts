import { describe, it, expect } from "vitest";
import { isIndexInsideStringOrComment } from "../src/lib/protection";

describe("protection helper", () => {
  it("detects strings and comments correctly", () => {
    const content = `<?php\n// this is a comment with get_post($id)\n$foo = get_post($id);\necho "call get_post($id) in string";\n/* block comment get_post($id) */\n`;
    const commentIndex = content.indexOf("get_post($id)");
    // first occurrence is in comment -> should be inside
    expect(isIndexInsideStringOrComment(content, commentIndex)).toBe(true);

    const secondIndex = content.indexOf("get_post($id)", commentIndex + 1);
    // second occurrence is in code -> should be false
    expect(isIndexInsideStringOrComment(content, secondIndex)).toBe(false);

    const thirdIndex = content.indexOf("get_post($id)", secondIndex + 1);
    // third occurrence is inside double-quoted string -> true
    expect(isIndexInsideStringOrComment(content, thirdIndex)).toBe(true);

    const blockIndex = content.lastIndexOf("get_post($id)");
    expect(isIndexInsideStringOrComment(content, blockIndex)).toBe(true);
  });
});
