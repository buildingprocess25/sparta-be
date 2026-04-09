# Dokumentasi API RAB — sparta-api

Base URL: `/api/rab`

---

## Daftar Endpoint

| #   | Method | Path                         | Deskripsi                  |
| --- | ------ | ---------------------------- | -------------------------- |
| 1   | `POST` | `/api/rab/submit`            | Submit pengajuan RAB baru  |
| 2   | `GET`  | `/api/rab`                   | List semua RAB (+ filter)  |
| 3   | `GET`  | `/api/rab/:id`               | Detail RAB berdasarkan ID  |
| 4   | `GET`  | `/api/rab/:id/pdf`           | Download PDF RAB           |
| 5   | `GET`  | `/api/rab/:id/logo`          | Download file logo RAB     |
| 6   | `GET`  | `/api/rab/:id/file-asuransi` | Download file asuransi RAB |
| 7   | `POST` | `/api/rab/:id/approval`      | Approve / Reject RAB       |

---

## 1. Submit RAB

**`POST /api/rab/submit`**

Membuat pengajuan RAB baru. Sistem akan:

- Upsert toko berdasarkan `nomor_ulok` (buat baru atau update jika sudah ada)
- Cek duplikasi RAB aktif untuk ULOK yang sama
- Hitung grand total (Non-SBO, pembulatan ke 10.000, + PPN 11%)
- Generate 3 file PDF (Non-SBO, Rekapitulasi, Gabungan)
- Upload PDF ke Google Drive (pakai token Sparta)
- Simpan data ke 3 tabel (toko + rab + rab_item) dalam 1 transaksi
- Set status awal: `Menunggu Persetujuan Koordinator`

### Request Body

`POST /api/rab/submit` sekarang mendukung 2 mode:

- `application/json`: `file_asuransi` dikirim sebagai string URL/path (backward compatible)
- `multipart/form-data`: `file_asuransi` dikirim sebagai file, backend upload ke Google Drive dan menyimpan link hasil upload

Khusus resubmit data yang sebelumnya berstatus reject, endpoint ini juga mendukung field revisi:

- `rev_logo`: file/logo baru (base64 string pada JSON atau file pada multipart) untuk menimpa kolom `logo`
- `rev_file_asuransi`: file asuransi baru (base64 string pada JSON atau file pada multipart) untuk menimpa kolom `file_asuransi`

Aturan fallback saat resubmit reject:

- Jika `rev_logo` tidak dikirim, link `logo` lama tetap dipakai
- Jika `rev_file_asuransi` tidak dikirim, link `file_asuransi` lama tetap dipakai

```json
{
  "nomor_ulok": "7AZ1-0001-0001",
  "nama_toko": "Alfamart Jl Sudirman",
  "proyek": "Renovasi",
  "cabang": "JAKARTA",
  "alamat": "Jl. Sudirman No 1",
  "nama_kontraktor": "PT Kontraktor ABC",
  "lingkup_pekerjaan": "SIPIL",
  "email_pembuat": "user@example.com",
  "nama_pt": "PT Contoh Kontraktor",
  "durasi_pekerjaan": "30 Hari",
  "logo": "https://drive.google.com/...",
  "rev_logo": "data:image/png;base64,iVBORw0KGgoAAA...",
  "kategori_lokasi": "URBAN",
  "no_polis": "POL-12345",
  "berlaku_polis": "2026-12-31",
  "file_asuransi": "https://drive.google.com/file/d/insurance-file/view",
  "rev_file_asuransi": "data:application/pdf;base64,JVBERi0xLjQKJ...",
  "luas_bangunan": "200",
  "luas_terbangun": "180",
  "luas_area_terbuka": "20",
  "luas_area_parkir": "50",
  "luas_area_sales": "120",
  "luas_gudang": "30",
  "detail_items": [
    {
      "kategori_pekerjaan": "PEKERJAAN PERSIAPAN",
      "jenis_pekerjaan": "Pembersihan Lokasi",
      "satuan": "m2",
      "volume": 100,
      "harga_material": 50000,
      "harga_upah": 30000,
      "catatan": "Akses area dibatasi jam operasional toko"
    },
    {
      "kategori_pekerjaan": "PEKERJAAN SBO",
      "jenis_pekerjaan": "Instalasi Rak SBO",
      "satuan": "unit",
      "volume": 10,
      "harga_material": 200000,
      "harga_upah": 100000,
      "catatan": ""
    }
  ]
}
```

