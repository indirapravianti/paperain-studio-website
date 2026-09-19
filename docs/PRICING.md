# Paperain Studio — Pricing (Indonesia / IDR)

The store runs **IDR only**. All prices on the website, checkout, and Midtrans payments use Indonesian Rupiah.

## Product prices (by category)

| Category | Price |
|----------|-------|
| Sticker sheet | Rp 13,000 |
| Keychain | Rp 20,000 |
| Griptok | Rp 27,000 |
| Art print | Rp 10,000 |
| Greeting card | Rp 14,000 |
| Postcard | Rp 10,000 |
| Phone strap | Rp 22,000 |

Source of truth for display: `src/lib/idr-prices.js` and `lib/api/region-pricing.js`.

## Order rules

| Rule | Value |
|------|-------|
| Shipping | KiriminAja courier rates by province/city/district (falls back to flat Rp 48,000 if `KIRIMINAJA_TOKEN` isn't configured — see `.env.example`) |
| Volume discount | 20% off when subtotal ≥ Rp 80,000 |
| Payment | Midtrans (IDR) |
| Shipping coverage | Indonesia only (for now) |

Shipping fee is quoted live at checkout (`/api/shipping-rate`) and re-verified server-side against
KiriminAja at order placement (`lib/api/place-order-handler.js`) — the client-selected courier is never
trusted for the charged amount. Per-category package weights live in `lib/api/shipping-weight.js`.

## Updating prices

1. Update `src/lib/idr-prices.js` (frontend display)
2. Update `lib/api/region-pricing.js` (server checkout validation)
3. Update `price_idr` in Supabase `products` table or re-run `node supabase/seed-products.mjs`
4. Rebuild and deploy

---

*International (USD) pricing may be added later. There is no IP-based or `/id/` URL routing in the current setup.*
