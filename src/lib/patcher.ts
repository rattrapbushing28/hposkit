*** Begin Patch
*** Update File: src/lib/patcher.ts
@@
-  while ((m = re.exec(content)) !== null) {
-    const idx = m.index;
-    // If the start is inside a string or comment, skip this match
-    if (isIndexInsideStringOrComment(content, idx)) {
-      // advance lastIndex and continue without replacing
-      continue;
-    }
-    out += content.slice(lastIndex, idx);
-    const repl = replacementFn(...m, idx, content);
-    out += repl;
-    lastIndex = idx + m[0].length;
-  }
+  while ((m = re.exec(content)) !== null) {
+    const idx = m.index;
+    const matchText = m[0];
+    // If the start is inside a string or comment, skip this match
+    if (isIndexInsideStringOrComment(content, idx)) {
+      // do not replace; continue scanning
+      continue;
+    }
+    out += content.slice(lastIndex, idx);
+    // Allow the replacement function to compute replacement
+    let repl = replacementFn(...m, idx, content);
+    // Preserve trailing semicolon from original match if present
+    if (/;\s*$/.test(matchText) && !/;\s*$/.test(repl)) {
+      repl = repl + ";";
+    }
+    out += repl;
+    lastIndex = idx + matchText.length;
+  }
*** End Patch
