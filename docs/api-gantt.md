# Dokumentasi API Gantt Chart — sparta-api

Base URL (Node.js): `/api/gantt`  
Base URL (Python):  `/api/gantt-sql`

> **Catatan:** Modul ini menggunakan PostgreSQL sebagai penyimpanan data (sebelumnya Google Spreadsheet).  
> Tabel yang digunakan: `gantt_chart`, `kategori_pekerjaan_gantt`, `day_gantt_chart`, `pengawasan_gantt`, `dependency_gantt`, `toko`.

---

## Daftar Endpoint

| # | Method | Path (Node.js) | Path (Python) | Deskripsi |
|---|--------|-----------------|---------------|-----------|
| 1 | `POST` | `/api/gantt/submit` | `/api/gantt-sql/submit` | Buat Gantt Chart baru |
| 2 | `GET` | `/api/gantt` | `/api/gantt-sql` | List semua Gantt Chart (+ filter) |
| 3 | `GET` | `/api/gantt/:id` | `/api/gantt-sql/:id` | Detail Gantt Chart lengkap |
| 4 | `PUT` | `/api/gantt/:id` | `/api/gantt-sql/:id` | Update Gantt Chart |
| 5 | `POST` | `/api/gantt/:id/lock` | `/api/gantt-sql/:id/lock` | Kunci Gantt Chart |
| 6 | `DELETE` | `/api/gantt/:id` | `/api/gantt-sql/:id` | Hapus Gantt Chart |
| 7 | `POST` | `/api/gantt/:id/day` | `/api/gantt-sql/:id/day` | Tambah day items |
| 8 | `POST` | `/api/gantt/:id/day/keterlambatan` | `/api/gantt-sql/:id/day/keterlambatan` | Update keterlambatan |
| 9 | `POST` | `/api/gantt/:id/day/kecepatan` | `/api/gantt-sql/:id/day/kecepatan` | Update kecepatan |
| 10 | `POST` | `/api/gantt/:id/pengawasan` | `/api/gantt-sql/:id/pengawasan` | Manage pengawasan |

---

## Skema Database

```
┌──────────────┐      ┌─────────────────┐
│    toko       │─────<│   gantt_chart    │
│ (id, ulok...) │ 1  N │ (id, id_toko,   │
└──────────────┘      │  status, email,  │
                       │  timestamp)      │
                       └───────┬─────────┘
                               │ 1
              ┌────────────────┼─────────────────┐
              │ N              │ N                │ N
   ┌──────────▼──────┐  ┌─────▼──────────┐  ┌───▼──────────────┐
   │kategori_pekerjaan│  │ pengawasan_    │  │  dependency_     │
   │    _gantt        │  │   gantt        │  │    gantt         │
   │ (id, id_gantt,  │  │ (id, id_gantt, │  │ (id, id_gantt,   │
   │  kategori)      │  │  kategori)     │  │  id_kategori,    │
   └───────┬─────────┘  └────────────────┘  │  id_kat_terikat) │
           │ 1                               └──────────────────┘
           │ N
   ┌───────▼─────────┐
   │ day_gantt_chart  │
   │ (id, id_gantt,  │
   │  id_kategori,   │
   │  h_awal,h_akhir,│
   │  keterlambatan,  │
   │  kecepatan)     │
   └─────────────────┘
```

---

## 1. Submit Gantt Chart

**`POST /api/gantt/submit`**

Membuat Gantt Chart baru. Sistem akan:
- Upsert toko berdasarkan `nomor_ulok`
- Cek duplikasi Gantt Chart aktif untuk ULOK yang sama
- Simpan data ke 5 tabel dalam 1 transaksi (`toko` + `gantt_chart` + `kategori_pekerjaan_gantt` + `day_gantt_chart` + opsional `pengawasan_gantt` & `dependency_gantt`)
- Set status awal: `active`

### Request Body

