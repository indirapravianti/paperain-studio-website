# KiriminAja UAT — full checklist and screenshot guide

Status as of 2026-10-26. The form itself is [`UAT-KIRIMINAJA.md`](UAT-KIRIMINAJA.md). Background is in [`KIRIMINAJA-UAT-HANDOFF.md`](KIRIMINAJA-UAT-HANDOFF.md).

**Legend:** ✅ done · 🟡 done by API only, still needs a website screenshot · ⬜ not done · ➖ N/A

---

## Part A — everything the UAT asks for

### Section 1: document info

| Field | Status | Notes |
| --- | --- | --- |
| Brand / merchant | ✅ | paperain studio |
| PIC name, email, phone | ⬜ | You fill these in |
| Environment | ✅ | Sandbox MitraAPI |
| UAT date | ⬜ | The day you take the screenshots |
| Document version | ✅ | V 1.0 |

### Section 2: scope (tick "Diuji" or "N/A")

| Feature | Tick | Status |
| --- | --- | --- |
| Authentication | Diuji | ⬜ tick |
| Coverage / courier service | Diuji | ⬜ tick |
| Pricing | Diuji | ⬜ tick |
| Create package Non-COD | Diuji | ⬜ tick |
| Create package COD | N/A | ✅ already ticked |
| Create package insurance | N/A | ⬜ tick (not tested; only used for JNE above Rp500.000) |
| Create package KA Credit | Diuji | ⬜ tick |
| Shipping label | Diuji | ⬜ tick |
| Tracking | Diuji | ⬜ tick |
| Webhook / callback | Diuji | ⬜ tick after screenshot S8 |
| Cancel / void | Diuji | ⬜ tick after screenshot S9 |

### Section 3: test results

| Row | Feature | Required? | API test | Website screenshot | Screenshot step |
| --- | --- | --- | --- | --- | --- |
| 1 | Authentication | Yes | ✅ | 🟡 (no screen of its own) | S2 proves it |
| 2 | Coverage / service | Yes | ✅ | ⬜ | S2 |
| 3 | Pricing | Yes | ✅ | ⬜ | S3 |
| 4 | Non-COD, actual weight heavier | Yes | ✅ | ⬜ | S3, S5 (order A) |
| 5 | Non-COD + insurance, actual heavier | No | ➖ | ➖ | — |
| 6 | Non-COD, volumetric heavier | Yes | ✅ | ⬜ | S3, S5 (order B) |
| 7 | Non-COD + insurance, volumetric heavier | No | ➖ | ➖ | — |
| 8–11 | COD (with or without insurance) | No | ➖ | ➖ | — |
| 12 | KA Credit | No | ✅ | ⬜ | S6 |
| 13 | Label | Yes | ✅ | ⬜ | S7 |
| 14 | Tracking | Yes | ✅ | ⬜ | S8 |
| 15 | Webhook | No | ⬜ never confirmed | ⬜ | S5 + S10 |
| 16 | Cancel / void | No | ⬜ | ⬜ | S9 |

### Section 4: label evidence

