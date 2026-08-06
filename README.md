<div align="center">

# HPOSKit for WooCommerce

### Scan. Detect. Auto-patch. Ship HPOS-compatible plugins.

[![Live Demo](https://img.shields.io/badge/Live-Demo-7f54b3?style=for-the-badge&logo=vercel&logoColor=white)](https://hposkit.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](https://opensource.org/licenses/MIT)
[![WooCommerce 9.4+](https://img.shields.io/badge/WooCommerce-9.4%2B-9b74c7?style=for-the-badge&logo=woocommerce&logoColor=white)](https://woocommerce.com/document/high-performance-order-storage/)
[![100% Client-Side](https://img.shields.io/badge/100%25-Client_Side-06b6d4?style=for-the-badge&logo=javascript&logoColor=white)](#how-it-works)

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-22c55e?style=flat-square)](CONTRIBUTING.md)

</div>

---

## What is HPOS?

**High-Performance Order Storage (HPOS)** is WooCommerce's new data architecture that stores orders in custom database tables instead of `wp_posts` and `wp_postmeta`. It became the **default in WooCommerce 9.4**, and the legacy `wp_posts` order storage is **deprecated** with removal targeted for late 2026.

If your plugin uses any of these patterns on order data, **it will break under HPOS**:

- `get_post( $order_id )`
- `get_post_meta( $order_id, '_key', true )`
- `update_post_meta( $order_id, '_key', $value )`
- `add_post_meta( $order_id, '_key', $value )`
- `delete_post_meta( $order_id, '_key' )`
- `new WP_Query( [ 'post_type' => 'shop_order' ] )`
- `get_posts( [ 'post_type' => 'shop_order' ] )`
- `$wpdb->get_results( "... post_type = 'shop_order' ..." )`
- `$wpdb->insert( $wpdb->posts, ... )`

## What HPOSKit does

Upload a plugin `.zip` file. HPOSKit scans every PHP file for HPOS incompatibility patterns, shows you exactly what's broken, and auto-patches what it can. Download the fixed plugin. All in your browser.

### Detection (10+ patterns)

| Pattern | Severity | Auto-Patchable | Replacement |
|---|---|---|---|
| `get_post( $order_id )` | Critical | Yes | `wc_get_order( $order_id )` |
| `get_post_meta( $order_id, 'key' )` | Warning | Yes | `wc_get_order( $order_id )->get_meta( 'key' )` |
| `add_post_meta( $order_id, 'key', $val )` | Critical | Yes | `$order->add_meta_data(); $order->save()` |
| `update_post_meta( $order_id, 'key', $val )` | Critical | Yes | `$order->update_meta_data(); $order->save()` |
| `delete_post_meta( $order_id, 'key' )` | Critical | Yes | `$order->delete_meta_data(); $order->save()` |
| `WP_Query` with `shop_order` | Critical | Yes | `wc_get_orders()` |
| `get_posts` with `shop_order` | Critical | Yes | `wc_get_orders()` |
| `$wpdb->get_results` on `shop_order` | Critical | Manual | Rewrite to `wc_get_orders()` |
| `$wpdb->insert/update/delete` on `wp_posts` | Critical | Manual | Use WC_Order CRUD |
| Deprecated order hooks (19 patterns) | Warning | Manual | Use object-oriented hooks |
| Missing `FeaturesUtil::declare_compatibility()` | Warning | Yes | Auto-injects declaration |
| Missing `WC tested up to` header | Info | Yes | Auto-injects header |

### Auto-patch examples

**Before:**
```php
$total = get_post_meta( $order_id, '_order_total', true );
update_post_meta( $order_id, '_custom_meta', $value );
```

**After:**
```php
$total = wc_get_order( $order_id )->get_meta( '_order_total', true );
$order = wc_get_order( $order_id ); $order->update_meta_data( '_custom_meta', $value ); $order->save();
```

**Compatibility declaration (auto-injected):**
```php
add_action( 'before_woocommerce_init', function() {
    if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
    }
} );
```

## How it works

1. **Upload** — Drag a plugin `.zip` onto the upload zone
2. **Scan** — Every PHP file is analyzed client-side for HPOS-breaking patterns
3. **Report** — See critical/warning/info issues with code snippets and fix suggestions
4. **Patch** — One-click auto-patch for all patchable issues
5. **Download** — Get the patched `.zip` ready to install

**No server. No upload. No tracking.** Everything runs in your browser using JSZip. Your plugin code never leaves your machine.

## Tech stack

- [Next.js 16](https://nextjs.org) — React framework
- [TypeScript](https://www.typescriptlang.org) — Type safety
- [Tailwind CSS](https://tailwindcss.com) — Styling
- [JSZip](https://stuk.github.io/jszip/) — Client-side zip processing
- [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) + [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) — Typography

## Development

```bash
git clone https://github.com/rynald0cst0ltziam/hposkit.git
cd hposkit
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploy

HPOSKit is a static Next.js app — deploy anywhere:

```bash
npm run build
```

Or one-click deploy to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/rynald0cst0ltziam/hposkit)

## Roadmap

- [ ] PHP AST-based scanning (currently regex-based)
- [ ] Batch scan multiple plugins
- [ ] WordPress.org plugin directory integration
- [ ] CI/CD GitHub Action for automated HPOS checks

## References

- [WooCommerce HPOS Documentation](https://woocommerce.com/document/high-performance-order-storage/)
- [WooCommerce HPOS Developer Guide](https://github.com/woocommerce/woocommerce/blob/trunk/docs/features/hpos.md)
- [Webkul: Making Plugins HPOS Compatible](https://webkul.com/blog/woocommerce-plugin-high-performance-order-storage-compatible/)

## License

MIT

## Support

If HPOSKit saved you debugging time, consider [supporting rynald0s](https://www.paypal.com/paypalme/rynald0s).

<div align="center">

☕ [\$5](https://www.paypal.com/paypalme/rynald0s/5) · [\$10](https://www.paypal.com/paypalme/rynald0s/10) · [\$25](https://www.paypal.com/paypalme/rynald0s/25) · [Custom](https://www.paypal.com/paypalme/rynald0s)

</div>