### Contoh Multipart (upload file_asuransi)

Gunakan `multipart/form-data` dengan field berikut:

- Semua field teks sama seperti JSON request
- `detail_items` dikirim sebagai JSON string
- `file_asuransi` dikirim sebagai file (pdf/jpg/png/dll) untuk submit normal
- `rev_logo` opsional sebagai file baru untuk mengganti `logo` saat resubmit reject
- `rev_file_asuransi` opsional sebagai file baru untuk mengganti `file_asuransi` saat resubmit reject

Contoh `curl`:

```bash
curl -X POST http://localhost:3000/api/rab/submit \
  -H "Content-Type: multipart/form-data" \
  -F "nomor_ulok=7AZ1-0001-0001" \
  -F "nama_toko=Alfamart Jl Sudirman" \
  -F "proyek=Renovasi" \
  -F "cabang=JAKARTA" \
  -F "alamat=Jl. Sudirman No 1" \
  -F "nama_kontraktor=PT Kontraktor ABC" \
  -F "lingkup_pekerjaan=SIPIL" \
  -F "email_pembuat=user@example.com" \
  -F "nama_pt=PT Contoh Kontraktor" \
  -F "durasi_pekerjaan=30 Hari" \
  -F "kategori_lokasi=URBAN" \
  -F "no_polis=POL-12345" \
  -F "berlaku_polis=2026-12-31" \
  -F "detail_items=[{\"kategori_pekerjaan\":\"PEKERJAAN PERSIAPAN\",\"jenis_pekerjaan\":\"Pembersihan Lokasi\",\"satuan\":\"m2\",\"volume\":100,\"harga_material\":50000,\"harga_upah\":30000}]" \
  -F "file_asuransi=@./asuransi.pdf" \
  -F "rev_logo=@./logo-baru.png" \
  -F "rev_file_asuransi=@./asuransi-baru.pdf"
```

### Validasi

