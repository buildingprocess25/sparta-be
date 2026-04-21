# Dokumentasi API Opname Final — sparta-api

Base URL: `/api/final_opname`

---

## Daftar Endpoint

| #   | Method | Path                                       | Deskripsi                                          |
| --- | ------ | ------------------------------------------ | -------------------------------------------------- |
| 1   | `GET`  | `/api/final_opname`                        | List semua header opname_final (+ filter)          |
| 2   | `GET`  | `/api/final_opname/:id`                    | Detail opname_final + item                         |
| 3   | `POST` | `/api/final_opname/:id/kunci_opname_final` | Kunci header + replace item + generate PDF         |
| 4   | `POST` | `/api/final_opname/:id/approval`           | Approve / Reject oleh koordinator/manager/direktur |
| 5   | `POST` | `/api/final_opname/approval/:id`           | Alias endpoint approval                            |
| 6   | `GET`  | `/api/final_opname/:id/pdf`                | Download PDF opname_final                          |

---

## Struktur Tabel `opname_final`

- `id` (PK)
- `id_toko` (FK -> `toko.id`)
- `status_opname_final` (varchar)
- `link_pdf_opname` (varchar)
- `email_pembuat` (varchar)
- `pemberi_persetujuan_direktur` (varchar)
- `waktu_persetujuan_direktur` (varchar)
- `pemberi_persetujuan_koordinator` (varchar)
- `waktu_persetujuan_koordinator` (varchar)
- `pemberi_persetujuan_manager` (varchar)
- `waktu_persetujuan_manager` (varchar)
- `alasan_penolakan` (varchar)
- `grand_total_opname` (varchar)
- `grand_total_rab` (varchar)
- `created_at` (timestamp)

---

## Status Approval

Urutan approval:

1. `Menunggu Persetujuan Koordinator`
2. `Menunggu Persetujuan Manajer`
3. `Menunggu Persetujuan Direktur`
4. `Disetujui`

Status reject:

- `Ditolak oleh Direktur`
- `Ditolak oleh Koordinator`
- `Ditolak oleh Manajer`

Setiap action approval/reject akan:

1. Update status + kolom approver terkait
2. Rehitung grand total dari item opname
3. Re-generate PDF terbaru
4. Upload PDF ke Google Drive
5. Simpan link ke kolom `link_pdf_opname`

Perilaku tambahan saat reject:

1. Jika `opname_final` direject (oleh koordinator/manager/direktur), semua baris `opname_item` dengan `id_opname_final` yang sama otomatis di-set ke status `ditolak`.
2. Status `opname_final` tetap mengikuti penolak terakhir (`Ditolak oleh Koordinator` / `Ditolak oleh Manajer` / `Ditolak oleh Direktur`).

---

## 1. List Opname Final

**`GET /api/final_opname`**

### Query Parameters (opsional)

| Parameter    | Tipe     | Deskripsi                     |
| ------------ | -------- | ----------------------------- |
| `status`     | `string` | Filter status opname_final    |
| `id_toko`    | `number` | Filter berdasarkan toko       |
| `nomor_ulok` | `string` | Filter berdasarkan nomor ULOK |
| `cabang`     | `string` | Filter berdasarkan cabang     |

---

## 2. Detail Opname Final

**`GET /api/final_opname/:id`**

Mengembalikan:

- Header `opname_final`
- Data `toko`
- Daftar item dari `opname_item` (join `rab_item`)

---

## 3. Kunci Opname Final

**`POST /api/final_opname/:id/kunci_opname_final`**

Fungsi endpoint ini:

1. Cari data `opname_final` berdasarkan `:id`
2. Replace seluruh item `opname_item` pada `id_opname_final` tersebut
3. Update header `id_toko`, `email_pembuat`, `grand_total_opname`, `grand_total_rab`
4. Set status langsung ke `Menunggu Persetujuan Koordinator`
5. Generate PDF terbaru dan upload ke Google Drive
6. Simpan link PDF ke kolom `link_pdf_opname`

### Request Body

```json
{
  "id_toko": 12,
  "email_pembuat": "user@example.com",
  "grand_total_opname": "12500000",
  "grand_total_rab": "13000000",
  "opname_item": [
    {
      "id_rab_item": 120,
      "status": "pending",
      "volume_akhir": 95,
      "selisih_volume": -5,
      "total_selisih": -400000,
      "desain": "Sesuai gambar kerja",
      "kualitas": "A",
      "spesifikasi": "Cat eksterior premium",
      "catatan": "Ada pengurangan volume di area belakang"
    }
  ]
}
```

### Response Ringkas

```json
{
  "status": "success",
  "message": "Opname final berhasil dikunci dan PDF berhasil dibuat",
  "data": {
    "id": 17,
    "id_toko": 12,
    "status_opname_final": "Menunggu Persetujuan Koordinator",
    "item_count": 1,
    "link_pdf_opname": "https://drive.google.com/file/d/xxxx/view"
  }
}
```

---

## 4. Approval Opname Final

**`POST /api/final_opname/:id/approval`**

### Request Body

```json
{
  "approver_email": "approver@example.com",
  "jabatan": "KOORDINATOR",
  "tindakan": "APPROVE",
  "alasan_penolakan": null
}
```

Untuk reject:

```json
{
  "approver_email": "approver@example.com",
  "jabatan": "MANAGER",
  "tindakan": "REJECT",
  "alasan_penolakan": "Volume tidak sesuai"
}
```

### Response Ringkas

```json
{
  "status": "success",
  "message": "Approval opname_final berhasil diproses",
  "data": {
    "id": 17,
    "old_status": "Menunggu Persetujuan Koordinator",
    "new_status": "Menunggu Persetujuan Manajer",
    "link_pdf_opname": "https://drive.google.com/file/d/xxxx/view"
  }
}
```

Contoh alur approve bertahap:

1. `KOORDINATOR` approve: `Menunggu Persetujuan Koordinator` -> `Menunggu Persetujuan Manajer`
2. `MANAGER` approve: `Menunggu Persetujuan Manajer` -> `Menunggu Persetujuan Direktur`
3. `DIREKTUR` approve: `Menunggu Persetujuan Direktur` -> `Disetujui`

---

## 5. Download PDF Opname Final

**`GET /api/final_opname/:id/pdf`**

Menghasilkan PDF terbaru berdasarkan data saat ini.

---

## Error Responses

| Code | Kondisi                                               |
| ---- | ----------------------------------------------------- |
| 404  | Data `opname_final` tidak ditemukan                   |
| 409  | Transisi approval/reject tidak sesuai status saat ini |
| 422  | Validasi request body gagal                           |
