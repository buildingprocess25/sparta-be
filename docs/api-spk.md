# Dokumentasi API SPK — sparta-api

Base URL: `/api/spk`

> Catatan: Modul ini menggunakan tabel `pengajuan_spk` dan `spk_approval_log`.

---

## Daftar Endpoint

| #   | Method | Path                    | Deskripsi                                     |
| --- | ------ | ----------------------- | --------------------------------------------- |
| 1   | `POST` | `/api/spk/submit`       | Submit pengajuan SPK baru / resubmit rejected |
| 2   | `GET`  | `/api/spk`              | List pengajuan SPK (+ filter)                 |
| 3   | `GET`  | `/api/spk/:id`          | Detail pengajuan SPK + approval log           |
| 4   | `GET`  | `/api/spk/:id/pdf`      | Download PDF SPK                              |
| 5   | `POST` | `/api/spk/:id/approval` | Approve/Reject pengajuan SPK (1 level)        |

---

## Status SPK

| Status                    | Keterangan                          |
| ------------------------- | ----------------------------------- |
| `WAITING_FOR_BM_APPROVAL` | Menunggu persetujuan Branch Manager |
| `SPK_APPROVED`            | SPK disetujui                       |
| `SPK_REJECTED`            | SPK ditolak                         |

Status aktif (untuk cek duplikasi submit):

- `WAITING_FOR_BM_APPROVAL`
- `SPK_APPROVED`

---

## 1. Submit SPK

**`POST /api/spk/submit`**

Membuat pengajuan SPK baru. Sistem akan:

- Validasi `nomor_ulok` wajib sudah ada di master tabel `toko`
- Cek duplikasi SPK aktif berdasarkan kombinasi `nomor_ulok + lingkup_pekerjaan`
- Jika ditemukan data existing dengan kombinasi yang sama namun status `SPK_REJECTED`, sistem tidak membuat baris baru. Sistem akan meng-update baris rejected tersebut (status kembali ke `WAITING_FOR_BM_APPROVAL`) dan memperbarui field pengajuan dengan payload terbaru
- Hitung `waktu_selesai` dari `waktu_mulai + durasi - 1`
- Hitung `terbilang` dari `grand_total`
- Generate `nomor_spk` dengan format:
  - `NNN/PROPNDEV-{kode_cabang}/{spk_manual_1}/{spk_manual_2}`
- Simpan ke tabel `pengajuan_spk`
- Set status awal: `WAITING_FOR_BM_APPROVAL`

### Request Body

```json
{
  "nomor_ulok": "Z001-2512-TEST",
  "email_pembuat": "koordinator@example.com",
  "lingkup_pekerjaan": "SIPIL",
  "nama_kontraktor": "PT Kontraktor ABC",
  "proyek": "Renovasi",
  "waktu_mulai": "2026-03-20",
  "durasi": 10,
  "grand_total": 12500000,
  "par": "PAR-001/III/2026",
  "spk_manual_1": "III",
  "spk_manual_2": "2026"
}
```

### Validasi

| Field               | Aturan                                                             |
| ------------------- | ------------------------------------------------------------------ |
| `nomor_ulok`        | wajib, string min 1                                                |
| `email_pembuat`     | wajib, format email valid                                          |
| `lingkup_pekerjaan` | wajib, string min 1                                                |
| `nama_kontraktor`   | wajib, string min 1                                                |
| `proyek`            | wajib, string min 1                                                |
| `waktu_mulai`       | wajib, string min 1 (format tanggal direkomendasikan `YYYY-MM-DD`) |
| `durasi`            | wajib, integer > 0                                                 |
| `grand_total`       | wajib, angka >= 0                                                  |
| `par`               | opsional, default `""`                                             |
| `spk_manual_1`      | opsional, default `""`                                             |
| `spk_manual_2`      | opsional, default `""`                                             |

### Response — 201 Created

```json
{
  "status": "success",
  "message": "Pengajuan SPK berhasil disimpan",
  "data": {
    "id": 12,
    "nomor_ulok": "Z001-2512-TEST",
    "email_pembuat": "koordinator@example.com",
    "lingkup_pekerjaan": "SIPIL",
    "nama_kontraktor": "PT Kontraktor ABC",
    "proyek": "Renovasi",
    "waktu_mulai": "2026-03-20T00:00:00.000Z",
    "durasi": 10,
    "waktu_selesai": "2026-03-29T00:00:00.000Z",
    "grand_total": 12500000,
    "terbilang": "( Dua Belas Juta Lima Ratus Ribu Rupiah )",
    "nomor_spk": "001/PROPNDEV-Z001/III/2026",
    "par": "PAR-001/III/2026",
    "spk_manual_1": "III",
    "spk_manual_2": "2026",
    "status": "WAITING_FOR_BM_APPROVAL",
    "link_pdf": null,
    "approver_email": null,
    "waktu_persetujuan": null,
    "alasan_penolakan": null,
    "created_at": "2026-03-17T10:25:10.123Z"
  }
}
```

### Error Responses

| Code | Kondisi                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------ |
| 404  | `nomor_ulok` tidak ditemukan di master `toko`                                                          |
| 409  | SPK aktif (`WAITING_FOR_BM_APPROVAL`/`SPK_APPROVED`) dengan `nomor_ulok + lingkup_pekerjaan` sudah ada |
| 422  | Validasi Zod gagal                                                                                     |

