# Dokumentasi API Opname Item — sparta-api

Base URL: `/api/opname`

---

## Daftar Endpoint

| #   | Method   | Path               | Deskripsi                               |
| --- | -------- | ------------------ | --------------------------------------- |
| 1   | `POST`   | `/api/opname`      | Buat data opname item (single)          |
| 2   | `POST`   | `/api/opname/bulk` | Bulk upsert opname item + upsert header |
| 3   | `GET`    | `/api/opname`      | List data opname item (+ filter)        |
| 4   | `GET`    | `/api/opname/:id`  | Detail data opname item berdasarkan ID  |
| 5   | `PUT`    | `/api/opname/:id`  | Update data opname item                 |
| 6   | `DELETE` | `/api/opname/:id`  | Hapus data opname item                  |

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
- `total_harga_opname` (integer, default `0`)
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
  "total_harga_opname": 12600000,
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

## 2. Bulk Upsert Opname Item

**`POST /api/opname/bulk`**

Endpoint ini mengikuti flow:

1. Cek `opname_final` berdasarkan `id_toko`
2. Jika sudah ada: update header (`email_pembuat`, `grand_total_opname`, `grand_total_rab`)
3. Jika belum ada: insert header baru di `opname_final`
4. Untuk setiap item di `items`:
   - jika kirim `id`: update berdasarkan `id`
   - jika `id` tidak ada, sistem cari item berdasarkan `id_toko` + `id_rab_item`, lalu update jika ketemu
   - jika tidak ketemu juga, sistem insert item baru

Catatan alur setelah reject:

- Jika header `opname_final` terakhir untuk `id_toko` berada di status reject (`Ditolak oleh Koordinator/Manajer/Direktur`), maka saat endpoint bulk dipanggil lagi:
  - status semua item yang diproses pada payload otomatis di-set `pending`
  - status `opname_final` di-reset ke `Menunggu Persetujuan Koordinator`

### Request Body

```json
{
  "id_toko": 12,
  "email_pembuat": "user@example.com",
  "grand_total_opname": "-70000",
  "grand_total_rab": "13000000",
  "items": [
    {
      "id": 201,
      "id_toko": 12,
      "id_rab_item": 120,
      "status": "pending",
      "volume_akhir": 95,
      "selisih_volume": -5,
      "total_selisih": -400000,
      "total_harga_opname": 12600000
    },
    {
      "id_rab_item": 121,
      "status": "pending",
      "volume_akhir": 52,
      "selisih_volume": 2,
      "total_selisih": 330000,
      "total_harga_opname": 880000
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
      "status_opname_final": "Menunggu Persetujuan Koordinator"
    },
    "items": [
      { "id": 201, "id_opname_final": 17 },
      { "id": 202, "id_opname_final": 17 }
    ]
  }
}
```

### Field Item untuk Upsert

- `id` (opsional): bila diisi, item akan diprioritaskan update berdasarkan `id`
- `id_toko` (opsional): bila tidak diisi, sistem memakai `id_toko` dari level root body
- `id_rab_item` (wajib): dipakai sebagai key pencarian fallback bersama `id_toko`

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

### Response

Jika query memakai `id_toko`, response akan menyertakan objek `toko` (diambil dari tabel `toko`) pada level root.

```json
{
  "status": "success",
  "toko": {
    "id": 56,
    "nomor_ulok": "ULOK-001",
    "lingkup_pekerjaan": "Renovasi",
    "nama_toko": "Toko Contoh",
    "kode_toko": "TK-056",
    "proyek": "Project A",
    "cabang": "Bandung",
    "alamat": "Jl. Contoh No. 1",
    "nama_kontraktor": "PT Contoh"
  },
  "data": [
    {
      "id": 50,
      "id_toko": 56,
      "id_opname_final": 3,
      "id_rab_item": 475,
      "status": "pending",
      "volume_akhir": 4,
      "selisih_volume": 1,
      "total_selisih": 165500,
      "total_harga_opname": 0,
      "desain": "Sesuai",
      "kualitas": "Tidak Baik",
      "spesifikasi": "Tidak Sesuai",
      "foto": null,
      "catatan": null,
      "created_at": "2026-04-22T09:14:28.627Z"
    }
  ]
}
```

---

## 4. Detail Opname Item

**`GET /api/opname/:id`**

---

## 5. Update Opname Item

**`PUT /api/opname/:id`**

Minimal salah satu field wajib diisi (`id_toko`, `id_opname_final`, `id_rab_item`, `status`, `volume_akhir`, `selisih_volume`, `total_selisih`, `total_harga_opname`, `desain`, `kualitas`, `spesifikasi`, `foto`, `catatan`).

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