| Field                               | Tabel    | Aturan                                                            |
| ----------------------------------- | -------- | ----------------------------------------------------------------- |
| `nomor_ulok`                        | toko     | **Wajib**, string minimal 1 karakter                              |
| `nama_toko`                         | toko     | Opsional                                                          |
| `proyek`                            | toko     | Opsional                                                          |
| `cabang`                            | toko     | Opsional                                                          |
| `alamat`                            | toko     | Opsional                                                          |
| `nama_kontraktor`                   | toko     | Opsional                                                          |
| `lingkup_pekerjaan`                 | toko     | Opsional                                                          |
| `email_pembuat`                     | rab      | **Wajib**, format email valid                                     |
| `nama_pt`                           | rab      | **Wajib**, string minimal 1 karakter                              |
| `durasi_pekerjaan`                  | rab      | **Wajib**, string minimal 1 karakter                              |
| `logo`                              | rab      | Opsional, URL (maks 255 karakter)                                 |
| `rev_logo`                          | rab      | Opsional, string base64/data URI atau file multipart              |
| `kategori_lokasi`                   | rab      | Opsional (maks 255 karakter)                                      |
| `no_polis`                          | rab      | Opsional, string (maks 255 karakter)                              |
| `berlaku_polis`                     | rab      | Opsional, string (maks 255 karakter)                              |
| `file_asuransi`                     | rab      | Opsional, string URL/path (maks 500 karakter) atau file multipart |
| `rev_file_asuransi`                 | rab      | Opsional, string base64/data URI atau file multipart              |
| `luas_bangunan`                     | rab      | Opsional, string (maks 255 karakter)                              |
| `luas_terbangun`                    | rab      | Opsional, string (maks 255 karakter)                              |
| `luas_area_terbuka`                 | rab      | Opsional, string (maks 255 karakter)                              |
| `luas_area_parkir`                  | rab      | Opsional, string (maks 255 karakter)                              |
| `luas_area_sales`                   | rab      | Opsional, string (maks 255 karakter)                              |
| `luas_gudang`                       | rab      | Opsional, string (maks 255 karakter)                              |
| `detail_items`                      | rab_item | **Wajib**, array minimal 1 item                                   |
| `detail_items[].kategori_pekerjaan` | rab_item | **Wajib**, maks 255 karakter                                      |
| `detail_items[].jenis_pekerjaan`    | rab_item | **Wajib**, maks 255 karakter                                      |
| `detail_items[].satuan`             | rab_item | **Wajib**, maks 50 karakter                                       |
| `detail_items[].volume`             | rab_item | **Wajib**, angka ≥ 0                                              |
| `detail_items[].harga_material`     | rab_item | **Wajib**, angka ≥ 0                                              |
| `detail_items[].harga_upah`         | rab_item | **Wajib**, angka ≥ 0                                              |
| `detail_items[].catatan`            | rab_item | Opsional, string (maks 255 karakter)                              |

### Perhitungan Otomatis (per item)

```
total_material = volume × harga_material
total_upah     = volume × harga_upah
total_harga    = total_material + total_upah
```

### Perhitungan Grand Total

```
grand_total         = Σ total_harga  (semua item)
grand_total_non_sbo = Σ total_harga  (item yang kategori ≠ "PEKERJAAN SBO")
pembulatan          = floor(grand_total / 10000) × 10000
ppn                 = pembulatan × 0.11   (kecuali cabang BATAM → PPN = 0)
grand_total_final   = pembulatan + ppn
```

### Response — 201 Created

```json
{
  "status": "success",
  "message": "Pengajuan RAB berhasil disimpan",
  "data": {
    "id": 1,
    "id_toko": 5,
    "nomor_ulok": "7AZ1-0001-0001",
    "email_pembuat": "user@example.com",
    "nama_pt": "PT Contoh Kontraktor",
    "lingkup_pekerjaan": "SIPIL",
    "durasi_pekerjaan": "30 Hari",
    "status": "Menunggu Persetujuan Koordinator",
    "grand_total": "11000000",
    "grand_total_non_sbo": "8000000",
    "grand_total_final": "12210000",
    "link_pdf_gabungan": "https://drive.google.com/file/d/xxx/view",
    "link_pdf_non_sbo": "https://drive.google.com/file/d/yyy/view",
    "link_pdf_rekapitulasi": "https://drive.google.com/file/d/zzz/view",
    "created_at": "2026-03-11"
  }
}
```

### Error Responses

| Code | Kondisi                                  |
| ---- | ---------------------------------------- |
| 400  | JSON body tidak valid                    |
| 409  | RAB aktif untuk ULOK yang sama sudah ada |
| 422  | Validasi Zod gagal (detail di `issues`)  |

---

## 2. List RAB

**`GET /api/rab`**

Mengambil daftar semua pengajuan RAB. Mendukung filter via query string.

### Query Parameters

| Parameter    | Tipe   | Deskripsi                               |
| ------------ | ------ | --------------------------------------- |
| `status`     | string | Filter berdasarkan status (exact match) |
| `nomor_ulok` | string | Filter berdasarkan nomor ULOK           |
| `cabang`     | string | Filter berdasarkan cabang toko          |

### Contoh Request

