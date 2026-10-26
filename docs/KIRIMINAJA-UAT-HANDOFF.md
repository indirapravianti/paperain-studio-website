# KiriminAja UAT — where we are (2026-10-26)

Branch: `kiriminaja-uat-ka-credit`. Nothing here is on `main` or deployed yet.

## TL;DR

With a new KA Credit PIN in `.env`, the sandbox pickups go through. Rows 1–4, 6 and 12–14 pass. Both test parcels were paid from KA Credit and got an AWB, a label and tracking.

Still open:

- **Row 16 (cancel)** needs the branch deployed so it can be done from the admin page.
- **Label weight** (see below): the label prints the item weight, not the package weight we send. Worth confirming with KiriminAja before sign-off.

The 2026-10-24 `pin invalid` problem was the PIN itself. No message to KiriminAja IT is needed for it anymore.

## UAT status (docs/UAT-KIRIMINAJA.md section 3)

| Row | Feature | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Authentication | Pass | OAuth + Bearer from local `.env` works |
| 2 | Coverage / Service | Pass | DKI Jakarta → Jakarta Selatan → Setia Budi (2111) → Karet Semanggi (17578) |
| 3 | Pricing | Pass | 17 rates; SiCepat REG Rp19.000 for both parcels |
| 4 | Non-COD, actual weight heavier | Pass | 4 keychains: 170 g actual vs 150 g volumetric (15×20×3 cm). Order `PPRS-261026-911450`, pickup `EPR-3213965383`, AWB `MOCK-PPRS-261026-911450` |
| 6 | Non-COD, volumetric heavier | Pass | 1 sticker sheet: 100 g actual vs 150 g volumetric. Order `PPRS-261026-916073`, pickup `EPR-5603687626`, AWB `MOCK-PPRS-261026-916073` |
| 12 | KA Credit | Pass | Both pickups `payment_status: "paid"`, payment method `credit`, "Pembayaran berhasil", Rp19.000 each. Balance Rp500.000 → Rp462.000 |
| 13 | Label | Pass | Label PDFs saved: `kiriminaja-label-MOCK-PPRS-261026-911450.pdf`, `kiriminaja-label-MOCK-PPRS-261026-916073.pdf` |
| 14 | Tracking | Pass | Both AWBs: status 105 "Menunggu Pickup" |
| 15 | Webhook | Ready | callback registered 2026-10-17 to `https://www.paperainstudio.com/api/kiriminaja-webhook` |
| 16 | Cancel | Blocked | needs the branch deployed (admin page) |
| 5, 7–11 | Insurance / COD | N/A | |