```json
{
  "nomor_ulok": "7AZ1-0001-0001",
  "nama_toko": "Alfamart Jl Sudirman",
  "kode_toko": "ALF001",
  "proyek": "Renovasi",
  "cabang": "JAKARTA",
  "alamat": "Jl. Sudirman No 1",
  "nama_kontraktor": "PT Kontraktor ABC",
  "lingkup_pekerjaan": "SIPIL",
  "email_pembuat": "user@example.com",
  "kategori_pekerjaan": [
    "PEKERJAAN PERSIAPAN",
    "PEKERJAAN BOBOKAN",
    "PEKERJAAN INSTALASI",
    "PEKERJAAN FINISHING"
  ],
  "day_items": [
    {
      "kategori_pekerjaan": "PEKERJAAN PERSIAPAN",
      "h_awal": "01/04/2026",
      "h_akhir": "05/04/2026",
      "keterlambatan": "",
      "kecepatan": ""
    },
    {
      "kategori_pekerjaan": "PEKERJAAN BOBOKAN",
      "h_awal": "06/04/2026",
      "h_akhir": "12/04/2026"
    },
    {
      "kategori_pekerjaan": "PEKERJAAN INSTALASI",
      "h_awal": "13/04/2026",
      "h_akhir": "20/04/2026"
    },
    {
      "kategori_pekerjaan": "PEKERJAAN FINISHING",
      "h_awal": "21/04/2026",
      "h_akhir": "30/04/2026"
    }
  ],
  "pengawasan": [
    { "kategori_pekerjaan": "PEKERJAAN PERSIAPAN" },
    { "kategori_pekerjaan": "PEKERJAAN FINISHING" }
  ],
  "dependencies": [
    {
      "kategori_pekerjaan": "PEKERJAAN BOBOKAN",
      "kategori_pekerjaan_terikat": "PEKERJAAN PERSIAPAN"
    },
    {
      "kategori_pekerjaan": "PEKERJAAN INSTALASI",
      "kategori_pekerjaan_terikat": "PEKERJAAN BOBOKAN"
    },
    {
      "kategori_pekerjaan": "PEKERJAAN FINISHING",
      "kategori_pekerjaan_terikat": "PEKERJAAN INSTALASI"
    }
  ]
}
```

### Validasi

| Field | Tabel | Aturan |
|-------|-------|--------|
| `nomor_ulok` | toko | **Wajib**, string min 1 |
| `nama_toko` | toko | Opsional |
| `kode_toko` | toko | Opsional |
| `proyek` | toko | Opsional |
| `cabang` | toko | Opsional |
| `alamat` | toko | Opsional |
| `nama_kontraktor` | toko | Opsional |
| `lingkup_pekerjaan` | toko | Opsional |
| `email_pembuat` | gantt_chart | **Wajib**, format email |
| `kategori_pekerjaan` | kategori_pekerjaan_gantt | **Wajib**, array string min 1 |
| `day_items` | day_gantt_chart | **Wajib**, array min 1 |
| `day_items[].kategori_pekerjaan` | day_gantt_chart | **Wajib**, harus ada di `kategori_pekerjaan` |
| `day_items[].h_awal` | day_gantt_chart | **Wajib**, string  |
| `day_items[].h_akhir` | day_gantt_chart | **Wajib**, string  |
| `day_items[].keterlambatan` | day_gantt_chart | Opsional |
| `day_items[].kecepatan` | day_gantt_chart | Opsional |
| `pengawasan` | pengawasan_gantt | Opsional, array |
| `pengawasan[].kategori_pekerjaan` | pengawasan_gantt | Wajib jika ada |
| `dependencies` | dependency_gantt | Opsional, array |
| `dependencies[].kategori_pekerjaan` | dependency_gantt | Wajib, harus ada di `kategori_pekerjaan` |
| `dependencies[].kategori_pekerjaan_terikat` | dependency_gantt | Wajib, harus ada di `kategori_pekerjaan` |

### Response — 201 Created