```
GET /api/rab?status=Menunggu Persetujuan Koordinator
GET /api/rab?nomor_ulok=7AZ1-0001-0001
GET /api/rab?cabang=CIKOKOL
GET /api/rab?status=Menunggu Persetujuan Koordinator&cabang=CIKOKOL
GET /api/rab
```

### Response — 200 OK

```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "id_toko": 5,
      "status": "Menunggu Persetujuan Koordinator",
      "nama_pt": "PT Contoh Kontraktor",
      "email_pembuat": "user@example.com",
      "grand_total": "11000000",
      "grand_total_non_sbo": "8000000",
      "grand_total_final": "12210000",
      "link_pdf_gabungan": "https://drive.google.com/file/d/xxx/view",
      "link_pdf_non_sbo": "https://drive.google.com/file/d/yyy/view",
      "link_pdf_rekapitulasi": "https://drive.google.com/file/d/zzz/view",
      "created_at": "2026-03-11",
      "toko": {
        "nomor_ulok": "7AZ1-0001-0001",
        "nama_toko": "ALFAMART CONTOH",
        "cabang": "CIKOKOL",
        "proyek": "RENOVASI"
      }
    }
  ]
}
```

---

## 3. Detail RAB

**`GET /api/rab/:id`**

Mengambil detail lengkap satu pengajuan RAB beserta semua item pekerjaan.

### Path Parameter

| Parameter | Tipe   | Deskripsi        |
| --------- | ------ | ---------------- |
| `id`      | number | ID pengajuan RAB |

### Response — 200 OK

```json
{
  "status": "success",
  "data": {
    "rab": {
      "id": 1,
      "id_toko": 5,
      "status": "Menunggu Persetujuan Koordinator",
      "nama_pt": "PT Contoh Kontraktor",
      "email_pembuat": "user@example.com",
      "logo": "/api/rab/1/logo",
      "link_pdf_gabungan": "https://drive.google.com/file/d/xxx/view",
      "link_pdf_non_sbo": "https://drive.google.com/file/d/yyy/view",
      "link_pdf_rekapitulasi": "https://drive.google.com/file/d/zzz/view",
      "pemberi_persetujuan_koordinator": null,
      "waktu_persetujuan_koordinator": null,
      "pemberi_persetujuan_manager": null,
      "waktu_persetujuan_manager": null,
      "pemberi_persetujuan_direktur": null,
      "waktu_persetujuan_direktur": null,
      "alasan_penolakan": null,
      "durasi_pekerjaan": "30 Hari",
      "kategori_lokasi": "URBAN",
      "no_polis": "POL-12345",
      "berlaku_polis": "2026-12-31",
      "file_asuransi": "/api/rab/1/file-asuransi",
      "luas_bangunan": "200",
      "luas_terbangun": "180",
      "luas_area_terbuka": "20",
      "luas_area_parkir": "50",
      "luas_area_sales": "120",
      "luas_gudang": "30",
      "grand_total": "11000000",
      "grand_total_non_sbo": "8000000",
      "grand_total_final": "12210000",
      "created_at": "2026-03-11"
    },
    "toko": {
      "id": 5,
      "nomor_ulok": "7AZ1-0001-0001",
      "lingkup_pekerjaan": "SIPIL",
      "nama_toko": "ALFAMART CONTOH",
      "kode_toko": "ABC123",
      "proyek": "RENOVASI",
      "cabang": "CIKOKOL",
      "alamat": "Jl. Contoh No. 1",
      "nama_kontraktor": "PT Contoh Kontraktor"
    },
    "items": [
      {
        "id": 1,
        "id_rab": 1,
        "kategori_pekerjaan": "PEKERJAAN PERSIAPAN",
        "jenis_pekerjaan": "Pembersihan Lokasi",
        "satuan": "m2",
        "volume": 100,
        "harga_material": 50000,
        "harga_upah": 30000,
        "total_material": 5000000,
        "total_upah": 3000000,
        "total_harga": 8000000,
        "catatan": "Akses area dibatasi jam operasional toko"
      },
      {
        "id": 2,
        "id_rab": 1,
        "kategori_pekerjaan": "PEKERJAAN SBO",
        "jenis_pekerjaan": "Instalasi Rak SBO",
        "satuan": "unit",
        "volume": 10,
        "harga_material": 200000,
        "harga_upah": 100000,
        "total_material": 2000000,
        "total_upah": 1000000,
        "total_harga": 3000000,
        "catatan": null
      }
    ]
  }
}
```