Raw API responses are in `docs/uat-evidence/` (today's: `kiriminaja-pickup-2026-10-26T06-*`, `kiriminaja-check-2026-10-26T06-21-33-063Z.json`).

## Label weight doesn't match the package weight

The label's "Berat" is the sum of the item lines (`items[].weight × qty`), not the package `weight` we send:

| Parcel | Package `weight` sent | Label "Berat" |
| --- | --- | --- |
| Row 4, 4 keychains | 170 g (items 4 × 30 g + 50 g packaging) | 120 g |
| Row 6, 1 sticker sheet | 150 g chargeable (10 g + 50 g packaging, min 100 g; volumetric 150 g) | 10 g |

Both were billed Rp19.000, SiCepat's 1 kg minimum, so these tests can't show which weight KiriminAja bills on. A UAT reviewer may still question it because rows 4 and 6 are about weight. Options:

1. Ask KiriminAja which field drives billing and the label (message below).
2. Spread the packaging weight across the item lines so they add up to the package weight. The same item lines are built in `scripts/kiriminaja-uat-local.mjs` and in the checkout / Midtrans webhook shipment code, so change both.

## What's on this branch

| Commit / file | What it does |
| --- | --- |
| `lib/api/kiriminaja.js` | `setCallback`, `getPayment`, `getCreditBalance` (GET), `validatePin`; `request_pickup` sends `payment_method` + `pin` when `KIRIMINAJA_PAYMENT_METHOD=credit` |
| `lib/api/kiriminaja-shipment-handler.js` | Skips `request_pickup` if the order already has a pickup number. Midtrans sends several "paid" notifications and KiriminAja rejected the second one (`1 paket tidak bisa diproses ulang`) |
| `scripts/kiriminaja-set-callback.mjs` | `check [order_id]`, `register`, `payment <pickup_number>`, `balance`, `pin` |
| `scripts/kiriminaja-uat-local.mjs` | Runs UAT locally against the sandbox, no website or Supabase: `quote`, `pickup [actual-heavier\|volume-heavier]`, `check <awb>...` |
| `.env.example`, `docs/UAT-KIRIMINAJA.md` | New env vars documented; KA Credit moved into UAT scope |

## Facts found along the way

- `request_pickup` returns `awb: ""` even when paid. The AWB (`MOCK-<order_id>` on the sandbox) shows up in tracking a few seconds later. Use `kiriminaja-set-callback.mjs check <order_id>` to read it.
- Label URLs are signed Google Storage links that expire after 1 hour. Download the PDF straight away.
- The sandbox still throws intermittent "Oops" errors on `/api/mitra/kecamatan`. A retry a minute later worked. It fails before `request_pickup`, so nothing is charged.
- The production-site test order `PPRS-261017-971234` has pickup `EPR-1260861201`, bill Rp19.000, status `5` "Billing siap dibayar" (unpaid QRIS), so no AWB. It was created before KA Credit was on.
- `POST /api/mitra/v6.2/pin/validate` returns `Unable to find your endpoint target` on the sandbox, so test the PIN with a real pickup.
- `KIRIMINAJA_ORIGIN_NAME` is `paperain studio` (15 chars); the v6.2 spec allows 8–14. Local runs override it to `PaperainStudio`. Change it in `.env` and Vercel before going live.
- Supabase prices were fixed on 2026-10-23 (`price_idr` now holds the category prices).

## Re-running UAT

From the repo root (PowerShell users: run in Git Bash, or set the env vars first). `KIRIMINAJA_PIN` must be in `.env` (never commit it):

```bash
KIRIMINAJA_PAYMENT_METHOD=credit KIRIMINAJA_ORIGIN_NAME=PaperainStudio node --env-file=.env scripts/kiriminaja-uat-local.mjs pickup actual-heavier
KIRIMINAJA_PAYMENT_METHOD=credit KIRIMINAJA_ORIGIN_NAME=PaperainStudio node --env-file=.env scripts/kiriminaja-uat-local.mjs pickup volume-heavier
node --env-file=.env scripts/kiriminaja-set-callback.mjs check <order_id>
node --env-file=.env scripts/kiriminaja-uat-local.mjs check <awb1> <awb2>
```

Each pickup spends Rp19.000 of sandbox KA Credit.

## Next steps

1. Settle the label weight question (above).
2. Deploy the branch and cancel one of today's AWBs from the admin page (row 16).
3. To go live: merge this branch, set `KIRIMINAJA_PAYMENT_METHOD=credit`, the production `KIRIMINAJA_PIN` and the 14-char `KIRIMINAJA_ORIGIN_NAME` in Vercel, then redeploy. Use a PIN that isn't a simple digit sequence.

## Message for KiriminAja (label weight)

> Halo tim KiriminAja,
>
> UAT MitraAPI kami di sandbox sudah berhasil sampai label dan tracking dengan KA Credit. Satu pertanyaan soal berat: pada `request_pickup` kami mengirim `weight` paket (termasuk kemasan, atau berat volumetrik jika lebih besar), misalnya 170 g untuk `PPRS-261026-911450` dan 150 g untuk `PPRS-261026-916073`. Namun label menampilkan berat dari `items` saja (120 g dan 10 g).
>
> 1. Berat mana yang dipakai untuk tagihan ongkir: `weight` paket atau total `items[].weight`?
> 2. Apakah `items[].weight` harus dijumlahkan sama dengan `weight` paket?
>
> Terima kasih.

## Other open items

- Region dropdown "Oops" errors at checkout. Idea not tried yet: `"regions": ["sin1"]` in `vercel.json` (check the Supabase region first).
- Change the `test@admin.com` password; optionally rotate `KIRIMINAJA_MITRA_API_KEY`.
