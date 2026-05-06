# Dokumentasi API Penyimpanan Dokumen — sparta-api

Base URL: `/api/doc`

---

## Daftar Endpoint

| #   | Method   | Path                               | Deskripsi                                    |
| --- | -------- | ---------------------------------- | -------------------------------------------- |
| 1   | `POST`   | `/api/doc/penyimpanan-dokumen`     | Simpan dokumen (bulk upload) ke Google Drive |
| 2   | `GET`    | `/api/doc/penyimpanan-dokumen`     | List dokumen (filter id_toko/nama_dokumen)   |
| 3   | `GET`    | `/api/doc/penyimpanan-dokumen/:id` | Detail dokumen                               |
| 4   | `PUT`    | `/api/doc/penyimpanan-dokumen/:id` | Update metadata + optional ganti file        |
| 5   | `DELETE` | `/api/doc/penyimpanan-dokumen/:id` | Hapus dokumen (hapus file Drive jika ada)    |

---

## Struktur Tabel `penyimpanan_dokumen`

- `id` (PK)
- `id_toko` (FK -> `toko.id`, NOT NULL)
- `nama_dokumen` (varchar)
- `drive_file_id` (varchar) — ID file Drive untuk operasi cepat
- `drive_folder_id` (varchar) — ID folder Drive (reuse tanpa parsing link)
- `link_dokumen` (varchar)
- `link_folder` (varchar) — link folder Drive tempat dokumen disimpan
- `created_at` (timestamp)

**Catatan folder Drive:**

- Sistem membuat folder di Drive menggunakan `DOC_DRIVE_ROOT_ID`.
- Nama folder default: `{nama_toko}_{cabang}_{id_toko}` (otomatis disanitasi).
- Link folder disimpan di kolom `link_folder` agar bisa diakses ulang.
- Upload file besar otomatis memakai resumable upload agar stabil.

---

## 1. Create (Bulk Upload)

**`POST /api/doc/penyimpanan-dokumen`**

### Request Body (multipart/form-data)

Fields:

- `id_toko` (number, wajib)
- `nama_dokumen` (string, wajib) — contoh: `rab`
- `folder_name` (string, optional) — override nama folder
- Upload file dokumen:
  - `dokumen` (boleh multiple)
  - atau `dokumen_1`, `dokumen_2`, dst

Contoh fields:

```
id_toko=10
nama_dokumen=rab
folder_name=ALFAMART_BANDUNG_10

dokumen_1=<file>
dokumen_2=<file>
```

### Response — 200 OK

```json
{
  "status": "success",
  "message": "Dokumen berhasil disimpan",
  "data": {
    "folder": {
      "id": "1abcdEFG...",
      "link": "https://drive.google.com/drive/folders/1abcdEFG..."
    },
    "items": [
      {
        "id": 1,
        "id_toko": 10,
        "nama_dokumen": "rab",
        "drive_file_id": "1abCdef...",
        "drive_folder_id": "1abcdEFG...",
        "link_dokumen": "https://drive.google.com/file/d/.../view",
        "link_folder": "https://drive.google.com/drive/folders/1abcdEFG...",
        "created_at": "2026-05-06T08:30:00.000Z"
      }
    ]
  }
}
```

---

## 2. List Dokumen

**`GET /api/doc/penyimpanan-dokumen`**

### Query Params (optional)

- `id_toko`
- `nama_dokumen`

### Response — 200 OK

```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "id_toko": 10,
      "nama_dokumen": "rab",
      "drive_file_id": "1abCdef...",
      "drive_folder_id": "1abcdEFG...",
      "link_dokumen": "https://drive.google.com/file/d/.../view",
      "link_folder": "https://drive.google.com/drive/folders/1abcdEFG...",
      "created_at": "2026-05-06T08:30:00.000Z"
    }
  ]
}
```

---

## 3. Detail Dokumen

**`GET /api/doc/penyimpanan-dokumen/:id`**

### Response — 200 OK

```json
{
  "status": "success",
  "data": {
    "id": 1,
    "id_toko": 10,
    "nama_dokumen": "rab",
    "drive_file_id": "1abCdef...",
    "drive_folder_id": "1abcdEFG...",
    "link_dokumen": "https://drive.google.com/file/d/.../view",
    "link_folder": "https://drive.google.com/drive/folders/1abcdEFG...",
    "created_at": "2026-05-06T08:30:00.000Z"
  }
}
```

---

## 4. Update Dokumen

**`PUT /api/doc/penyimpanan-dokumen/:id`**

- Bisa ganti metadata `nama_dokumen`.
- Jika ingin ganti file, upload file baru di field `dokumen`.

### Request Body (multipart/form-data)

```
nama_dokumen=rab_final

dokumen=<file>
```

### Response — 200 OK

```json
{
  "status": "success",
  "message": "Dokumen berhasil diperbarui",
  "data": {
    "id": 1,
    "id_toko": 10,
    "nama_dokumen": "rab_final",
    "drive_file_id": "1abCdef...",
    "drive_folder_id": "1abcdEFG...",
    "link_dokumen": "https://drive.google.com/file/d/.../view",
    "link_folder": "https://drive.google.com/drive/folders/1abcdEFG...",
    "created_at": "2026-05-06T08:30:00.000Z"
  }
}
```

---

## 5. Delete Dokumen

**`DELETE /api/doc/penyimpanan-dokumen/:id`**

### Response — 200 OK

```json
{
  "status": "success",
  "message": "Dokumen berhasil dihapus",
  "data": {
    "id": 1,
    "id_toko": 10,
    "nama_dokumen": "rab_final",
    "drive_file_id": "1abCdef...",
    "drive_folder_id": "1abcdEFG...",
    "link_dokumen": "https://drive.google.com/file/d/.../view",
    "link_folder": "https://drive.google.com/drive/folders/1abcdEFG...",
    "created_at": "2026-05-06T08:30:00.000Z"
  }
}
```

---

## Error Responses

| Code | Kondisi                           |
| ---- | --------------------------------- |
| 400  | Dokumen wajib diupload            |
| 404  | Toko atau dokumen tidak ditemukan |
| 422  | Validasi request gagal            |
| 500  | Google Drive belum terkonfigurasi |