| Item | Status | Notes |
| --- | --- | --- |
| Table (order ID, AWB, courier, Non-COD, source) | ⬜ | Fill from order A after S7 |
| Label screenshot | ⬜ | S7 |
| Checklist: courier logo, service, AWB barcode (128A), AWB text, Non-COD, sender and recipient, quantity, origin and destination city, order ref | ✅ | On the KiriminAja PDF |
| Checklist: sender address | ⚠️ by choice | Both labels print the sender as name, phone, "Kabupaten Sleman, DI Yogyakarta", not the street address (privacy; KiriminAja's own PDF does the same). Note it in "Catatan Validasi Label": *alamat lengkap pengirim tidak dicetak demi privasi, mengikuti format label KiriminAja; alamat pickup lengkap tersimpan di sistem KiriminAja.* |
| Checklist: **sorting code** | ⬜ | Not on the sandbox PDF (tracking returned none). Our member label shows it from tracking, or "pending" if the sandbox has none |
| Checklist: **item price** | ⬜ | Not on the KiriminAja PDF. It is on our member label |
| Checklist: **weight** | ⚠️ | The PDF shows item weight (120 g / 10 g), not the package weight we send. Question pending with KiriminAja (see handoff note) |

### Upload rules

| Item | Status |
| --- | --- |
| Export the form as a PDF, 10 MB or less | ⬜ |
| No full API key or secret visible in any screenshot | ⬜ check before export |

---

## Part B — before you take screenshots (once)

The KA Credit code is only on this branch. The website, Midtrans notifications and the KiriminAja webhook all point to `www.paperainstudio.com`, so the screenshots need this branch **live on production** (still sandbox Midtrans and sandbox KiriminAja).

- [ ] **Merge** `kiriminaja-uat-ka-credit` into `main` and let Vercel deploy.
- [ ] **Vercel → Settings → Environment Variables (Production)**, add or change:
  - `KIRIMINAJA_PAYMENT_METHOD` = `credit`
  - `KIRIMINAJA_PIN` = the KA Credit PIN (same as in `.env`)
  - `KIRIMINAJA_ORIGIN_NAME` = `PaperainStudio` (8–14 characters; the current `paperain studio` is 15)
  - then **Redeploy**.
- [ ] Check `supabase/patch-011-kiriminaja-uat.sql` has been run in Supabase (SQL editor).
- [ ] KA Credit balance is enough: about Rp19.000 per order. It's Rp462.000 now. Check with:

```bash
node --env-file=.env scripts/kiriminaja-set-callback.mjs balance
```

- [ ] Webhook is registered (done 2026-10-17). Re-check only if unsure:

```bash
node --env-file=.env scripts/kiriminaja-set-callback.mjs register
```

**Screenshot tips:** use Windows `Win + Shift + S`. Name files by step, e.g. `S3-pricing-orderA.png`. Crop out the browser address bar if it shows anything private. Never capture `.env`, Vercel env values or API keys.

---

## Part C — screenshots, step by step

You place **two orders** on the live site:

| | Cart | Covers |
| --- | --- | --- |
| **Order A** | 4 keychains | Row 4: actual weight (170 g) heavier than volume (150 g) |
| **Order B** | 1 sticker sheet | Row 6: volume (150 g) heavier than actual (100 g) |

Use the same test address for both: DKI Jakarta → Jakarta Selatan → Setia Budi → Karet Semanggi, postcode 12930.

### S1 — add to cart
- [ ] Go to `www.paperainstudio.com/products`, add **4 keychains** to the cart (order A). Go to checkout.
- No screenshot needed.

### S2 — coverage (rows 1, 2)
- [ ] On checkout, fill name, phone, address. Pick **province → city → district → kelurahan** from the dropdowns.
- [ ] 📸 Screenshot the address section with all four dropdowns filled.
- This also proves authentication (row 1): the dropdowns come live from the KiriminAja API.

### S3 — pricing (rows 3, 4 / 6)
- [ ] Wait for **shipping courier** to load. Under the list it says `chargeable … g (actual … g, volume … g)`.
- [ ] 📸 Screenshot the courier list **including that weight line**.
  - Order A should show actual **170 g**, volume **150 g** → row 4.
  - Order B should show actual **100 g**, volume **150 g** → row 6.
- [ ] Pick **SiCepat REG** (or any courier), continue to payment.

### S4 — pay with Midtrans sandbox
- [ ] On the Midtrans Snap popup, pay with the sandbox test card: `4811 1111 1111 1114`, CVV `123`, any future expiry, OTP `112233`.
  - Or choose QRIS / GoPay and pay it at `simulator.sandbox.midtrans.com`.
- [ ] 📸 Optional: the "payment success" screen.

**Repeat S1–S4 for order B** (1 sticker sheet). Then go on with both orders.

### S5 — order created with AWB (rows 4, 6, 15)
- [ ] Sign in as admin, open **`/admin/orders`**, click **refresh**.
- [ ] Each order should show the courier and a green **`AWB MOCK-…`** badge. The AWB arrives through the KiriminAja webhook, usually within a minute.
- [ ] If an order still shows **"no AWB yet"**, click its **fetch AWB** button. It reads the AWB from KiriminAja tracking (it never requests a second pickup). If it says the AWB isn't issued yet, wait a minute and click again.
- [ ] 📸 Screenshot both order rows showing the AWB.
- Note for row 15: if you had to use **fetch AWB**, the webhook didn't deliver the AWB. Check S10 before ticking row 15.

### S6 — KA Credit (row 12)
- [ ] Log in to the **KiriminAja sandbox dashboard** (where you changed the PIN). Open the KA Credit balance / transaction history.
- [ ] 📸 Screenshot showing the two Rp19.000 deductions for your order IDs (or the balance going down by Rp38.000).
- Backup evidence if the dashboard has no history: run `node --env-file=.env scripts/kiriminaja-set-callback.mjs payment <pickup_number>` and screenshot the output showing `"method": "credit"`, `"Pembayaran berhasil"`.

### S7 — label (row 13, section 4)
- [ ] On order A's row, click **label**. A new tab opens `/admin/label`.
- [ ] 📸 Screenshot our **member label card** (it has sorting code, item names and prices, weight, qty, order ref barcode).
- [ ] Click **KiriminAja PDF** (top of the page). Open it right away; the link expires after 1 hour.
- [ ] 📸 Screenshot the KiriminAja PDF label.
- [ ] Fill the section 4 table: order ID, AWB, `SiCepat REG`, Non-COD, source **API** (PDF) and **Sistem Member** (our card).
- [ ] Optional: repeat for order B.

### S8 — tracking (row 14)
- [ ] Back on `/admin/orders`, click **track** on order A.
- [ ] 📸 Screenshot the popup (it shows e.g. **"Menunggu Pickup"**).

### S9 — cancel (row 16) — do this last, on order B only
- [ ] On **order B**, click **cancel**, type a reason of at least 5 characters (e.g. `UAT test cancel`), OK.
- [ ] 📸 Screenshot the **"cancel requested"** popup.
- [ ] Click **track** on order B again. 📸 Screenshot the status after cancel.
- If it says `cancel failed: …`, screenshot that too and send Claude the message. A clear error still counts as "response sesuai aturan".

### S10 — webhook proof (row 15)
- [ ] In **Vercel → your project → Logs**, filter by `/api/kiriminaja-webhook`.
- [ ] 📸 Screenshot the `POST /api/kiriminaja-webhook` 200 entries for your orders.
- The AWB appearing in S5 is also proof, since only the webhook writes it.

---

## Part D — after the screenshots

- [ ] Fill section 1 (PIC, date) and tick section 2.
- [ ] Section 3: put the order ID / AWB / screenshot in "Actual / Evidence" for each row and tick Pass.
- [ ] Section 4: fill the table, paste the label screenshots, tick the label checklist.
- [ ] Export to PDF (10 MB or less). Check no secrets are visible.
- [ ] Send to KiriminAja with the label weight question from the handoff note.
- [ ] After UAT is approved, switch to production: production KiriminAja URLs and keys, Midtrans production, a **new non-sequential KA Credit PIN**.