```json
{
  "status": "success",
  "message": "Gantt Chart berhasil disimpan",
  "data": {
    "id": 1,
    "id_toko": 5,
    "status": "active",
    "email_pembuat": "user@example.com",
    "timestamp": "2026-03-12",
    "toko_id": 5
  }
}
```

### Error Responses

| Code | Kondisi |
|------|---------|
| 400  | JSON body tidak valid / field wajib kosong |
| 409  | Gantt Chart aktif untuk ULOK yang sama sudah ada |
| 422  | Validasi Zod gagal (Node.js) |

---

## 2. List Gantt Chart

**`GET /api/gantt`**

### Query Parameters

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `status` | string | Filter: `active` atau `terkunci` |
| `nomor_ulok` | string | Filter berdasarkan nomor ULOK |
| `email_pembuat` | string | Filter berdasarkan email pembuat |

### Contoh Request

```
GET /api/gantt?status=active
GET /api/gantt?nomor_ulok=7AZ1-0001-0001
GET /api/gantt?email_pembuat=user@example.com
GET /api/gantt
```

### Response — 200 OK

```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "id_toko": 5,
      "status": "active",
      "email_pembuat": "user@example.com",
      "timestamp": "2026-03-12",
      "nomor_ulok": "7AZ1-0001-0001",
      "nama_toko": "ALFAMART CONTOH",
      "cabang": "CIKOKOL",
      "proyek": "RENOVASI"
    }
  ]
}
```

---

## 3. Detail Gantt Chart

**`GET /api/gantt/:id`**

### Path Parameter

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `id` | number | ID Gantt Chart |

### Response — 200 OK

```json
{
  "status": "success",
  "data": {
    "gantt": {
      "id": 1,
      "id_toko": 5,
      "status": "active",
      "email_pembuat": "user@example.com",
      "timestamp": "2026-03-12"
    },
    "toko": {
      "id": 5,
      "nomor_ulok": "7AZ1-0001-0001",
      "lingkup_pekerjaan": "SIPIL",
      "nama_toko": "ALFAMART CONTOH",
      "kode_toko": "ALF001",
      "proyek": "RENOVASI",
      "cabang": "CIKOKOL",
      "alamat": "Jl. Contoh No. 1",
      "nama_kontraktor": "PT Kontraktor ABC"
    },
    "kategori_pekerjaan": [
      { "id": 1, "id_gantt": 1, "kategori_pekerjaan": "PEKERJAAN PERSIAPAN" },
      { "id": 2, "id_gantt": 1, "kategori_pekerjaan": "PEKERJAAN BOBOKAN" },
      { "id": 3, "id_gantt": 1, "kategori_pekerjaan": "PEKERJAAN INSTALASI" },
      { "id": 4, "id_gantt": 1, "kategori_pekerjaan": "PEKERJAAN FINISHING" }
    ],
    "day_items": [
      {
        "id": 1,
        "id_gantt": 1,
        "id_kategori_pekerjaan_gantt": 1,
        "h_awal": "01/04/2026",
        "h_akhir": "05/04/2026",
        "keterlambatan": null,
        "kecepatan": null,
        "kategori_pekerjaan": "PEKERJAAN PERSIAPAN"
      },
      {
        "id": 2,
        "id_gantt": 1,
        "id_kategori_pekerjaan_gantt": 2,
        "h_awal": "06/04/2026",
        "h_akhir": "12/04/2026",
        "keterlambatan": null,
        "kecepatan": null,
        "kategori_pekerjaan": "PEKERJAAN BOBOKAN"
      }
    ],
    "pengawasan": [
      { "id": 1, "id_gantt": 1, "kategori_pekerjaan": "PEKERJAAN PERSIAPAN" },
      { "id": 2, "id_gantt": 1, "kategori_pekerjaan": "PEKERJAAN FINISHING" }
    ],
    "dependencies": [
      {
        "id": 1,
        "id_gantt": 1,
        "id_kategori": 2,
        "id_kategori_terikat": 1,
        "kategori_pekerjaan": "PEKERJAAN BOBOKAN",
        "kategori_pekerjaan_terikat": "PEKERJAAN PERSIAPAN"
      },
      {
        "id": 2,
        "id_gantt": 1,
        "id_kategori": 3,
        "id_kategori_terikat": 2,
        "kategori_pekerjaan": "PEKERJAAN INSTALASI",
        "kategori_pekerjaan_terikat": "PEKERJAAN BOBOKAN"
      }
    ]
  }
}
```

