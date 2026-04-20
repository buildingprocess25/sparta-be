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
| 6   | `PUT`    | `/api/pengawasan/bulk` | Update banyak data pengawasan (bulk)  |
| 7   | `DELETE` | `/api/pengawasan/:id`  | Hapus data pengawasan                 |

---

## Struktur Tabel `pengawasan`

Kolom sesuai relasi ke `gantt_chart`:

- `id` (PK)
- `id_gantt` (FK -> `gantt_chart.id`)
- `id_pengawasan_gantt` (FK -> `pengawasan_gantt.id`)
- `kategori_pekerjaan` (varchar)
- `jenis_pekerjaan` (varchar)
- `catatan` (varchar, nullable)
- `dokumentasi` (varchar, nullable)
- `status` (varchar: `progress` / `selesai` / `terlambat`)
- `created_at` (timestamp)

## Struktur Tabel `berkas_pengawasan`

Tabel relasi 1-ke-1 dengan `pengawasan_gantt` untuk menyimpan link PDF laporan pengawasan:

- `id` (PK)
- `id_pengawasan_gantt` (FK -> `pengawasan_gantt.id`, UNIQUE)
- `link_pdf_pengawasan` (varchar, nullable)
- `created_at` (timestamp)

**Catatan penting:**

- Setiap kali ada create pengawasan (single atau bulk), sistem otomatis generate PDF laporan pengawasan yang berisi semua item pengawasan untuk `id_pengawasan_gantt` tersebut.
- PDF diupload ke Google Drive, lalu linknya disimpan/ditimpa (upsert) ke tabel `berkas_pengawasan`.
- Proses PDF generation berjalan secara **background (fire-and-forget)**, sehingga response create tetap cepat.
- Jika ada request create baru untuk `id_pengawasan_gantt` yang sama, PDF akan di-generate ulang (file lama di Drive dihapus, diganti file baru).
- Objek `berkas_pengawasan` ditampilkan di response endpoint **list** (`GET /`) dan **detail** (`GET /:id`).

---

## 1. Create Pengawasan (Single)

**`POST /api/pengawasan`**

### Request Body

