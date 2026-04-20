# Dokumentasi API Opname Item — sparta-api

Base URL: `/api/opname`

---

## Daftar Endpoint

| #   | Method   | Path               | Deskripsi                                    |
| --- | -------- | ------------------ | -------------------------------------------- |
| 1   | `POST`   | `/api/opname`      | Buat data opname item (single)               |
| 2   | `POST`   | `/api/opname/bulk` | Bulk create opname item + auto create header |
| 3   | `GET`    | `/api/opname`      | List data opname item (+ filter)             |
| 4   | `GET`    | `/api/opname/:id`  | Detail data opname item berdasarkan ID       |
| 5   | `PUT`    | `/api/opname/:id`  | Update data opname item                      |
| 6   | `DELETE` | `/api/opname/:id`  | Hapus data opname item                       |

---

## Struktur Tabel `opname_item`

- `id` (PK)
- `id_toko` (FK -> `toko.id`)
- `id_opname_final` (FK -> `opname_final.id`)
- `id_rab_item` (FK -> `rab_item.id`)
- `status` (enum: `pending` | `disetujui` | `ditolak`, default `pending`)
- `volume_akhir` (integer)
- `selisih_volume` (integer)
- `total_selisih` (integer)
- `desain` (varchar, nullable)
- `kualitas` (varchar, nullable)
- `spesifikasi` (varchar, nullable)
- `foto` (varchar, nullable)
- `catatan` (varchar, nullable)
- `created_at` (timestamp)

---

## 1. Create Opname Item (Single)

**`POST /api/opname`**

### Request Body

```json
{
  "id_toko": 12,
  "id_opname_final": 7,
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
```

### Upload Foto (multipart/form-data)

- field file: `file_foto_opname`
- behavior: file diupload ke Google Drive dan link disimpan ke `foto`

---

## 2. Bulk Create Opname Item

**`POST /api/opname/bulk`**

Endpoint ini mengikuti flow:

1. Insert 1 baris ke `opname_final` (header) dengan `id_toko` dan `email_pembuat`
2. Ambil `id` hasil insert `opname_final`
3. Insert seluruh item ke `opname_item` memakai `id_opname_final` tersebut

### Request Body

```json
{
  "id_toko": 12,
  "email_pembuat": "user@example.com",
  "items": [
    {
      "id_rab_item": 120,
      "status": "pending",
      "volume_akhir": 95,
      "selisih_volume": -5,
      "total_selisih": -400000
    },
    {
      "id_rab_item": 121,
      "status": "pending",
      "volume_akhir": 52,
      "selisih_volume": 2,
      "total_selisih": 330000
    }
  ]
}
```

### Response Ringkas

```json
{
  "status": "success",
  "message": "2 data opname berhasil disimpan",
  "data": {
    "opname_final": {
      "id": 17,
      "id_toko": 12,
      "status_opname_final": "Menunggu Persetujuan Direktur"
    },
    "items": [
      { "id": 201, "id_opname_final": 17 },
      { "id": 202, "id_opname_final": 17 }
    ]
  }
}
```

### Upload Foto Bulk (multipart/form-data)

- field file: `file_foto_opname`
- field body: `items` sebagai JSON string
- field body opsional: `file_foto_opname_indexes` sebagai JSON string array index item
- behavior mapping:
  - 1 file -> dipakai semua item
  - jumlah file = jumlah item -> map per index
  - sebagian item saja -> gunakan `file_foto_opname_indexes`

---

## 3. List Opname Item

**`GET /api/opname`**

### Query Parameters (opsional)

| Parameter         | Tipe     | Deskripsi                       |
| ----------------- | -------- | ------------------------------- |
| `id_toko`         | `number` | Filter berdasarkan toko         |
| `id_opname_final` | `number` | Filter berdasarkan header final |
| `id_rab_item`     | `number` | Filter berdasarkan rab_item     |
| `status`          | `string` | Filter status item opname       |

---

## 4. Detail Opname Item

**`GET /api/opname/:id`**

---

## 5. Update Opname Item

**`PUT /api/opname/:id`**

Minimal salah satu field wajib diisi (`id_toko`, `id_opname_final`, `id_rab_item`, `status`, `volume_akhir`, `selisih_volume`, `total_selisih`, `desain`, `kualitas`, `spesifikasi`, `foto`, `catatan`).

Upload revisi foto:

- field file: `rev_file_foto_opname`

---

## 6. Delete Opname Item

**`DELETE /api/opname/:id`**

---

## Error Responses

| Code | Kondisi                                                 |
| ---- | ------------------------------------------------------- |
| 400  | Format payload bulk / status tidak valid                |
| 404  | Data opname item / relasi FK (`id_toko`, dll) tidak ada |
| 422  | Validasi request gagal (Zod)                            |
