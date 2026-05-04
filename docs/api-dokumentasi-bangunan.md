# Dokumentasi API Dokumentasi Bangunan — sparta-api

Base URL: `/api/dok`

---

## Daftar Endpoint

| #   | Method   | Path                              | Deskripsi                               |
| --- | -------- | --------------------------------- | --------------------------------------- |
| 1   | `POST`   | `/api/dok/bangunan`               | Buat dokumentasi bangunan + upload foto |
| 2   | `GET`    | `/api/dok/bangunan`               | List dokumentasi bangunan (+ filter)    |
| 3   | `GET`    | `/api/dok/bangunan/:id`           | Detail dokumentasi bangunan + item foto |
| 4   | `PUT`    | `/api/dok/bangunan/:id`           | Update metadata + optional tambah foto  |
| 5   | `DELETE` | `/api/dok/bangunan/:id`           | Hapus dokumentasi bangunan + item foto  |
| 6   | `POST`   | `/api/dok/bangunan/:id/items`     | Tambah foto (bulk) ke dokumentasi       |
| 7   | `DELETE` | `/api/dok/bangunan/items/:itemId` | Hapus item foto                         |
| 8   | `POST`   | `/api/dok/bangunan/:id/pdf`       | Regenerate PDF dokumentasi bangunan     |

---

## Struktur Tabel `dokumentasi_bangunan`

- `id` (PK)
- `nomor_ulok` (varchar)
- `nama_toko` (varchar)
- `kode_toko` (varchar)
- `cabang` (varchar)
- `tanggal_go` (varchar)
- `tanggal_serah_terima` (varchar)
- `tanggal_ambil_foto` (varchar)
- `spk_awal` (varchar)
- `spk_akhir` (varchar)
- `kontraktor_sipil` (varchar)
- `kontraktor_me` (varchar)
- `link_pdf` (varchar)
- `email_pengirim` (varchar)
- `status_validasi` (varchar)
- `alasan_revisi` (varchar)
- `pic_dokumentasi` (varchar)
- `created_at` (timestamp)

## Struktur Tabel `dokumentasi_bangunan_item`

- `id` (PK)
- `id_dokumentasi_bangunan` (FK -> `dokumentasi_bangunan.id`)
- `link_foto` (varchar)
- `created_at` (timestamp)

**Catatan penting:**

- Saat create dokumentasi bangunan, sistem otomatis generate PDF kolase foto, upload ke Google Drive, lalu simpan link ke `dokumentasi_bangunan.link_pdf`.
- Jika butuh regenerate PDF, gunakan endpoint `/api/dok/bangunan/:id/pdf`.

---

## 1. Create Dokumentasi Bangunan

**`POST /api/dok/bangunan`**

### Request Body (multipart/form-data)

Fields:

- `foto` (file) dapat banyak
- data lain dikirim sebagai field text

Contoh fields:

```
nomor_ulok=ULOK-123
nama_toko=Alfamart Batam
kode_toko=ABT001
cabang=BATAM
tanggal_go=2026-05-04
tanggal_serah_terima=2026-06-01
tanggal_ambil_foto=2026-06-02
spk_awal=SPK-001
spk_akhir=SPK-002
kontraktor_sipil=PT SIPIL
kontraktor_me=PT ME
email_pengirim=user@mail.com
status_validasi=valid
alasan_revisi=
pic_dokumentasi=John Doe
```

### Response — 200 OK

```json
{
  "status": "success",
  "message": "Dokumentasi bangunan berhasil dibuat",
  "data": {
    "dokumentasi": {
      "id": 1,
      "nomor_ulok": "ULOK-123",
      "nama_toko": "Alfamart Batam",
      "kode_toko": "ABT001",
      "cabang": "BATAM",
      "tanggal_go": "2026-05-04",
      "tanggal_serah_terima": "2026-06-01",
      "tanggal_ambil_foto": "2026-06-02",
      "spk_awal": "SPK-001",
      "spk_akhir": "SPK-002",
      "kontraktor_sipil": "PT SIPIL",
      "kontraktor_me": "PT ME",
      "link_pdf": "https://drive.google.com/....",
      "email_pengirim": "user@mail.com",
      "status_validasi": "valid",
      "alasan_revisi": "",
      "pic_dokumentasi": "John Doe",
      "created_at": "2026-05-04T12:00:00.000Z"
    },
    "items": [
      {
        "id": 10,
        "id_dokumentasi_bangunan": 1,
        "link_foto": "https://drive.google.com/uc?export=view&id=...",
        "created_at": "2026-05-04T12:00:00.000Z"
      }
    ],
    "pdf": {
      "link_pdf": "https://drive.google.com/...",
      "filename": "DOKUMENTASI_BANGUNAN_ABT001_ULOK-123_1.pdf",
      "item_count": 1
    }
  }
}
```

