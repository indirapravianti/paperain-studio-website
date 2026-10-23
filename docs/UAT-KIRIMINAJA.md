# UAT — KiriminAja MitraAPI Integration

User Acceptance Test for integrating the KiriminAja shipping API (MitraAPI) into our website.

> **Full API documentation:** see the separate [`kiriminaja/docs`](https://github.com/kiriminaja/docs) repo (checked out locally at `../../docs`) for endpoint references, request/response formats, and coverage details.

> **Ketentuan upload:** PDF, maksimal 10 MB. Jangan tampilkan secret/API key penuh. Label pengiriman wajib mengikuti dokumentasi KiriminAja dan dilampirkan screenshot jika digunakan.

---

## 1. Informasi Dokumen

| Field | Nilai |
| --- | --- |
| Nama Brand / Merchant | paperain studio |
| Nama PIC | |
| Email PIC | |
| Nomor HP PIC | |
| Environment UAT | Sandbox MitraAPI |
| Tanggal UAT | |
| Versi Dokumen | V 1.0 |

---

## 2. Scope UAT

Centang fitur yang diuji dan beri catatan jika tidak digunakan.

| Fitur Core | Status | Catatan |
| --- | --- | --- |
| Authentication / API Key Sandbox | ☐ Diuji ☐ N/A | Bearer `KIRIMINAJA_TOKEN`, sandbox `https://tdev.kiriminaja.com` |
| Coverage / Courier Service | ☐ Diuji ☐ N/A | Province → city → district → kelurahan at checkout |
| Pricing | ☐ Diuji ☐ N/A | `v6.1/shipping_price`, chargeable weight = max(actual, volume) |
| Create Paket Non-COD | ☐ Diuji ☐ N/A | `v6.2/request_pickup` after payment. `cod` is always 0. `package_type_id` 7 |
| Create Paket COD | ☐ Diuji ☑ N/A | Not offered. Checkout is prepaid via Midtrans |
| Create Paket Insurance | ☐ Diuji ☐ N/A | Sent only when `force_insurance` or JNE goods value is above Rp500.000 |
| Create Paket KA Credit | ☐ Diuji ☐ N/A | `payment_method: credit` (env `KIRIMINAJA_PAYMENT_METHOD=credit`, optional `KIRIMINAJA_PIN`). The customer pays shipping through Midtrans; we pay KiriminAja from KA Credit so the AWB is returned immediately |
| Label Pengiriman | ☐ Diuji ☐ N/A | Admin → orders → label. Official PDF via `v6.1/awb/print`, plus member label |
| Tracking | ☐ Diuji ☐ N/A | Admin track button, `POST /api/mitra/tracking` |
| Webhook / Callback | ☐ Diuji ☐ N/A | `https://www.paperainstudio.com/api/kiriminaja-webhook` |
| Cancel / Void | ☐ Diuji ☐ N/A | Admin cancel button, `POST /api/mitra/v3/cancel_shipment` |

---

## 3. Hasil Pengujian

Isi ringkas hasil pengujian. Evidence dapat berupa screenshot, response log, order ID, AWB, atau catatan validasi.

| No | Fitur | Skenario Minimal | Expected Result | Actual / Evidence Screenshot UI Apps | Wajib Implementasi | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Authentication | Request API Key Sandbox valid | Authorized / sukses | | Wajib | ☐ Pass ☐ Fail ☐ N/A |
| 2 | Coverage / Service | Cek area/courier service | Service/area tersedia | | Wajib | ☐ Pass ☐ Fail ☐ N/A |
| 3 | Pricing | Cek ongkir data valid | Harga/layanan muncul | | Wajib | ☐ Pass ☐ Fail ☐ N/A |
| 4 | Create Non-COD | Create shipment Non-COD dengan kriteria berat barang lebih tinggi daripada berat volume | Order ID/AWB terbentuk | | Wajib | ☐ Pass ☐ Fail ☐ N/A |
| 5 | Create Non-COD dan menggunakan asuransi | Create shipment Non-COD dengan kriteria berat barang lebih tinggi dari pada berat volume dan menggunakan asuransi | Order ID/AWB terbentuk | | Tidak Wajib — namun ada beberapa ketentuan paket yang wajib asuransi, misalnya JNE untuk harga barang di atas Rp500.000, dan package type id tertentu. Ketentuan lengkap pada dokumentasi Create Order Express Package | ☐ Pass ☐ Fail ☐ N/A |
| 6 | Create Non-COD | Create shipment Non-COD dengan kriteria berat volume lebih tinggi dari pada berat barang | Order ID/AWB terbentuk | | Wajib | ☐ Pass ☐ Fail ☐ N/A |
| 7 | Create Non-COD menggunakan asuransi | Create shipment Non-COD dengan kriteria berat volume lebih tinggi dari pada berat barang dan menggunakan asuransi | Order ID/AWB terbentuk | | Tidak Wajib — namun ada beberapa ketentuan paket yang wajib asuransi, misalnya JNE untuk harga barang di atas Rp500.000, dan package type id tertentu. Ketentuan lengkap pada dokumentasi Create Order Express Package | ☐ Pass ☐ Fail ☐ N/A |
| 8 | Create COD | Create shipment COD dengan kriteria berat barang lebih tinggi daripada berat volume | COD tercatat di response & label | | Tidak Wajib | ☐ Pass ☐ Fail ☐ N/A |
| 9 | Create COD menggunakan asuransi | Create shipment COD dengan kriteria berat barang lebih tinggi daripada berat volume dan menggunakan asuransi | COD tercatat di response & label | | Tidak Wajib — namun ada beberapa ketentuan paket yang wajib asuransi, misalnya JNE untuk harga barang di atas Rp500.000, dan package type id tertentu. Ketentuan lengkap pada dokumentasi Create Order Express Package | ☐ Pass ☐ Fail ☐ N/A |
| 10 | Create COD | Create shipment COD dengan kriteria berat volume lebih tinggi daripada berat barang | COD tercatat di response & label | | Tidak Wajib (Wajib jika menggunakan COD) | ☐ Pass ☐ Fail ☐ N/A |
| 11 | Create COD menggunakan asuransi | Create shipment COD dengan kriteria berat volume lebih tinggi daripada berat barang dan menggunakan asuransi | COD tercatat di response & label | | Tidak Wajib — namun ada beberapa ketentuan paket yang wajib asuransi, misalnya JNE untuk harga barang di atas Rp500.000, dan package type id tertentu. Ketentuan lengkap pada dokumentasi Create Order Express Package | ☐ Pass ☐ Fail ☐ N/A |
| 12 | Create KA Credit | Create shipment payment KA Credit | Payment tervalidasi / error handling jelas | | Tidak Wajib | ☐ Pass ☐ Fail ☐ N/A |
| 13 | Label Pengiriman | Generate/ambil label | Label tampil & field wajib lengkap | Screenshot Section 4 | Wajib | ☐ Pass ☐ Fail ☐ N/A |
| 14 | Tracking | Tracking order/AWB | Status tampil | | Wajib | ☐ Pass ☐ Fail ☐ N/A |
| 15 | Webhook | Terima callback jika digunakan | Payload diterima benar | | Tidak Wajib | ☐ Pass ☐ Fail ☐ N/A |
| 16 | Cancel / Void | Cancel/void jika digunakan | Response sesuai aturan | | Tidak Wajib | ☐ Pass ☐ Fail ☐ N/A |

---

## 4. Evidence Label Pengiriman

Wajib diisi jika fitur Label Pengiriman digunakan. Member dapat menempelkan screenshot label pengiriman dari sistem mereka / dashboard / hasil integrasi API.

Acuan field label mengikuti dokumentasi KiriminAja: https://developer.kiriminaja.com/docs/important-notes/shipping-label

| Field | Nilai |
| --- | --- |
| Order ID / Reference ID | |
| AWB / Tracking Number | |
| Courier / Service | |
| Shipping Type | ☐ COD ☐ Non-COD |
| COD Value | Isi jika COD digunakan |
| Insurance Information | Isi jika insurance digunakan |
| Sumber Label | ☐ Dashboard KiriminAja ☐ API ☐ Sistem Member |
| Screenshot Label Pengiriman | *(Tempel screenshot label di sini)* |
| Catatan Validasi Label | |

### Checklist Wajib Label Pengiriman

| Field Label | Wajib? | Catatan |
| --- | --- | --- |
| Logistic Logo / Label | Ya | Logo/label kurir |
| Service Type / Service Label | Ya | REG/OKE/YES/HALU/dll |
| AWB Barcode | Ya | Format 128A |
| AWB Label | Ya | AWB tertulis di samping barcode |
| Shipping Type | Ya | COD/Non-COD; jika COD tampilkan COD Value |
| Sorting Code | Ya | Sesuai kurir |
| Sender & Recipient Details | Ya | Nama, HP, alamat lengkap, kode pos |
| Shipment Weight | Ya | Berat gram |
| Item Quantity | Ya | Jumlah item |
| Insurance Information | Jika digunakan | Wajib tampil jika insurance dipakai |
| Origin & Destination City | Ya | Kota asal & tujuan |
| Item Information | Ya | Nama/list/harga item |
| Order Ref Label | Ya | Order ID/order number platform member |

### Catatan Khusus Label

1. Label harus dicetak jelas dan ditempel aman pada paket.
2. Barcode AWB wajib dapat discan; jika order reference barcode digunakan, pastikan juga dapat discan.
3. Untuk JNE Drop-Off, tambahkan informasi `CASHLESS` sebelum Shipping Type, contoh: `CASHLESS COD: Rp500.000` atau `CASHLESS Non-COD`.
4. Untuk kurir dengan requirement khusus seperti J&T Cargo atau SPX Express, ikuti sorting/routing code sesuai dokumentasi/arah PIC KiriminAja.

---

## 5. Cara menjalankan skenario wajib

Sandbox only. Do not paste the API key into this document.

1. Run `supabase/patch-011-kiriminaja-uat.sql` if it is not applied yet.
2. Set the sender env vars in `.env.example` (`KIRIMINAJA_TOKEN`, origin district, kelurahan, name, phone, address, city, zipcode). The sender name must be 8–14 characters.
3. Set `KIRIMINAJA_PAYMENT_METHOD=credit` in Vercel and redeploy. Without it, KiriminAja creates a QRIS bill per pickup and holds the AWB until it is paid, and the sandbox QR (`qr_content`) cannot be paid. Check the balance with `node --env-file=.env scripts/kiriminaja-set-callback.mjs balance` (the sandbox account had Rp500.000 on 2026-10-23).
4. Make sure the webhook is registered (`node --env-file=.env scripts/kiriminaja-set-callback.mjs register`, done on 2026-10-17).
5. Place two paid sandbox orders (Non-COD, insurance off):

| Skenario UAT | Keranjang | Yang terkirim ke `request_pickup` |
| --- | --- | --- |
| Berat barang lebih tinggi dari berat volume | 4 keychains or more (actual weight above 150 g while the carton is still the 15×20×3 cm mailer, volume 150 g) | `weight` = actual grams, dimensions whose volume is lower |
| Berat volume lebih tinggi dari berat barang | 1 sticker sheet (actual 100 g, mailer 15×20×3 cm = 150 g volume) | `weight` = 100, `width` 15, `length` 20, `height` 3 |

Checkout shows both weights next to the courier list. The order row stores `shipping_actual_weight_grams` and `shipping_volumetric_weight_grams`.

6. After payment, KiriminAja creates the shipment and deducts the shipping cost from KA Credit. AWB may arrive in the create response or on the `processed_packages` webhook. These orders also cover row 12 (KA Credit).
7. Open **admin → orders → label**. Attach the KiriminAja PDF screenshot to section 4. The on-page card is the member copy (courier name, service, Code 128A barcodes, sorting code from tracking, sender and recipient with postal code, weight, qty, items and prices, order ref).
8. Use **track** and **cancel** on the same order row for rows 14 and 16. COD stays N/A.
