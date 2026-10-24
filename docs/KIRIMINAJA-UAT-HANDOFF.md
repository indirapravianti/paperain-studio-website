# KiriminAja UAT — where we stopped (2026-10-24)

Branch: `kiriminaja-uat-ka-credit`. Nothing here is on `main` or deployed yet.

## TL;DR

UAT rows 1–3 pass. Everything after that needs an AWB, and the sandbox won't issue one:

- **Without KA Credit**, `request_pickup` creates a QRIS bill and holds the AWB until it is paid. The sandbox QR can't be paid.
- **With KA Credit** (`payment_method: "credit"` + `pin`), every request is rejected with `Unable to proceed, pin invalid`, even after changing the PIN twice in the dashboard. The PIN may now be locked (max 3 attempts).

**Waiting on KiriminAja IT** (message drafted below). Do not retry the PIN until they answer.

## UAT status (docs/UAT-KIRIMINAJA.md section 3)

| Row | Feature | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Authentication | Pass | OAuth + Bearer from local `.env` works |
| 2 | Coverage / Service | Pass | DKI Jakarta → Jakarta Selatan → Setia Budi (2111) → Karet Semanggi (17578) |
| 3 | Pricing | Pass | 17 rates; SiCepat REG Rp19.000 for both parcels |
| 4 | Non-COD, actual weight heavier | Blocked | 4 keychains: 170 g actual vs 150 g volumetric (15×20×3 cm) |
| 6 | Non-COD, volumetric heavier | Blocked | 1 sticker sheet: 100 g actual vs 150 g volumetric |
| 12 | KA Credit | Blocked | `pin invalid` |
| 13 | Label | Blocked | needs AWB |
| 14 | Tracking | Blocked | needs AWB |
| 15 | Webhook | Ready | callback registered 2026-10-17 to `https://www.paperainstudio.com/api/kiriminaja-webhook` |
| 16 | Cancel | Blocked | needs AWB |
| 5, 7–11 | Insurance / COD | N/A | |

Raw API responses are in `docs/uat-evidence/`.

## What's on this branch

| Commit / file | What it does |
| --- | --- |
| `lib/api/kiriminaja.js` | `setCallback`, `getPayment`, `getCreditBalance` (GET), `validatePin`; `request_pickup` sends `payment_method` + `pin` when `KIRIMINAJA_PAYMENT_METHOD=credit` |
| `lib/api/kiriminaja-shipment-handler.js` | Skips `request_pickup` if the order already has a pickup number. Midtrans sends several "paid" notifications and KiriminAja rejected the second one (`1 paket tidak bisa diproses ulang`) |
| `scripts/kiriminaja-set-callback.mjs` | `check`, `register`, `payment <pickup_number>`, `balance`, `pin` |
| `scripts/kiriminaja-uat-local.mjs` | Runs UAT locally against the sandbox, no website or Supabase: `quote`, `pickup [actual-heavier\|volume-heavier]`, `check <awb>...` |
| `.env.example`, `docs/UAT-KIRIMINAJA.md` | New env vars documented; KA Credit moved into UAT scope |

## Facts found along the way

- Sandbox KA Credit balance: **Rp500.000**, unchanged by all failed attempts.
- The production-site test order `PPRS-261017-971234` has pickup `EPR-1260861201`, bill Rp19.000, status `5` "Billing siap dibayar" (unpaid), so no AWB.
- `POST /api/mitra/v6.2/pin/validate` returns `Unable to find your endpoint target` on the sandbox.
- `KIRIMINAJA_ORIGIN_NAME` is `paperain studio` (15 chars); the v6.2 spec allows 8–14. Local runs override it to `PaperainStudio`. Change it in `.env` and Vercel before going live.
- Supabase prices were fixed on 2026-10-23 (`price_idr` now holds the category prices).

## When KiriminAja answers

1. Put the working PIN in `.env` as `KIRIMINAJA_PIN=` (never commit it).
2. From the repo root (PowerShell users: run in Git Bash, or set the env vars first):

```bash
KIRIMINAJA_PAYMENT_METHOD=credit KIRIMINAJA_ORIGIN_NAME=PaperainStudio node --env-file=.env scripts/kiriminaja-uat-local.mjs pickup actual-heavier
```

3. If an AWB comes back, run `pickup volume-heavier`, then `check <awb1> <awb2>` for label and tracking.
4. Screenshot the label PDF for UAT section 4. Cancel one AWB from the admin page (row 16) once the branch is deployed.
5. To go live: merge this branch, set `KIRIMINAJA_PAYMENT_METHOD=credit`, `KIRIMINAJA_PIN` and the 14-char `KIRIMINAJA_ORIGIN_NAME` in Vercel, then redeploy.

If they offer a way to pay sandbox QRIS bills instead, KA Credit isn't needed for UAT. Leave `KIRIMINAJA_PAYMENT_METHOD` unset, pay the bill, and the AWB arrives on the webhook.

## Message for KiriminAja IT

> Halo tim KiriminAja,
>
> Kami (paperain studio) sedang UAT MitraAPI di sandbox (`tdev.kiriminaja.com`). Saldo KA Credit sandbox kami Rp500.000. Setiap `POST /api/mitra/v6.2/request_pickup` dengan `payment_method: "credit"` dan `pin` 6 digit selalu mengembalikan "Unable to proceed, pin invalid", termasuk setelah PIN diganti di dashboard (23 Oktober 2026 sekitar 15:10–15:26 WIB, dan 24 Oktober 2026 sekitar 10:07 WIB). Endpoint `POST /api/mitra/v6.2/pin/validate` di sandbox mengembalikan "Unable to find your endpoint target".
>
> 1. Bagaimana cara mengatur PIN KA Credit yang berlaku untuk API sandbox?
> 2. Apakah PIN kami terkunci karena percobaan gagal? Jika ya, mohon di-reset.
> 3. Jika KA Credit tidak bisa dipakai di sandbox, bagaimana cara menyimulasikan pembayaran tagihan QRIS (misalnya `EPR-1260861201`) agar AWB terbit untuk UAT?
>
> Terima kasih.

## Other open items

- Region dropdown "Oops" errors at checkout. Idea not tried yet: `"regions": ["sin1"]` in `vercel.json` (check the Supabase region first).
- Change the `test@admin.com` password; optionally rotate `KIRIMINAJA_MITRA_API_KEY`.
