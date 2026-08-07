*** Begin Patch
*** Update File: src/lib/patcher.ts
@@
-import type { Issue, ScannedFile } from "./scanner";
+import type { Issue, ScannedFile } from "./scanner";
+import { isIndexInsideStringOrComment } from "./protection";
@@
 function patchMissingDeclaration(content: string): string {
-  // Per WooCommerce docs and webkul.com guide:
-  // Use FeaturesUtil::class syntax with true (compatible) parameter.
-  const declaration = `\n\n// Declare HPOS compatibility.\nadd_action( 'before_woocommerce_init', function() {\n\tif ( class_exists( \\Automattic\\WooCommerce\\Utilities\\FeaturesUtil::class ) ) [...]\n\n`;
-
-  const headerEnd = content.indexOf("*/");
-  if (headerEnd !== -1) {
-    const pos = headerEnd + 2;
-    return content.substring(0, pos) + declaration + content.substring(pos);
-  }
-  return declaration + "\n" + content;
+  // Insert a valid declare_compatibility snippet. This exact snippet is safe
+  // and matches WooCommerce guidance. Backslashes are double-escaped for the
+  // TypeScript string literal.
+  const declaration = `\n\n// Declare HPOS compatibility.\nadd_action( 'before_woocommerce_init', function() {\n    if ( class_exists( '\\Automattic\\WooCommerce\\Utilities\\FeaturesUtil' ) ) {\n        \\Automattic\\WooCommerce\\Utilities\\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__ );\n    }\n} );\n\n`;
+
+  // Prefer to insert directly after the plugin header block if present.
+  const pluginHeaderMatch = content.match(/\/\*[\s\S]*?Plugin Name:\s*.+?\*[\s\S]*?\*\//i);
+  if (pluginHeaderMatch && pluginHeaderMatch.index !== undefined) {
+    const headerEnd = pluginHeaderMatch.index + pluginHeaderMatch[0].length;
+    return content.substring(0, headerEnd) + declaration + content.substring(headerEnd);
+  }
+
+  // Fallback: insert at top of the file.
+  return declaration + content;
 }
*** End Patch
