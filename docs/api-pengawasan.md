# Dokumentasi API Pengawasan — sparta-api

Base URL: `/api/pengawasan`

---

## Daftar Endpoint

| #   | Method   | Path                   | Deskripsi                             |
| --- | -------- | ---------------------- | ------------------------------------- |
| 1   | `POST`   | `/api/pengawasan`      | Buat data pengawasan (single)         |
| 2   | `POST`   | `/api/pengawasan/bulk` | Buat banyak data pengawasan (bulk)    |
| 3   | `GET`    | `/api/pengawasan`      | List data pengawasan (+ filter)       |
| 4   | `GET`    | `/api/pengawasan/:id`  | Detail data pengawasan berdasarkan ID |
| 5   | `PUT`    | `/api/pengawasan/:id`  | Update data pengawasan                |
| 6   | `DELETE` | `/api/pengawasan/:id`  | Hapus data pengawasan                 |

---

## Struktur Tabel `pengawasan`

Kolom sesuai relasi ke `gantt_chart`:

- `id` (PK)
- `id_gantt` (FK -> `gantt_chart.id`)
- `kategori_pekerjaan` (varchar)
- `jenis_pekerjaan` (varchar)
- `catatan` (varchar, nullable)
- `dokumentasi` (varchar, nullable)
- `status` (varchar: `progress` / `selesai` / `terlambat`)
- `created_at` (timestamp)

---

## 1. Create Pengawasan (Single)

**`POST /api/pengawasan`**

### Request Body

```json
{
  "id_gantt": 10,
  "kategori_pekerjaan": "PEKERJAAN SIPIL",
  "jenis_pekerjaan": "PENGECATAN DINDING",
  "catatan": "Mulai pengecatan area depan",
  "status": "progress"
}
```

### Upload Dokumentasi (multipart/form-data)

Selain JSON biasa, endpoint ini juga menerima upload file:

- field file: `file_dokumentasi`
- behavior: file diupload ke Google Drive, lalu link hasil upload otomatis disimpan ke `dokumentasi`

### Validasi

| Field                | Aturan                                           |
| -------------------- | ------------------------------------------------ |
| `id_gantt`           | wajib, integer > 0                               |
| `kategori_pekerjaan` | wajib, string min 1                              |
| `jenis_pekerjaan`    | wajib, string min 1                              |
| `catatan`            | opsional, string min 1                           |
| `status`             | opsional, hanya `progress`/`selesai`/`terlambat` |

Catatan: field `dokumentasi` tidak perlu dikirim di request body create. Nilai `dokumentasi` akan diisi otomatis dari link hasil upload `file_dokumentasi`.

### Response — 201 Created

```json
{
  "status": "success",
  "message": "Data pengawasan berhasil disimpan",
  "data": {
    "id": 1,
    "id_gantt": 10,
    "kategori_pekerjaan": "PEKERJAAN SIPIL",
    "jenis_pekerjaan": "PENGECATAN DINDING",
    "catatan": "Mulai pengecatan area depan",
    "dokumentasi": "https://example.com/foto-awal.jpg",
    "status": "progress",
    "created_at": "2026-04-13T12:00:00.000Z"
  }
}
```

---

## 2. Create Pengawasan (Bulk)

**`POST /api/pengawasan/bulk`**

### Request Body

```json
{
  "items": [
    {
      "id_gantt": 10,
      "kategori_pekerjaan": "PEKERJAAN SIPIL",
      "jenis_pekerjaan": "PENGECATAN DINDING",
      "catatan": "Mulai pekerjaan hari ini",
      "status": "progress"
    },
    {
      "id_gantt": 10,
      "kategori_pekerjaan": "PEKERJAAN ELEKTRIKAL",
      "jenis_pekerjaan": "INSTALASI LAMPU",
      "catatan": "Pekerjaan sudah selesai",
      "status": "selesai"
    }
  ]
}
```

### Upload Dokumentasi (multipart/form-data)

Endpoint bulk juga menerima upload file:

- field file: `file_dokumentasi`
- field body: `items` dikirim sebagai JSON string
- behavior:
  - jika jumlah `file_dokumentasi` = 1, link file tersebut dipakai untuk semua item
  - jika jumlah `file_dokumentasi` = jumlah item, tiap file dipetakan berdasarkan index item
  - link hasil upload otomatis disimpan ke kolom `dokumentasi`

### Response — 201 Created