---

## 2. List Dokumentasi Bangunan

**`GET /api/dok/bangunan`**

### Query Params (optional)

- `cabang`
- `kode_toko`
- `nomor_ulok`

### Response — 200 OK

```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "nomor_ulok": "ULOK-123",
      "nama_toko": "Alfamart Batam",
      "kode_toko": "ABT001",
      "cabang": "BATAM",
      "tanggal_go": "2026-05-04",
      "tanggal_serah_terima": "2026-06-01",
      "tanggal_ambil_foto": "2026-06-02",
      "spk_awal": "SPK-001",
      "spk_akhir": "SPK-002",
      "kontraktor_sipil": "PT SIPIL",
      "kontraktor_me": "PT ME",
      "link_pdf": "https://drive.google.com/...",
      "email_pengirim": "user@mail.com",
      "status_validasi": "valid",
      "alasan_revisi": "",
      "pic_dokumentasi": "John Doe",
      "created_at": "2026-05-04T12:00:00.000Z"
    }
  ]
}
```

---

## 3. Detail Dokumentasi Bangunan

**`GET /api/dok/bangunan/:id`**

### Response — 200 OK

```json
{
  "status": "success",
  "data": {
    "dokumentasi": {
      "id": 1,
      "nomor_ulok": "ULOK-123",
      "nama_toko": "Alfamart Batam",
      "kode_toko": "ABT001",
      "cabang": "BATAM",
      "tanggal_go": "2026-05-04",
      "tanggal_serah_terima": "2026-06-01",
      "tanggal_ambil_foto": "2026-06-02",
      "spk_awal": "SPK-001",
      "spk_akhir": "SPK-002",
      "kontraktor_sipil": "PT SIPIL",
      "kontraktor_me": "PT ME",
      "link_pdf": "https://drive.google.com/...",
      "email_pengirim": "user@mail.com",
      "status_validasi": "valid",
      "alasan_revisi": "",
      "pic_dokumentasi": "John Doe",
      "created_at": "2026-05-04T12:00:00.000Z"
    },
    "items": [
      {
        "id": 10,
        "id_dokumentasi_bangunan": 1,
        "link_foto": "https://drive.google.com/uc?export=view&id=...",
        "created_at": "2026-05-04T12:00:00.000Z"
      }
    ]
  }
}
```

---

## 4. Update Dokumentasi Bangunan

**`PUT /api/dok/bangunan/:id`**

- Body sama dengan create (opsional)
- Bisa upload foto tambahan lewat field `foto`

### Response — 200 OK

```json
{
  "status": "success",
  "message": "Dokumentasi bangunan berhasil diperbarui",
  "data": {
    "dokumentasi": { "id": 1, "kode_toko": "ABT001" },
    "items": [
      {
        "id": 11,
        "id_dokumentasi_bangunan": 1,
        "link_foto": "https://drive.google.com/uc?export=view&id=...",
        "created_at": "2026-05-04T12:10:00.000Z"
      }
    ]
  }
}
```

---

## 5. Delete Dokumentasi Bangunan

**`DELETE /api/dok/bangunan/:id`**

### Response — 200 OK

```json
{
  "status": "success",
  "message": "Dokumentasi bangunan berhasil dihapus",
  "data": { "ok": true }
}
```

---

## 6. Tambah Foto (Bulk)

**`POST /api/dok/bangunan/:id/items`**

- multipart/form-data
- field file: `foto`

### Response — 200 OK

```json
{
  "status": "success",
  "message": "Foto dokumentasi berhasil ditambahkan",
  "data": {
    "dokumentasi": { "id": 1 },
    "items": [
      {
        "id": 20,
        "id_dokumentasi_bangunan": 1,
        "link_foto": "https://drive.google.com/uc?export=view&id=...",
        "created_at": "2026-05-04T12:10:00.000Z"
      }
    ]
  }
}
```

---

## 7. Delete Item Foto

**`DELETE /api/dok/bangunan/items/:itemId`**

### Response — 200 OK

```json
{
  "status": "success",
  "message": "Item dokumentasi berhasil dihapus",
  "data": {
    "id": 20,
    "id_dokumentasi_bangunan": 1,
    "link_foto": "https://drive.google.com/uc?export=view&id=...",
    "created_at": "2026-05-04T12:10:00.000Z"
  }
}
```

---

## 8. Generate PDF

**`POST /api/dok/bangunan/:id/pdf`**

### Response — 200 OK

```json
{
  "status": "success",
  "message": "PDF dokumentasi berhasil dibuat",
  "data": {
    "id": 1,
    "link_pdf": "https://drive.google.com/...",
    "filename": "DOKUMENTASI_BANGUNAN_ABT001_ULOK-123_1.pdf",
    "item_count": 12
  }
}
```
