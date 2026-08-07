/**
 * Simple PHP string/comment protection helper.
 * Provides a minimal conservative check to avoid applying regex-based
 * replacements inside string literals or comments.
 *
 * NOTE: This is intentionally lightweight. It handles:
 *  - single-quoted strings
 *  - double-quoted strings (with escape handling)
 *  - C-style block comments /* ... *\/
 *  - line comments starting with // or #
 *
 * It does not fully parse PHP (heredoc/nowdoc and some edge cases are not
 * covered). This helper reduces the risk of corrupting source by avoiding
 * replacements when the match start is inside a protected range.
 */

export function isIndexInsideStringOrComment(content: string, index: number): boolean {
  if (index < 0) return false;
  const len = content.length;
  let i = 0;
  let state: "code" | "single" | "double" | "block" | "line" = "code";

  while (i <= Math.min(index, len - 1)) {
    const ch = content[i];
    const next = i + 1 < len ? content[i + 1] : "";

    if (state === "code") {
      if (ch === "'") {
        state = "single";
        i++;
        continue;
      }
      if (ch === '"') {
        state = "double";
        i++;
        continue;
      }
      if (ch === "/" && next === "*") {
        state = "block";
        i += 2;
        continue;
      }
      if (ch === "/" && next === "/") {
        state = "line";
        i += 2;
        continue;
      }
      if (ch === "#") {
        state = "line";
        i++;
        continue;
      }
      i++;
      continue;
    }

    if (state === "single") {
      if (ch === "\\") {
        // escape: skip next char
        i += 2;
        continue;
      }
      if (ch === "'") {
        state = "code";
        i++;
        continue;
      }
      i++;
      continue;
    }

    if (state === "double") {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === '"') {
        state = "code";
        i++;
        continue;
      }
      i++;
      continue;
    }

    if (state === "block") {
      if (ch === "*" && next === "/") {
        // end of block comment
        state = "code";
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (state === "line") {
      if (ch === "\n" || ch === "\r") {
        state = "code";
        i++;
        continue;
      }
      i++;
      continue;
    }
  }

  // After scanning up to index, if we're currently in single/double/block/line,
  // index lies inside a protected range.
  return state !== "code";
}