---

## 2. List SPK

**`GET /api/spk`**

Mengambil daftar pengajuan SPK. Mendukung filter query.

### Query Parameters

| Parameter    | Tipe   | Deskripsi                       |
| ------------ | ------ | ------------------------------- |
| `status`     | string | Filter status SPK (exact match) |
| `nomor_ulok` | string | Filter nomor ULOK (exact match) |

### Contoh Request

```http
GET /api/spk
GET /api/spk?status=WAITING_FOR_BM_APPROVAL
GET /api/spk?nomor_ulok=Z001-2512-TEST
```

### Response — 200 OK

```json
{
  "status": "success",
  "data": [
    {
      "id": 12,
      "nomor_ulok": "Z001-2512-TEST",
      "email_pembuat": "koordinator@example.com",
      "lingkup_pekerjaan": "SIPIL",
      "nama_kontraktor": "PT Kontraktor ABC",
      "proyek": "Renovasi",
      "waktu_mulai": "2026-03-20T00:00:00.000Z",
      "durasi": 10,
      "waktu_selesai": "2026-03-29T00:00:00.000Z",
      "grand_total": 12500000,
      "terbilang": "( Dua Belas Juta Lima Ratus Ribu Rupiah )",
      "nomor_spk": "001/PROPNDEV-Z001/III/2026",
      "par": "PAR-001/III/2026",
      "spk_manual_1": "III",
      "spk_manual_2": "2026",
      "status": "WAITING_FOR_BM_APPROVAL",
      "link_pdf": null,
      "approver_email": null,
      "waktu_persetujuan": null,
      "alasan_penolakan": null,
      "created_at": "2026-03-17T10:25:10.123Z",
      "toko": {
        "nomor_ulok": "Z001-2512-TEST",
        "kode_toko": "ALF001",
        "nama_toko": "ALFAMART CONTOH",
        "cabang": "Z001",
        "alamat": "Jl. Contoh No. 1"
      }
    }
  ]
}
```

---

## 3. Detail SPK

**`GET /api/spk/:id`**

Mengambil detail 1 pengajuan SPK beserta histori approval.

### Path Parameter

| Parameter | Tipe   | Deskripsi        |
| --------- | ------ | ---------------- |
| `id`      | number | ID pengajuan SPK |

### Response — 200 OK

```json
{
  "status": "success",
  "data": {
    "pengajuan": {
      "id": 12,
      "nomor_ulok": "Z001-2512-TEST",
      "status": "WAITING_FOR_BM_APPROVAL",
      "nomor_spk": "001/PROPNDEV-Z001/III/2026"
    },
    "approvalLogs": [
      {
        "id": 5,
        "pengajuan_spk_id": 12,
        "approver_email": "manager@example.com",
        "tindakan": "APPROVE",
        "alasan_penolakan": null,
        "waktu_tindakan": "2026-03-18T01:20:00.000Z"
      }
    ]
  }
}
```

### Error Responses

| Code | Kondisi                       |
| ---- | ----------------------------- |
| 404  | Pengajuan SPK tidak ditemukan |

---

## 4. Download PDF SPK

**`GET /api/spk/:id/pdf`**

Generate dan download PDF SPK dari template `spk_report.njk`.

### Response — 200 OK

- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="SPK_{proyek}_{nomor_ulok}.pdf"`

### Error Responses

| Code | Kondisi                                      |
| ---- | -------------------------------------------- |
| 404  | Pengajuan SPK atau data toko tidak ditemukan |

---

## 5. Approval SPK

**`POST /api/spk/:id/approval`**

Memproses approval SPK satu level (Branch Manager).

Aturan:

- Hanya bisa diproses saat status masih `WAITING_FOR_BM_APPROVAL`
- `APPROVE` mengubah status ke `SPK_APPROVED`
- `REJECT` mengubah status ke `SPK_REJECTED` dan wajib isi `alasan_penolakan`
- Selalu menulis jejak audit ke `spk_approval_log`

### Request Body (Approve)

```json
{
  "approver_email": "manager@example.com",
  "tindakan": "APPROVE"
}
```

### Request Body (Reject)

```json
{
  "approver_email": "manager@example.com",
  "tindakan": "REJECT",
  "alasan_penolakan": "Dokumen belum lengkap"
}
```

### Response — 200 OK

```json
{
  "status": "success",
  "message": "Approval SPK berhasil diproses",
  "data": {
    "id": "12",
    "old_status": "WAITING_FOR_BM_APPROVAL",
    "new_status": "SPK_APPROVED"
  }
}
```

### Error Responses

| Code | Kondisi                          |
| ---- | -------------------------------- |
| 404  | Pengajuan SPK tidak ditemukan    |
| 409  | Status sudah diproses sebelumnya |
| 422  | Validasi Zod gagal               |

---

## Mapping Tabel SPK

- `pengajuan_spk`: data header pengajuan SPK
- `spk_approval_log`: histori tindakan approval/reject

Relasi:

- `pengajuan_spk.nomor_ulok` -> `toko.nomor_ulok`
- `spk_approval_log.pengajuan_spk_id` -> `pengajuan_spk.id`