### Error

| Code | Kondisi |
|------|---------|
| 404  | Gantt Chart tidak ditemukan |

---

## 4. Update Gantt Chart

**`PUT /api/gantt/:id`**

Update isi Gantt Chart. Jika `kategori_pekerjaan` dan `day_items` dikirim, semua data children (kategori, day, dependency) akan di-replace total. Pengawasan di-replace jika field `pengawasan` dikirim.

### Path Parameter

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `id` | number | ID Gantt Chart |

### Request Body

```json
{
  "kategori_pekerjaan": [
    "PEKERJAAN PERSIAPAN",
    "PEKERJAAN INSTALASI",
    "PEKERJAAN FINISHING"
  ],
  "day_items": [
    {
      "kategori_pekerjaan": "PEKERJAAN PERSIAPAN",
      "h_awal": "01/04/2026",
      "h_akhir": "07/04/2026"
    },
    {
      "kategori_pekerjaan": "PEKERJAAN INSTALASI",
      "h_awal": "08/04/2026",
      "h_akhir": "18/04/2026"
    },
    {
      "kategori_pekerjaan": "PEKERJAAN FINISHING",
      "h_awal": "19/04/2026",
      "h_akhir": "30/04/2026"
    }
  ],
  "dependencies": [
    {
      "kategori_pekerjaan": "PEKERJAAN INSTALASI",
      "kategori_pekerjaan_terikat": "PEKERJAAN PERSIAPAN"
    }
  ],
  "pengawasan": [
    { "kategori_pekerjaan": "PEKERJAAN FINISHING" }
  ]
}
```

### Response — 200 OK

```json
{
  "status": "success",
  "message": "Gantt Chart berhasil diperbarui",
  "data": { /* detail gantt chart lengkap (sama seperti endpoint 3) */ }
}
```

### Error

| Code | Kondisi |
|------|---------|
| 404  | Gantt Chart tidak ditemukan |
| 409  | Gantt Chart sudah terkunci |

---

## 5. Lock (Kunci) Gantt Chart

**`POST /api/gantt/:id/lock`**

Mengubah status Gantt Chart menjadi `terkunci`. Gantt yang terkunci tidak bisa diubah atau dihapus.

### Path Parameter

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `id` | number | ID Gantt Chart |

### Request Body

```json
{
  "email": "koordinator@alfamart.com"
}
```

### Validasi

| Field | Aturan |
|-------|--------|
| `email` | **Wajib**, format email valid |

### Response — 200 OK

```json
{
  "status": "success",
  "message": "Gantt Chart berhasil dikunci",
  "data": {
    "id": "1",
    "old_status": "active",
    "new_status": "terkunci",
    "locked_by": "koordinator@alfamart.com"
  }
}
```

### Error

| Code | Kondisi |
|------|---------|
| 404  | Gantt Chart tidak ditemukan |
| 409  | Gantt Chart sudah terkunci |

---

## 6. Hapus Gantt Chart

**`DELETE /api/gantt/:id`**

Menghapus Gantt Chart beserta semua children (kategori, day, pengawasan, dependency) via CASCADE.

### Path Parameter

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `id` | number | ID Gantt Chart |

### Response — 200 OK

```json
{
  "status": "success",
  "message": "Gantt Chart berhasil dihapus",
  "data": {
    "id": "1",
    "deleted": true
  }
}
```

### Error

| Code | Kondisi |
|------|---------|
| 404  | Gantt Chart tidak ditemukan |
| 409  | Gantt Chart sudah terkunci |