### Error

| Code | Kondisi                                |
| ---- | -------------------------------------- |
| 404  | RAB dengan ID tersebut tidak ditemukan |

---

## 4. Download PDF RAB

**`GET /api/rab/:id/pdf`**

Mengunduh file PDF RAB gabungan berdasarkan ID pengajuan RAB, dengan sumber file dari `link_pdf_gabungan`.

### Path Parameter

| Parameter | Tipe   | Deskripsi        |
| --------- | ------ | ---------------- |
| `id`      | number | ID pengajuan RAB |

### Response — 200 OK

- **Content-Type**: `application/pdf`
- **Content-Disposition**: `attachment; filename="RAB_GABUNGAN_<nomor_ulok>_<id>.pdf"`
- **Body**: Binary PDF data

Endpoint ini tidak melakukan generate ulang PDF. Endpoint mengambil data RAB berdasarkan `id`, menargetkan URL yang tersimpan di kolom `link_pdf_gabungan`, lalu mengirim file sebagai attachment agar langsung terunduh ke device.

### Penamaan File (mengikuti server)

```
RAB_NON-SBO_{proyek}_{nomor_ulok}.pdf
REKAP_RAB_{proyek}_{nomor_ulok}.pdf
RAB_GABUNGAN_{proyek}_{nomor_ulok}.pdf
```

### Error

| Code | Kondisi                            |
| ---- | ---------------------------------- |
| 404  | RAB atau data toko tidak ditemukan |
| 404  | Link PDF gabungan belum tersedia   |
| 502  | Gagal mengambil file PDF gabungan  |

---

## 5. Download Logo RAB

**`GET /api/rab/:id/logo`**

Mengunduh file logo yang terhubung ke pengajuan RAB.

Endpoint ini ditujukan agar FE tidak perlu akses langsung ke Google Drive. Backend akan mengambil file dari Drive menggunakan kredensial server lalu mengirimkan file ke client sebagai attachment.

### Path Parameter

| Parameter | Tipe   | Deskripsi        |
| --------- | ------ | ---------------- |
| `id`      | number | ID pengajuan RAB |

### Response — 200 OK

- **Content-Type**: mengikuti mime type file (contoh `image/png`, `image/jpeg`)
- **Content-Disposition**: `attachment; filename="<nama-file>"`
- **Body**: Binary file data

### Error

| Code | Kondisi                         |
| ---- | ------------------------------- |
| 404  | RAB tidak ditemukan             |
| 404  | Logo tidak tersedia             |
| 502  | Gagal mengambil file dari Drive |

---

## 6. Download File Asuransi RAB

**`GET /api/rab/:id/file-asuransi`**

Mengunduh file asuransi yang terhubung ke pengajuan RAB.

Endpoint ini juga melewati backend agar link tetap bisa dipakai walau file Google Drive bersifat private untuk akun tertentu.

### Path Parameter

| Parameter | Tipe   | Deskripsi        |
| --------- | ------ | ---------------- |
| `id`      | number | ID pengajuan RAB |

### Response — 200 OK

- **Content-Type**: mengikuti mime type file (contoh `application/pdf`, `image/png`)
- **Content-Disposition**: `attachment; filename="<nama-file>"`
- **Body**: Binary file data

### Error

| Code | Kondisi                         |
| ---- | ------------------------------- |
| 404  | RAB tidak ditemukan             |
| 404  | File asuransi tidak tersedia    |
| 502  | Gagal mengambil file dari Drive |

