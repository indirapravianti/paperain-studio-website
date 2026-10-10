# UAT — KiriminAja MitraAPI Integration

User Acceptance Test for integrating the KiriminAja shipping API (MitraAPI) into our website.

> **Full API documentation:** see the separate [`kiriminaja/docs`](https://github.com/kiriminaja/docs) repo (checked out locally at `../../docs`) for endpoint references, request/response formats, and coverage details.

> **Ketentuan upload:** PDF, maksimal 10 MB. Jangan tampilkan secret/API key penuh. Label pengiriman wajib mengikuti dokumentasi KiriminAja dan dilampirkan screenshot jika digunakan.

---

## 1. Informasi Dokumen

| Field | Nilai |
| --- | --- |
| Nama Brand / Merchant | |
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
| Authentication / API Key Sandbox | ☐ Diuji ☐ N/A | |
| Coverage / Courier Service | ☐ Diuji ☐ N/A | |
| Pricing | ☐ Diuji ☐ N/A | |
| Create Paket Non-COD | ☐ Diuji ☐ N/A | |
| Create Paket COD | ☐ Diuji ☐ N/A | Declare COD Value |
| Create Paket Insurance | ☐ Diuji ☐ N/A | Declare insurance amount/type |
| Create Paket KA Credit | ☐ Diuji ☐ N/A | Declare payment method KA Credit |
| Label Pengiriman | ☐ Diuji ☐ N/A | Lampirkan screenshot label |
| Tracking | ☐ Diuji ☐ N/A | |
| Webhook / Callback | ☐ Diuji ☐ N/A | Jika digunakan |
| Cancel / Void | ☐ Diuji ☐ N/A | Jika digunakan |

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