```json
{
  "status": "success",
  "message": "2 data pengawasan berhasil disimpan",
  "data": [
    {
      "id": 11,
      "id_gantt": 10,
      "kategori_pekerjaan": "PEKERJAAN SIPIL",
      "jenis_pekerjaan": "PENGECATAN DINDING",
      "catatan": "Mulai pekerjaan hari ini",
      "dokumentasi": "https://example.com/progress-1.jpg",
      "status": "progress",
      "created_at": "2026-04-13T12:00:00.000Z"
    },
    {
      "id": 12,
      "id_gantt": 10,
      "kategori_pekerjaan": "PEKERJAAN ELEKTRIKAL",
      "jenis_pekerjaan": "INSTALASI LAMPU",
      "catatan": "Pekerjaan sudah selesai",
      "dokumentasi": "https://example.com/final-1.jpg",
      "status": "selesai",
      "created_at": "2026-04-13T12:00:00.000Z"
    }
  ]
}
```

---

## 3. List Pengawasan

**`GET /api/pengawasan`**

### Query Parameters (opsional)

| Parameter            | Tipe     | Deskripsi                               |
| -------------------- | -------- | --------------------------------------- |
| `id_gantt`           | `number` | Filter berdasarkan gantt                |
| `kategori_pekerjaan` | `string` | Filter berdasarkan kategori             |
| `jenis_pekerjaan`    | `string` | Filter berdasarkan jenis                |
| `status`             | `string` | Filter `progress`/`selesai`/`terlambat` |

### Response — 200 OK

```json
{
  "status": "success",
  "data": [
    {
      "id": 12,
      "id_gantt": 10,
      "kategori_pekerjaan": "PEKERJAAN ELEKTRIKAL",
      "jenis_pekerjaan": "INSTALASI LAMPU",
      "catatan": "Pekerjaan sudah selesai",
      "dokumentasi": "https://example.com/final-1.jpg",
      "status": "selesai",
      "created_at": "2026-04-13T12:00:00.000Z"
    }
  ]
}
```

---

## 4. Detail Pengawasan

**`GET /api/pengawasan/:id`**

### Response — 200 OK

```json
{
  "status": "success",
  "data": {
    "id": 12,
    "id_gantt": 10,
    "kategori_pekerjaan": "PEKERJAAN ELEKTRIKAL",
    "jenis_pekerjaan": "INSTALASI LAMPU",
    "catatan": "Pekerjaan sudah selesai",
    "dokumentasi": "https://example.com/final-1.jpg",
    "status": "selesai",
    "created_at": "2026-04-13T12:00:00.000Z"
  }
}
```

---

## 5. Update Pengawasan

**`PUT /api/pengawasan/:id`**

### Request Body

```json
{
  "jenis_pekerjaan": "INSTALASI PANEL",
  "catatan": "Update progress mingguan",
  "dokumentasi": "https://example.com/progress-terbaru.jpg",
  "status": "progress"
}
```

### Upload Revisi Dokumentasi (multipart/form-data)

Untuk revisi dokumentasi berdasarkan `id`, kirim file:

- field file: `rev_file_dokumentasi`
- behavior: file diupload ke Google Drive, lalu kolom `dokumentasi` diupdate dengan link baru

### Validasi

Minimal salah satu field berikut harus diisi:

- `kategori_pekerjaan`
- `jenis_pekerjaan`
- `catatan`
- `dokumentasi`
- `status`

### Response — 200 OK

```json
{
  "status": "success",
  "message": "Data pengawasan berhasil diperbarui",
  "data": {
    "id": 12,
    "id_gantt": 10,
    "kategori_pekerjaan": "PEKERJAAN ELEKTRIKAL",
    "jenis_pekerjaan": "INSTALASI PANEL",
    "catatan": "Update progress mingguan",
    "dokumentasi": "https://example.com/progress-terbaru.jpg",
    "status": "progress",
    "created_at": "2026-04-13T12:00:00.000Z"
  }
}
```

---

## 6. Delete Pengawasan

**`DELETE /api/pengawasan/:id`**

### Response — 200 OK

```json
{
  "status": "success",
  "message": "Data pengawasan berhasil dihapus",
  "data": {
    "id": 12,
    "deleted": true
  }
}
```

---

## Error Responses

| Code | Kondisi                                               |
| ---- | ----------------------------------------------------- |
| 400  | Status tidak valid (`progress`/`selesai`/`terlambat`) |
| 404  | Data pengawasan tidak ditemukan                       |
| 404  | `id_gantt` tidak ditemukan di tabel `gantt_chart`     |
| 422  | Validasi request gagal (Zod)                          |