---

## 7. Tambah Day Items

**`POST /api/gantt/:id/day`** (Node.js) | **`POST /api/gantt-sql/:id/day`** (Python)

Menambah day items ke Gantt Chart yang sudah ada tanpa replace data lama.

### Path Parameter

| Parameter | Tipe | Deskripsi |
|-----------|------|----------|
| `id` | number | ID Gantt Chart |

### Request Body

```json
{
  "day_items": [
    {
      "kategori_pekerjaan": "PEKERJAAN PERSIAPAN",
      "h_awal": "01/05/2026",
      "h_akhir": "03/05/2026"
    }
  ]
}
```

### Validasi

| Field | Aturan |
|-------|--------|
| `day_items` | **Wajib**, array min 1 |
| `day_items[].kategori_pekerjaan` | **Wajib**, harus sesuai dengan kategori yang ada di gantt |
| `day_items[].h_awal` | **Wajib**, string |
| `day_items[].h_akhir` | **Wajib**, string |
| `day_items[].keterlambatan` | Opsional |
| `day_items[].kecepatan` | Opsional |

### Response — 201 Created

```json
{
  "status": "success",
  "message": "1 day item(s) berhasil ditambahkan",
  "data": { "inserted": 1 }
}
```

### Error

| Code | Kondisi |
|------|--------|
| 404  | Gantt Chart tidak ditemukan |
| 409  | Gantt Chart sudah terkunci |
| 422  | Validasi Zod gagal |

---

## 8. Update Keterlambatan

**`POST /api/gantt/:id/day/keterlambatan`** (Node.js) | **`POST /api/gantt-sql/:id/day/keterlambatan`** (Python)

Update nilai keterlambatan pada day item tertentu. Day item diidentifikasi berdasarkan kombinasi `kategori_pekerjaan` + `h_awal` + `h_akhir`.

### Path Parameter

| Parameter | Tipe | Deskripsi |
|-----------|------|----------|
| `id` | number | ID Gantt Chart |

### Request Body

```json
{
  "kategori_pekerjaan": "PEKERJAAN INSTALASI",
  "h_awal": "13/04/2026",
  "h_akhir": "20/04/2026",
  "keterlambatan": "3"
}
```

### Validasi

| Field | Aturan |
|-------|--------|
| `kategori_pekerjaan` | **Wajib**, string min 1 |
| `h_awal` | **Wajib**, string min 1 |
| `h_akhir` | **Wajib**, string min 1 |
| `keterlambatan` | **Wajib**, string |

### Response — 200 OK

```json
{
  "status": "success",
  "message": "Keterlambatan berhasil diperbarui",
  "data": { "day_id": 3, "keterlambatan": "3" }
}
```

### Error

| Code | Kondisi |
|------|--------|
| 404  | Gantt Chart atau Day item tidak ditemukan |
| 422  | Validasi Zod gagal |

---

## 9. Update Kecepatan

**`POST /api/gantt/:id/day/kecepatan`** (Node.js) | **`POST /api/gantt-sql/:id/day/kecepatan`** (Python)

Update nilai kecepatan pada day item tertentu. Day item diidentifikasi berdasarkan kombinasi `kategori_pekerjaan` + `h_awal` + `h_akhir`.

### Path Parameter

| Parameter | Tipe | Deskripsi |
|-----------|------|----------|
| `id` | number | ID Gantt Chart |

### Request Body

```json
{
  "kategori_pekerjaan": "PEKERJAAN FINISHING",
  "h_awal": "21/04/2026",
  "h_akhir": "30/04/2026",
  "kecepatan": "2"
}
```

### Validasi

| Field | Aturan |
|-------|--------|
| `kategori_pekerjaan` | **Wajib**, string min 1 |
| `h_awal` | **Wajib**, string min 1 |
| `h_akhir` | **Wajib**, string min 1 |
| `kecepatan` | **Wajib**, string |