---

## 7. Approval / Reject RAB

**`POST /api/rab/:id/approval`**

Memproses approval atau penolakan RAB.

### Path Parameter

| Parameter | Tipe   | Deskripsi        |
| --------- | ------ | ---------------- |
| `id`      | number | ID pengajuan RAB |

### Request Body

```json
{
  "approver_email": "koordinator@alfamart.com",
  "jabatan": "KOORDINATOR",
  "tindakan": "APPROVE",
  "alasan_penolakan": null
}
```

### Validasi

| Field              | Aturan                                                  |
| ------------------ | ------------------------------------------------------- |
| `approver_email`   | Wajib, format email valid                               |
| `jabatan`          | Wajib, salah satu: `KOORDINATOR`, `MANAGER`, `DIREKTUR` |
| `tindakan`         | Wajib, salah satu: `APPROVE`, `REJECT`                  |
| `alasan_penolakan` | Wajib jika `tindakan = REJECT`, opsional jika `APPROVE` |

### Flow Status Approval

```
┌──────────────────────────────────────────┐
│  Submit RAB                              │
│  status = "Menunggu Persetujuan          │
│            Koordinator"                  │
└───────────────┬──────────────────────────┘
                │
        ┌───────▼────────┐
        │  KOORDINATOR   │
        │  APPROVE?      │
        └───┬────────┬───┘
         YES│        │NO
            │        │
            ▼        ▼
  "Menunggu      "Ditolak oleh
   Persetujuan    Koordinator"
   Manajer"
            │
    ┌───────▼────────┐
    │    MANAGER     │
    │    APPROVE?    │
    └───┬────────┬───┘
     YES│        │NO
        │        │
        ▼        ▼
  "Disetujui"  "Ditolak oleh
                Manajer"
        │
┌───────▼────────┐
│   DIREKTUR     │  (opsional, setelah Disetujui)
│   REJECT?      │
└───┬────────┬───┘
 NO │        │YES
    │        │
    ▼        ▼
"Disetujui" "Ditolak oleh
             Direktur"
```

### Transisi Status yang Valid

| Status Saat Ini                  | Jabatan     | Tindakan | Status Baru                  |
| -------------------------------- | ----------- | -------- | ---------------------------- |
| Menunggu Persetujuan Koordinator | KOORDINATOR | APPROVE  | Menunggu Persetujuan Manajer |
| Menunggu Persetujuan Koordinator | KOORDINATOR | REJECT   | Ditolak oleh Koordinator     |
| Menunggu Persetujuan Manajer     | MANAGER     | APPROVE  | Disetujui                    |
| Menunggu Persetujuan Manajer     | MANAGER     | REJECT   | Ditolak oleh Manajer         |
| Disetujui                        | DIREKTUR    | REJECT   | Ditolak oleh Direktur        |

### Data yang Diupdate saat Approval

Saat **APPROVE** oleh Koordinator:

```sql
UPDATE rab SET
  status = 'Menunggu Persetujuan Manajer',
  pemberi_persetujuan_koordinator = 'koordinator@alfamart.com',
  waktu_persetujuan_koordinator = '2026-03-11T10:30:00+07:00'
WHERE id = :id
```

Saat **APPROVE** oleh Manager:

```sql
UPDATE rab SET
  status = 'Disetujui',
  pemberi_persetujuan_manager = 'manager@alfamart.com',
  waktu_persetujuan_manager = '2026-03-11T14:00:00+07:00'
WHERE id = :id
```

Saat **REJECT** (contoh Koordinator):

```sql
UPDATE rab SET
  status = 'Ditolak oleh Koordinator',
  alasan_penolakan = 'Volume tidak sesuai survey',
  ditolak_oleh = 'koordinator@alfamart.com'
WHERE id = :id
```

