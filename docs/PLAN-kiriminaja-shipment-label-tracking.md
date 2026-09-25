# KiriminAja Shipping — Follow-up: Create Shipment, Label, Tracking

## Context

The payment page now lets customers pick a real courier and price (previous phase, already shipped on `feature/kiriminaja-shipping-payment-page`). That phase deliberately stopped short of actually booking the shipment with KiriminAja — this plan covers the rest of the Wajib (required) UAT items: **Create Paket Non-COD** (get a real AWB), **Label Pengiriman**, and **Tracking**. COD, insurance, KA Credit, webhook/callback, and cancel/void remain out of scope (all "Tidak Wajib" in the UAT doc, and not requested here).

Decisions already made with the user:
- **Geolocation** (required, non-nullable field for order creation): geocode destination addresses automatically via OpenStreetMap Nominatim (free, no key); origin lat/long is a one-time env var you provide.
- **Tracking**: on-demand lookup (call KiriminAja's tracking endpoint live when a customer/admin views the order) — no public webhook receiver needed.
- **Label**: we render our own printable label page (KiriminAja's docs describe the label as merchant-rendered — logo, AWB barcode, sorting code, etc. — not a hosted PDF; the create-order response schema also isn't documented, so we can't assume a ready-made label URL exists).

**When the shipment gets created**: right after Midtrans confirms payment (`orders.status` → `'confirmed'`), in [lib/api/midtrans-notification-handler.js:125](../../Documents/hh/website/paperain-studio-website/lib/api/midtrans-notification-handler.js:125) — the exact spot that already triggers the confirmation email. This is the single authoritative place status flips to "paid"; there's no Postgres/pg_net webhook infrastructure in this repo, so it follows the existing in-process pattern (`sendOrderConfirmationEmail`), not a DB trigger.

## 1. Database changes — `supabase/patch-010-shipment-tracking.sql`

```sql
alter table public.orders
  add column if not exists shipment_awb text,
  add column if not exists shipment_created_at timestamptz,
  add column if not exists shipment_error text,
  add column if not exists shipment_response jsonb;
```

`shipment_created_at` is the idempotency guard (same role as `receipt_sent_at`), not a display timestamp. `shipment_response` stores the raw KiriminAja response so we can inspect real field names once we've made a live call and adjust extraction if needed.

## 2. New env vars (add to `.env.example`, blank)

```
KIRIMINAJA_ORIGIN_ADDRESS=
KIRIMINAJA_ORIGIN_PHONE=
KIRIMINAJA_ORIGIN_NAME=
KIRIMINAJA_ORIGIN_ZIPCODE=
KIRIMINAJA_ORIGIN_LAT=
KIRIMINAJA_ORIGIN_LNG=
```
(`KIRIMINAJA_ORIGIN_KECAMATAN_ID`/`KELURAHAN_ID` already exist from the pricing phase.)

## 3. Geocoding — `lib/api/geocoding.js` (new)

```js
export async function geocodeAddress(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=id&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'paperain-studio-website (orders@paperainstudio.com)' } });
  if (!res.ok) return null;
  const results = await res.json();
  return results[0] ? { lat: Number(results[0].lat), lon: Number(results[0].lon) } : null;
}
```
Called with `order.shipping_address + ', Indonesia'`. If it returns nothing, fall back to the origin's own coordinates and proceed anyway — most couriers don't strictly require precise geolocation (the pricing response already carries a `use_geolocation` flag per service), and a failed shipment is visible via `shipment_error` either way.

## 4. Package dimensions helper — extend `lib/api/pricing.js`

Alongside the existing `resolvePackageWeight`, add `resolvePackageDimensions(supabase, lines)` that selects `width_cm, height_cm, length_cm` for the line's products and returns the **max of each dimension** across lines (a simple, conservative single-box approximation — flagged here as a known simplification, not real packing logic). Add matching `DEFAULT_WIDTH_CM`/`HEIGHT_CM`/`LENGTH_CM` constants to `lib/market.js` (10/5/15, matching the patch-009 column defaults) for the catalog-fallback path.

## 5. KiriminAja shipment creation — extend `lib/api/kiriminaja.js`

Add `createKiriminajaShipment({ orderId, courierCode, serviceType, shippingCost, weightGrams, dims, itemValue, destination, items })`, POSTing to `/api/mitra/v6.2/request_pickup` ([docs/docs/4.order/1.express.md](../../Documents/hh/website/docs/docs/4.order/1.express.md)):
- Sender block from `KIRIMINAJA_ORIGIN_*` env vars (address, phone, name, zipcode, kecamatan/kelurahan id, lat/lng), `schedule` defaulted to **tomorrow 10:00:00** (`YYYY-MM-DD HH:mm:ss`) — no pickup-time picker exists yet, so this is a fixed assumption, not admin-configurable in this pass.
- One package per order (not per line item) with `cod: 0`, `insurance_amount: 0` (Non-COD only, per scope), `package_type_id: 7` (the value used in the docs' own example — not otherwise explained; verify with KiriminAja once live).
- `items[]` mapped 1:1 from the order's `order_items`.
- Returns `{ ok, data }` like the existing pricing/coverage calls. The response shape isn't documented, so the caller stores the raw JSON and defensively probes a few likely paths (`data.awb`, `data.data?.awb`, `data.data?.[0]?.awb`) for the AWB — logged clearly if none match, so we can fix the extractor after seeing one real response.

## 6. Idempotent wrapper — `lib/api/kiriminaja-shipment.js` (new)

`createShipmentForOrder(supabase, orderId)`, mirroring the atomic-claim pattern in [lib/api/send-order-email.js](../../Documents/hh/website/paperain-studio-website/lib/api/send-order-email.js):
1. Atomically claim: `UPDATE orders SET shipment_created_at = now() WHERE id = orderId AND status = 'confirmed' AND shipment_created_at IS NULL RETURNING *, order_items(*)`. No row → already processed or not confirmed → skip.
2. Resolve weight/dims/item value the same way `place-order-handler.js` already verifies shipping cost (reuse `priceCartItems`-derived lines is not needed here — read straight from `order_items` since the order is already priced; just need weight/dims per product).
3. Geocode `claimed.shipping_address`; fall back to origin coords on failure.
4. Call `createKiriminajaShipment(...)`.
5. On success: `UPDATE orders SET shipment_awb, shipment_response, shipment_error = null`.
6. On failure: `UPDATE orders SET shipment_error = <message>, shipment_created_at = null` (clears the claim so a retry — automatic webhook redelivery or the admin "retry" button below — can attempt again).

## 7. Hook into the webhook handler

In [lib/api/midtrans-notification-handler.js](../../Documents/hh/website/paperain-studio-website/lib/api/midtrans-notification-handler.js), inside the existing `if (newStatus === 'confirmed')` block (line 125), call `createShipmentForOrder(supabase, order.id)` before the email send — log success/failure the same way the email result is already logged. Failures never block the webhook response (Midtrans just needs a 200).

## 8. Tracking endpoint — `api/shipping-tracking.js` → `lib/api/shipping-tracking-handler.js` (new)

`POST { order_id }`: looks up the order's `shipment_awb` (fallback to the order id itself, since KiriminAja's tracking endpoint accepts either per [docs/docs/4.order/5.tracking.md](../../Documents/hh/website/docs/docs/4.order/5.tracking.md)), calls `POST /api/mitra/tracking`, and returns a trimmed `{ text, delivered, histories: [{ created_at, status }] }` to the frontend. No new auth layer — same trust model as the existing `/api/create-payment` (relies on the order UUID being unguessable), consistent with the rest of this codebase.

## 9. Admin manual retry — `api/shipping-create-shipment.js` (new)

Thin endpoint calling `createShipmentForOrder` directly, for the admin page's "create shipment" button (covers: automatic creation failed, or an order was confirmed before this feature existed). Same trust model as above.

## 10. Frontend — customer order page, [src/pages/account/order.astro](../../Documents/hh/website/paperain-studio-website/src/pages/account/order.astro)

New "shipment" card, same `border border-gray-100 rounded-xl p-5 mb-6` pattern, inserted between "shipping information" (line 103) and "notes" (line 106):
- If `order.shipment_awb` exists: courier name, AWB, a "track package" button that calls `/api/shipping-tracking` and renders the latest status + history list inline, and a "view / print label" link to a new label page.
- Else if `order.status === 'confirmed'`: "preparing your shipment..." placeholder.
- Else if `order.shipment_error`: generic "there was an issue preparing your shipment, we've been notified" (never show the raw error to the customer).

## 11. New printable label page — `src/pages/account/label.astro` (new)

Fetches the order the same way `order.astro` does (direct Supabase REST + the customer's own token, RLS-scoped). Renders a clean, print-only label with the UAT-required fields ([docs/docs/2.important-notes/1.shipping-label.md](../../Documents/hh/website/docs/docs/2.important-notes/1.shipping-label.md)): courier name + service type (as text, not a logo image), AWB as a Code128 barcode (via the `jsbarcode` CDN script, `https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js` — small, dependency-free, matches the "external scripts from a CDN" convention already used for Midtrans's Snap.js), shipping type (Non-COD, since COD is out of scope), sender/recipient name/phone/address/postal code, weight, item qty + list, origin/destination city, and the order's `display_id` as the order-ref label. A `<style is:global>@media print{...}</style>` block hides the shared nav/footer only while printing this page.

To avoid duplicating the label markup between this page and the admin page (next section), the label-building function (`renderShippingLabelHtml(order, items)` → HTML string with a barcode placeholder element) is added as one more shared helper in [src/layouts/Layout.astro](../../Documents/hh/website/paperain-studio-website/src/layouts/Layout.astro)'s existing global inline script, next to `formatPrice`/`getShippingFee` — consistent with how those are already shared across pages. Each consuming page loads the JsBarcode CDN script itself and calls `JsBarcode('.barcode-el').init()` after inserting the returned HTML.

## 12. Frontend — admin page, [src/pages/admin/orders.astro](../../Documents/hh/website/paperain-studio-website/src/pages/admin/orders.astro)

In each order card (inside the existing per-order template, around line 218): show courier/AWB info when present; a "create shipment" button when `status === 'confirmed'` and no AWB yet (calls `/api/shipping-create-shipment`, then reloads); a "track" action reusing the same `/api/shipping-tracking` call; and a "view label" link. Admin renders the label inline (reusing the same shared `renderShippingLabelHtml` helper with the order object it already has in memory) rather than reusing the customer's RLS-scoped label page, since admin's Supabase RLS access pattern for arbitrary customers' orders isn't verified to extend to that page.

## Known simplifications (documented, not hidden)

- One box per order, dimensions = max per-axis across line items — not real multi-item packing.
- Destination geolocation is best-effort geocoding from the free-text address, not a verified pin.
- Pickup `schedule` is a fixed "tomorrow 10:00" — no scheduling UI yet.
- `package_type_id: 7` copied from the docs' own example; unconfirmed meaning.
- AWB extraction from the create-order response is a best-guess (undocumented schema) — `shipment_response` keeps the raw payload so this is easy to fix once we see a real response.

## Still out of scope

COD, insurance, KA Credit payment, push webhook/callback receiver, cancel/void — all "Tidak Wajib" in the UAT doc and not requested in this pass.

## Verification

1. Run `supabase/patch-010-shipment-tracking.sql`.
2. Fill in the new `KIRIMINAJA_ORIGIN_*` env vars (address/phone/name/zipcode/lat/lng) plus the already-configured `KIRIMINAJA_API_KEY`.
3. Complete a full checkout → payment → Midtrans sandbox payment (settlement). Confirm `orders.status` flips to `confirmed` and, within the same webhook call, `shipment_awb` gets populated (check `shipment_response`/`shipment_error` in Supabase either way).
4. On the customer's order page: confirm the shipment card shows the AWB, "track package" returns real KiriminAja sandbox tracking data, and the label page renders a scannable Code128 barcode with all Wajib fields from the UAT checklist — screenshot it for [docs/UAT-KIRIMINAJA.md](../../Documents/hh/website/paperain-studio-website/docs/UAT-KIRIMINAJA.md) section 4.
5. On the admin page: confirm courier/AWB display, and that "create shipment" on an order that failed automatically (e.g. temporarily unset `KIRIMINAJA_ORIGIN_ADDRESS` to force a failure, then restore it and click retry) successfully creates the shipment on retry.