```json
{
  "id_gantt": 10,
  "tanggal_pengawasan": "2026-04-15",
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
| `tanggal_pengawasan` | wajib, string min 1                              |
| `kategori_pekerjaan` | wajib, string min 1                              |
| `jenis_pekerjaan`    | wajib, string min 1                              |
| `catatan`            | opsional, string min 1                           |
| `status`             | opsional, hanya `progress`/`selesai`/`terlambat` |

Catatan: field `dokumentasi` tidak perlu dikirim di request body create. Nilai `dokumentasi` akan diisi otomatis dari link hasil upload `file_dokumentasi`.

Catatan format tanggal:

- backend menormalkan `tanggal_pengawasan` sebelum lookup ke tabel `pengawasan_gantt`
- jika frontend kirim format dengan `-`, otomatis diubah ke format `/`
- contoh: `15-04-2026` -> `15/04/2026`, `2026-04-15` -> `15/04/2026`

### Response — 201 Created

```json
{
  "status": "success",
  "message": "Data pengawasan berhasil disimpan",
  "data": {
    "id": 1,
    "id_gantt": 10,
    "id_pengawasan_gantt": 77,
    "kategori_pekerjaan": "PEKERJAAN SIPIL",
    "jenis_pekerjaan": "PENGECATAN DINDING",
    "catatan": "Mulai pengecatan area depan",
    "dokumentasi": "https://example.com/foto-awal.jpg",
    "status": "progress",
    "created_at": "2026-04-13T12:00:00.000Z"
  }
}
```

**Side-effect:** di background, sistem akan generate PDF laporan pengawasan dan menyimpan linknya ke tabel `berkas_pengawasan` (upsert berdasarkan `id_pengawasan_gantt`). PDF lama akan ditimpa jika sudah ada.

---

## 2. Create Pengawasan (Bulk)

**`POST /api/pengawasan/bulk`**

### Request Body

```json
{
  "items": [
    {
      "id_gantt": 10,
      "tanggal_pengawasan": "2026-04-15",
      "kategori_pekerjaan": "PEKERJAAN SIPIL",
      "jenis_pekerjaan": "PENGECATAN DINDING",
      "catatan": "Mulai pekerjaan hari ini",
      "status": "progress"
    },
    {
      "id_gantt": 10,
      "tanggal_pengawasan": "2026-04-15",
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
- field body opsional: `file_dokumentasi_indexes` dikirim sebagai JSON string array index item
- behavior:
  - jika jumlah `file_dokumentasi` = 1, link file tersebut dipakai untuk semua item
  - jika jumlah `file_dokumentasi` = jumlah item, tiap file dipetakan berdasarkan index item
  - jika hanya sebagian item yang punya file, kirim `file_dokumentasi_indexes` agar tiap file diarahkan ke index item tertentu (contoh `[2,6]` berarti file pertama untuk `items[2]`, file kedua untuk `items[6]`)
  - link hasil upload otomatis disimpan ke kolom `dokumentasi`

Contoh multipart untuk sparse file mapping:

- `items`: string JSON array (misalnya total 10 item)
- `file_dokumentasi`: 2 file upload
- `file_dokumentasi_indexes`: `[2,6]`

Hasilnya: hanya `items[2]` dan `items[6]` yang kolom `dokumentasi` terisi dari link upload; item lain tetap `null` jika tidak punya file.

### Response — 201 Created

```json
{
  "status": "success",
  "message": "2 data pengawasan berhasil disimpan",
  "data": [
    {
      "id": 11,
      "id_gantt": 10,
      "id_pengawasan_gantt": 77,
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
      "id_pengawasan_gantt": 77,
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

**Side-effect:** di background, sistem akan generate PDF laporan pengawasan untuk setiap `id_pengawasan_gantt` unik dan menyimpan linknya ke tabel `berkas_pengawasan` (upsert). PDF lama akan ditimpa jika sudah ada.

---

## 3. List Pengawasan

**`GET /api/pengawasan`**

### Query Parameters (opsional)

| Parameter            | Tipe     | Deskripsi                                             |
| -------------------- | -------- | ----------------------------------------------------- |
| `id_gantt`           | `number` | Filter berdasarkan gantt                              |
| `tanggal`            | `string` | Filter tanggal pengawasan (wajib disertai `id_gantt`) |
| `kategori_pekerjaan` | `string` | Filter berdasarkan kategori                           |
| `jenis_pekerjaan`    | `string` | Filter berdasarkan jenis                              |
| `status`             | `string` | Filter `progress`/`selesai`/`terlambat`               |

Jika menggunakan `tanggal`, backend akan:

1. mencari data di tabel `pengawasan_gantt` berdasarkan pasangan `id_gantt` + `tanggal_pengawasan`
2. mengambil `id` dari hasil tersebut (`id_pengawasan_gantt`)
3. memfilter data tabel `pengawasan` berdasarkan `id_gantt` dan `id_pengawasan_gantt`

Contoh query:

- `GET /api/pengawasan?tanggal=2026-04-15&id_gantt=10`

Catatan:

- jika `tanggal` diisi tanpa `id_gantt`, API mengembalikan `400`
- jika pasangan `tanggal` + `id_gantt` tidak ditemukan di `pengawasan_gantt`, response list bernilai array kosong
- format `tanggal` dengan `-` juga didukung karena backend otomatis normalisasi ke `/`

### Response — 200 OK

```json
{
  "status": "success",
  "data": [
    {
      "id": 12,
      "id_gantt": 10,
      "id_pengawasan_gantt": 77,
      "kategori_pekerjaan": "PEKERJAAN ELEKTRIKAL",
      "jenis_pekerjaan": "INSTALASI LAMPU",
      "catatan": "Pekerjaan sudah selesai",
      "dokumentasi": "https://example.com/final-1.jpg",
      "status": "selesai",
      "created_at": "2026-04-13T12:00:00.000Z",
      "berkas_pengawasan": {
        "id": 1,
        "id_pengawasan_gantt": 77,
        "link_pdf_pengawasan": "https://drive.google.com/file/d/abc123/view",
        "created_at": "2026-04-13T12:00:05.000Z"
      }
    }
  ]
}
```

Catatan:

- Objek `berkas_pengawasan` ditampilkan di setiap item response berdasarkan `id_pengawasan_gantt`.
- Jika PDF belum di-generate (misalnya masih proses background), nilai `berkas_pengawasan` adalah `null`.

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
    "id_pengawasan_gantt": 77,
    "kategori_pekerjaan": "PEKERJAAN ELEKTRIKAL",
    "jenis_pekerjaan": "INSTALASI LAMPU",
    "catatan": "Pekerjaan sudah selesai",
    "dokumentasi": "https://example.com/final-1.jpg",
    "status": "selesai",
    "created_at": "2026-04-13T12:00:00.000Z",
    "berkas_pengawasan": {
      "id": 1,
      "id_pengawasan_gantt": 77,
      "link_pdf_pengawasan": "https://drive.google.com/file/d/abc123/view",
      "created_at": "2026-04-13T12:00:05.000Z"
    }
  }
}
```

Catatan: jika PDF belum di-generate, nilai `berkas_pengawasan` adalah `null`.

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

Jika update via multipart hanya kirim `rev_file_dokumentasi` tanpa field body lain, tetap valid dan hanya kolom `dokumentasi` yang diupdate.

Partial update:

- jika kirim hanya `status`, maka hanya kolom `status` yang diupdate
- jika kirim hanya `catatan`, maka hanya kolom `catatan` yang diupdate
- jika kirim `catatan` + `status`, hanya 2 kolom itu yang diupdate
- kolom lain yang tidak dikirim tetap menggunakan nilai lama

Catatan upload revisi dokumentasi:

- jika `rev_file_dokumentasi` dikirim, file diupload ke Google Drive lalu `dokumentasi` diisi link baru
- jika `rev_file_dokumentasi` tidak dikirim, `dokumentasi` lama tetap di database

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

## 6. Update Pengawasan (Bulk)

**`PUT /api/pengawasan/bulk`**

### Request Body (JSON)

```json
{
  "items": [
    {
      "id": 12,
      "status": "progress"
    },
    {
      "id": 13,
      "catatan": "Update progress mingguan",
      "status": "selesai"
    }
  ]
}
```

Catatan:

- setiap item wajib punya `id`
- setiap item diupdate berdasarkan `id` di body
- update bersifat partial per item (hanya field yang dikirim yang diupdate)
- field yang tidak dikirim tetap menggunakan nilai lama

### Upload Revisi Dokumentasi (multipart/form-data)

Untuk update bulk dengan file revisi dokumentasi:

- field body: `items` dikirim sebagai JSON string
- field file: `rev_file_dokumentasi` (bisa banyak file)
- field body opsional: `rev_file_dokumentasi_indexes` sebagai JSON string array index item

Behavior mapping file:

- jika kirim `rev_file_dokumentasi_indexes`, tiap file dipetakan ke item index tertentu
- jika tidak kirim `rev_file_dokumentasi_indexes`, jumlah file harus sama dengan jumlah item dan dipetakan 1:1 sesuai urutan index
- jika item tidak dapat file revisi dan tidak ada `dokumentasi` di body, nilai dokumentasi lama tetap

Contoh sparse mapping:

- `items`: total 3 item
- `rev_file_dokumentasi`: 2 file
- `rev_file_dokumentasi_indexes`: `[0,2]`

Hasilnya: hanya `items[0]` dan `items[2]` yang kolom `dokumentasi` diupdate dari file upload.

### Response — 200 OK

```json
{
  "status": "success",
  "message": "2 data pengawasan berhasil diperbarui",
  "data": [
    {
      "id": 12,
      "id_gantt": 10,
      "id_pengawasan_gantt": 77,
      "kategori_pekerjaan": "PEKERJAAN ELEKTRIKAL",
      "jenis_pekerjaan": "INSTALASI PANEL",
      "catatan": "Update progress mingguan",
      "dokumentasi": "https://example.com/progress-terbaru.jpg",
      "status": "progress",
      "created_at": "2026-04-13T12:00:00.000Z"
    },
    {
      "id": 13,
      "id_gantt": 10,
      "id_pengawasan_gantt": 77,
      "kategori_pekerjaan": "PEKERJAAN SIPIL",
      "jenis_pekerjaan": "PENGECATAN DINDING",
      "catatan": "Selesai hari ini",
      "dokumentasi": "https://example.com/progress-final.jpg",
      "status": "selesai",
      "created_at": "2026-04-13T12:00:00.000Z"
    }
  ]
}
```

---

## 7. Delete Pengawasan

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