`ditolak_oleh` diisi dari request body `approver_email` ketika tindakan `REJECT`.

Saat `REJECT`, backend juga mengaktifkan kembali `gantt_chart` terbaru untuk `id_toko` yang sama (`status = 'active'`).
Flow ini berjalan dalam transaksi dengan guard: jika ada perubahan data `toko` (`nomor_ulok`, `lingkup_pekerjaan`, `nama_toko`, `kode_toko`, `proyek`, `cabang`, `alamat`, `nama_kontraktor`), transaksi dibatalkan (rollback).

### Response — 200 OK

```json
{
  "status": "success",
  "message": "Approval berhasil diproses",
  "data": {
    "id": 1,
    "old_status": "Menunggu Persetujuan Koordinator",
    "new_status": "Menunggu Persetujuan Manajer"
  }
}
```

### Error Responses

| Code | Kondisi                                             |
| ---- | --------------------------------------------------- |
| 404  | RAB tidak ditemukan                                 |
| 409  | Status saat ini tidak valid untuk tindakan tersebut |
| 500  | Guard violation: terdeteksi perubahan data toko     |
| 422  | Validasi gagal (misal: reject tanpa alasan)         |

---

## Status Values (Enum)

| Status                             | Keterangan                   |
| ---------------------------------- | ---------------------------- |
| `Menunggu Persetujuan Koordinator` | Status awal setelah submit   |
| `Menunggu Persetujuan Manajer`     | Sudah disetujui Koordinator  |
| `Disetujui`                        | Sudah disetujui Manager      |
| `Ditolak oleh Koordinator`         | Ditolak di level Koordinator |
| `Ditolak oleh Manajer`             | Ditolak di level Manager     |
| `Ditolak oleh Direktur`            | Ditolak di level Direktur    |

---

## Relasi Antar Tabel

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│    toko       │       │       rab        │       │   rab_item   │
├──────────────┤       ├──────────────────┤       ├──────────────┤
│ id (PK)      │◄──────│ id_toko (FK)     │       │ id (PK)      │
│ nomor_ulok   │  1:N  │ id (PK)          │◄──────│ id_rab (FK)  │
│ lingkup_pkrj │       │ status           │  1:N  │ kategori_pkj │
│ nama_toko    │       │ nama_pt          │       │ jenis_pkrj   │
│ kode_toko    │       │ email_pembuat    │       │ satuan       │
│ proyek       │       │ link_pdf_*       │       │ volume       │
│ cabang       │       │ approval cols    │       │ harga_mat    │
│ alamat       │       │ grand_total_*    │       │ harga_upah   │
│ nama_kontrkr │       │ luas_*           │       │ total_mat    │
└──────────────┘       │ created_at       │       │ total_upah   │
                       └──────────────────┘       │ total_harga  │
                                                  └──────────────┘
```

---

## Catatan Teknis

### PDF Generation (sama seperti server Python)

1. **PDF Non-SBO**: Berisi semua item RAB KECUALI yang `kategori_pekerjaan = "PEKERJAAN SBO"`
2. **PDF Rekapitulasi**: Ringkasan total per kategori pekerjaan
3. **PDF Gabungan**: Merge dari PDF Non-SBO + PDF Rekapitulasi
4. Semua PDF di-upload ke Google Drive folder `PDF_STORAGE_FOLDER_ID`
5. Link Google Drive disimpan ke kolom masing-masing di tabel `rab`

### Perhitungan PPN

- PPN = 11% dari pembulatan grand total
- **Pengecualian**: Cabang **BATAM** → PPN = 0 (bebas PPN)

### Duplikasi Check

- Sebelum submit, sistem mengecek apakah ada RAB aktif (status bukan "Ditolak") dengan `nomor_ulok` + `lingkup_pekerjaan` yang sama
- Jika ada → return 409 Conflict
- Jika ada yang berstatus "Ditolak" → bisa submit ulang sebagai revisi (data lama di-replace)
