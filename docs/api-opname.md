# Dokumentasi API Opname — sparta-api

Base URL: `/api/opname`

---

## Daftar Endpoint

| #   | Method   | Path               | Deskripsi                         |
| --- | -------- | ------------------ | --------------------------------- |
| 1   | `POST`   | `/api/opname`      | Buat data opname (single)         |
| 2   | `POST`   | `/api/opname/bulk` | Buat banyak data opname (bulk)    |
| 3   | `GET`    | `/api/opname`      | List data opname (+ filter)       |
| 4   | `GET`    | `/api/opname/:id`  | Detail data opname berdasarkan ID |
| 5   | `PUT`    | `/api/opname/:id`  | Update data opname                |
| 6   | `DELETE` | `/api/opname/:id`  | Hapus data opname                 |

---

## Struktur Tabel `opname`

Tabel `opname` sekarang punya dua relasi:

- `id` (PK)
- `id_toko` (FK -> `toko.id`)
- `id_rab_item` (FK -> `rab_item.id`)
- `status` (enum: `progress` | `selesai` | `terlambat`, default `progress`)
- `volume_akhir` (integer)
- `selisih_volume` (integer)
- `total_selisih` (integer)
- `desain` (varchar, nullable)
- `kualitas` (varchar, nullable)
- `spesifikasi` (varchar, nullable)
- `foto` (varchar, nullable)
- `catatan` (varchar, nullable)
- `created_at` (timestamp)

Catatan:

- Kolom `kategori_pekerjaan`, `jenis_pekerjaan`, `satuan`, `volume`, `harga_material`, `harga_upah` sudah dipindahkan sumbernya dari relasi `rab_item`.

---

## 1. Create Opname (Single)

**`POST /api/opname`**

### Request Body

```json
{
  "id_toko": 12,
  "id_rab_item": 120,
  "status": "progress",
  "volume_akhir": 95,
  "selisih_volume": -5,
  "total_selisih": -400000,
  "desain": "Sesuai gambar kerja",
  "kualitas": "A",
  "spesifikasi": "Cat eksterior premium",
  "catatan": "Ada pengurangan volume di area belakang"
}
```

### Upload Foto Opname (multipart/form-data)

Selain JSON biasa, endpoint ini juga menerima upload file:

- field file: `file_foto_opname`
- behavior: file diupload ke Google Drive, lalu link hasil upload otomatis disimpan ke `foto`

### Validasi

| Field            | Aturan                                              |
| ---------------- | --------------------------------------------------- |
| `id_toko`        | wajib, integer > 0                                  |
| `id_rab_item`    | wajib, integer > 0                                  |
| `status`         | opsional, enum (`progress`, `selesai`, `terlambat`) |
| `volume_akhir`   | wajib, integer                                      |
| `selisih_volume` | wajib, integer                                      |
| `total_selisih`  | wajib, integer                                      |
| `desain`         | opsional, string min 1                              |
| `kualitas`       | opsional, string min 1                              |
| `spesifikasi`    | opsional, string min 1                              |
| `catatan`        | opsional, string min 1                              |

### Response — 201 Created

```json
{
  "status": "success",
  "message": "Data opname berhasil disimpan",
  "data": {
    "id": 1,
    "id_toko": 12,
    "id_rab_item": 120,
    "status": "progress",
    "volume_akhir": 95,
    "selisih_volume": -5,
    "total_selisih": -400000,
    "desain": "Sesuai gambar kerja",
    "kualitas": "A",
    "spesifikasi": "Cat eksterior premium",
    "foto": "https://drive.google.com/file/d/xxx/view",
    "catatan": "Ada pengurangan volume di area belakang",
    "created_at": "2026-04-14T08:00:00.000Z"
  }
}
```

---

## 2. Create Opname (Bulk)

**`POST /api/opname/bulk`**

### Request Body

```json
{
  "items": [
    {
      "id_toko": 12,
      "id_rab_item": 120,
      "status": "progress",
      "volume_akhir": 95,
      "selisih_volume": -5,
      "total_selisih": -400000
    },
    {
      "id_toko": 12,
      "id_rab_item": 121,
      "status": "selesai",
      "volume_akhir": 52,
      "selisih_volume": 2,
      "total_selisih": 330000
    }
  ]
}
```

### Upload Foto Opname (multipart/form-data)

Endpoint bulk juga menerima upload file:

- field file: `file_foto_opname`
- field body: `items` dikirim sebagai JSON string
- field body opsional: `file_foto_opname_indexes` dikirim sebagai JSON string array index item
- behavior:
  - jika jumlah `file_foto_opname` = 1, link file tersebut dipakai untuk semua item
  - jika jumlah `file_foto_opname` = jumlah item, tiap file dipetakan berdasarkan index item
  - jika hanya sebagian item yang punya file, kirim `file_foto_opname_indexes` untuk mapping item tertentu
  - link hasil upload otomatis disimpan ke kolom `foto`

---

## 3. List Opname

**`GET /api/opname`**

### Query Parameters (opsional)

| Parameter     | Tipe     | Deskripsi                   |
| ------------- | -------- | --------------------------- |
| `id_toko`     | `number` | Filter berdasarkan toko     |
| `id_rab_item` | `number` | Filter berdasarkan rab_item |
| `status`      | `string` | Filter status opname        |

---

## 4. Detail Opname

**`GET /api/opname/:id`**

---

## 5. Update Opname

**`PUT /api/opname/:id`**

### Request Body (contoh)

```json
{
  "status": "selesai",
  "volume_akhir": 98,
  "selisih_volume": -2,
  "total_selisih": -160000,
  "catatan": "Revisi volume setelah ukur ulang"
}
```

### Upload Revisi Foto Opname (multipart/form-data)

- field file: `rev_file_foto_opname`
- opsional: jika tidak dikirim maka nilai `foto` tidak diubah

### Validasi

Minimal salah satu field berikut harus diisi:

- `id_rab_item`
- `id_toko`
- `status` (`progress` / `selesai` / `terlambat`)
- `volume_akhir`
- `selisih_volume`
- `total_selisih`
- `desain`
- `kualitas`
- `spesifikasi`
- `foto`
- `catatan`

---

## 6. Delete Opname

**`DELETE /api/opname/:id`**

---

## Error Responses

| Code | Kondisi                                     |
| ---- | ------------------------------------------- |
| 400  | Format payload bulk tidak valid             |
| 400  | `status` opname tidak valid                 |
| 404  | Data opname tidak ditemukan                 |
| 404  | `id_toko` tidak ditemukan di `toko`         |
| 404  | `id_rab_item` tidak ditemukan di `rab_item` |
| 422  | Validasi request gagal (Zod)                |