### Response — 200 OK

```json
{
  "status": "success",
  "message": "Kecepatan berhasil diperbarui",
  "data": { "day_id": 4, "kecepatan": "2" }
}
```

### Error

| Code | Kondisi |
|------|--------|
| 404  | Gantt Chart atau Day item tidak ditemukan |
| 422  | Validasi Zod gagal |

---

## 10. Manage Pengawasan

**`POST /api/gantt/:id/pengawasan`** (Node.js) | **`POST /api/gantt-sql/:id/pengawasan`** (Python)

Tambah atau hapus pengawasan pada Gantt Chart. Kirim `kategori_pekerjaan` untuk menambah, atau `remove_kategori` untuk menghapus.

### Path Parameter

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `id` | number | ID Gantt Chart |

### Insert — Request Body

```json
{
  "kategori_pekerjaan": "PEKERJAAN PERSIAPAN"
}
```

### Insert — Response — 201 Created

```json
{
  "status": "success",
  "message": "Pengawasan berhasil ditambahkan",
  "data": { "action": "added", "id": 5 }
}
```

### Remove — Request Body

```json
{
  "remove_kategori": "PEKERJAAN PERSIAPAN"
}
```

### Remove — Response — 200 OK

```json
{
  "status": "success",
  "message": "Pengawasan berhasil dihapus",
  "data": { "action": "removed" }
}
```

### Validasi

| Field | Aturan |
|-------|--------|
| `kategori_pekerjaan` | Opsional, string min 1 — untuk menambah |
| `remove_kategori` | Opsional, string min 1 — untuk menghapus |
| | Salah satu dari dua field di atas **wajib** diisi |

### Error

| Code | Kondisi |
|------|---------|
| 404  | Gantt Chart tidak ditemukan |
| 422  | Validasi Zod gagal (kedua field kosong) |

---

## Status Flow

```
┌──────────────────────────┐
│  Submit Gantt Chart       │
│  status = "active"        │
└────────────┬─────────────┘
             │
     ┌───────▼────────┐
     │  Lock endpoint  │
     │  POST /:id/lock │
     └───────┬────────┘
             │
┌────────────▼─────────────┐
│  status = "terkunci"      │
│  (tidak bisa edit/hapus)  │
└──────────────────────────┘
```

---

## Migrasi dari Spreadsheet ke SQL

| Fitur Lama (Spreadsheet) | Fitur Baru (SQL) |
|---------------------------|-------------------|
| `GET /api/get_gantt_data` | `GET /api/gantt/:id` atau `GET /api/gantt-sql/:id` |
| `POST /api/gantt/insert` | `POST /api/gantt/submit` atau `POST /api/gantt-sql/submit` |
| `POST /api/gantt/day/insert` | Include dalam submit, atau `POST /api/gantt-sql/:id/day` |
| `POST /api/gantt/dependency/insert` | Include dalam submit sebagai `dependencies` |
| `POST /api/gantt/pengawasan/insert` | Include dalam submit sebagai `pengawasan`, atau `POST /api/gantt-sql/:id/pengawasan` |
| `POST /api/gantt/day/keterlambatan` | `POST /api/gantt-sql/:id/day/keterlambatan` |
| `POST /api/gantt/day/kecepatan` | `POST /api/gantt-sql/:id/day/kecepatan` |
| Kolom Pengawasan_1..10 di Sheet | Tabel `pengawasan_gantt` (unlimited rows) |
| Pencarian berdasarkan Ulok+Lingkup | Pencarian berdasarkan ID atau filter Ulok |

> Endpoint lama di `app.py` (`/api/gantt/insert`, dll) masih tersedia untuk backward compatibility.
> Endpoint baru di `gantt_api.py` (`/api/gantt-sql/...`) menggunakan SQL (Python).
> Endpoint Node.js di `sparta-api` (`/api/gantt/...`) juga menggunakan SQL — **semua 10 endpoint tersedia di kedua server.**
