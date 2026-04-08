# Dokumentasi API Pertambahan SPK - sparta-api

Base URL: `/api/pertambahan-spk`

> Catatan relasi ERD: pada ERD relasi ditulis ke tabel `spk`, sedangkan pada implementasi backend ini relasi diarahkan ke tabel `pengajuan_spk` melalui field `id_spk`.

---

## Daftar Endpoint

| #   | Method   | Path                                | Deskripsi                                  |
| --- | -------- | ----------------------------------- | ------------------------------------------ |
| 1   | `POST`   | `/api/pertambahan-spk`              | Membuat data pertambahan SPK baru          |
| 2   | `GET`    | `/api/pertambahan-spk`              | List data pertambahan SPK (+ filter)       |
| 3   | `GET`    | `/api/pertambahan-spk/:id`          | Detail data pertambahan SPK berdasarkan ID |
| 4   | `PUT`    | `/api/pertambahan-spk/:id`          | Update data pertambahan SPK                |
| 5   | `POST`   | `/api/pertambahan-spk/:id/approval` | Approve / Reject pertambahan SPK (BM)      |
| 6   | `DELETE` | `/api/pertambahan-spk/:id`          | Hapus data pertambahan SPK                 |

---

## Struktur Tabel Pertambahan SPK

Tabel `pertambahan_spk`:

- `id` (primary key)
- `id_spk` (foreign key ke `pengajuan_spk.id`)
- `pertambahan_hari`
- `tanggal_spk_akhir`
- `tanggal_spk_akhir_setelah_perpanjangan`
- `alasan_perpanjangan`
- `dibuat_oleh`
- `status_persetujuan`
- `disetujui_oleh`
- `waktu_persetujuan`
- `alasan_penolakan`
- `link_pdf`
- `link_lampiran_pendukung`
- `created_at`

Status persetujuan yang dipakai pada flow approval:

- `Menunggu Persetujuan` (default saat submit)
- `Disetujui BM`
- `Ditolak BM`

---

## 1) Create Pertambahan SPK

**`POST /api/pertambahan-spk`**

Request dapat dikirim sebagai:

- `application/json`
- `multipart/form-data` (untuk upload file lampiran melalui field `file_lampiran_pendukung`)

Catatan proses otomatis pada backend:

- Field `link_pdf` di-generate otomatis dari data request, dibuat menjadi PDF, di-upload ke Google Drive, lalu URL hasil upload disimpan ke `link_pdf`.
- Jika request menyertakan file `file_lampiran_pendukung`, file di-upload ke Google Drive dan URL hasil upload disimpan ke `link_lampiran_pendukung`.

### Request Body

```json
{
  "id_spk": 12,
  "pertambahan_hari": "14",
  "tanggal_spk_akhir": "2026-04-30",
  "tanggal_spk_akhir_setelah_perpanjangan": "2026-05-14",
  "alasan_perpanjangan": "Progress lapangan terdampak cuaca",
  "dibuat_oleh": "koordinator@example.com",
  "status_persetujuan": "Menunggu Persetujuan",
  "disetujui_oleh": "",
  "waktu_persetujuan": "",
  "alasan_penolakan": ""
}
```

Contoh `multipart/form-data`:

- field text: `id_spk`, `pertambahan_hari`, `tanggal_spk_akhir`, `tanggal_spk_akhir_setelah_perpanjangan`, `alasan_perpanjangan`, `dibuat_oleh`
- field file: `file_lampiran_pendukung`

### Validasi

| Field                                    | Aturan                                   |
| ---------------------------------------- | ---------------------------------------- |
| `id_spk`                                 | wajib, integer > 0                       |
| `pertambahan_hari`                       | wajib, string min 1                      |
| `tanggal_spk_akhir`                      | wajib, string min 1                      |
| `tanggal_spk_akhir_setelah_perpanjangan` | wajib, string min 1                      |
| `alasan_perpanjangan`                    | wajib, string min 1                      |
| `dibuat_oleh`                            | wajib, string min 1                      |
| `status_persetujuan`                     | opsional, default `Menunggu Persetujuan` |
| `disetujui_oleh`                         | opsional                                 |
| `waktu_persetujuan`                      | opsional                                 |
| `alasan_penolakan`                       | opsional                                 |
| `file_lampiran_pendukung`                | opsional, file multipart                 |

Field hasil proses backend:

- `link_pdf` diisi otomatis oleh sistem.
- `link_lampiran_pendukung` diisi otomatis jika ada upload `file_lampiran_pendukung`.

### Response - 201 Created

```json
{
  "status": "success",
  "message": "Data pertambahan SPK berhasil dibuat",
  "data": {
    "id": 1,
    "id_spk": 12,
    "pertambahan_hari": "14",
    "tanggal_spk_akhir": "2026-04-30",
    "tanggal_spk_akhir_setelah_perpanjangan": "2026-05-14",
    "alasan_perpanjangan": "Progress lapangan terdampak cuaca",
    "dibuat_oleh": "koordinator@example.com",
    "status_persetujuan": "Menunggu Persetujuan",
    "disetujui_oleh": null,
    "waktu_persetujuan": null,
    "alasan_penolakan": null,
    "link_pdf": "https://drive.google.com/file/d/xxx/view",
    "link_lampiran_pendukung": "https://drive.google.com/file/d/yyy/view",
    "created_at": "2026-04-06T10:00:00.000Z",
    "nomor_spk": "001/PROPNDEV-Z001/IV/2026"
  }
}
```

### Error Responses

| Code | Kondisi                            |
| ---- | ---------------------------------- |
| 404  | SPK untuk `id_spk` tidak ditemukan |
| 422  | Validasi request gagal             |

---

## 2) List Pertambahan SPK

**`GET /api/pertambahan-spk`**

### Query Parameters

| Parameter            | Tipe   | Deskripsi                             |
| -------------------- | ------ | ------------------------------------- |
| `id_spk`             | number | Filter berdasarkan ID SPK             |
| `status_persetujuan` | string | Filter berdasarkan status persetujuan |

### Contoh Request

```http
GET /api/pertambahan-spk
GET /api/pertambahan-spk?id_spk=12
GET /api/pertambahan-spk?status_persetujuan=Menunggu%20Persetujuan
```

### Response - 200 OK

```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "id_spk": 12,
      "pertambahan_hari": "14",
      "tanggal_spk_akhir": "2026-04-30",
      "tanggal_spk_akhir_setelah_perpanjangan": "2026-05-14",
      "alasan_perpanjangan": "Progress lapangan terdampak cuaca",
      "dibuat_oleh": "koordinator@example.com",
      "status_persetujuan": "Menunggu Persetujuan",
      "disetujui_oleh": null,
      "waktu_persetujuan": null,
      "alasan_penolakan": null,
      "link_pdf": null,
      "link_lampiran_pendukung": null,
      "created_at": "2026-04-06T10:00:00.000Z",
      "nomor_spk": "001/PROPNDEV-Z001/IV/2026"
    }
  ]
}
```

---

## 3) Detail Pertambahan SPK

**`GET /api/pertambahan-spk/:id`**

Response detail mengembalikan relasi:

- `spk`: data pengajuan SPK dari `pengajuan_spk` berdasarkan `id_spk`
- `toko`: data toko berdasarkan `nomor_ulok` milik objek `spk`

### Response - 200 OK

```json
{
  "status": "success",
  "data": {
    "id": 1,
    "id_spk": 12,
    "pertambahan_hari": "14",
    "tanggal_spk_akhir": "2026-04-30",
    "tanggal_spk_akhir_setelah_perpanjangan": "2026-05-14",
    "alasan_perpanjangan": "Progress lapangan terdampak cuaca",
    "dibuat_oleh": "koordinator@example.com",
    "status_persetujuan": "Menunggu Persetujuan",
    "disetujui_oleh": null,
    "waktu_persetujuan": null,
    "alasan_penolakan": null,
    "link_pdf": null,
    "link_lampiran_pendukung": null,
    "created_at": "2026-04-06T10:00:00.000Z",
    "nomor_spk": "001/PROPNDEV-Z001/IV/2026",
    "spk": {
      "id": 12,
      "nomor_ulok": "ULOK-0001",
      "email_pembuat": "creator@example.com",
      "lingkup_pekerjaan": "Renovasi",
      "nama_kontraktor": "PT Maju Jaya",
      "proyek": "Project A",
      "waktu_mulai": "2026-04-01",
      "durasi": 30,
      "waktu_selesai": "2026-04-30",
      "grand_total": 120000000,
      "terbilang": "Seratus dua puluh juta rupiah",
      "nomor_spk": "001/PROPNDEV-Z001/IV/2026",
      "par": "PAR-123",
      "spk_manual_1": "MAN-1",
      "spk_manual_2": "MAN-2",
      "status": "SPK_WAITING_APPROVAL",
      "link_pdf": "https://drive.google.com/file/d/xxx/view",
      "approver_email": null,
      "waktu_persetujuan": null,
      "alasan_penolakan": null,
      "created_at": "2026-04-01T08:00:00.000Z"
    },
    "toko": {
      "id": 7,
      "nomor_ulok": "ULOK-0001",
      "lingkup_pekerjaan": "Renovasi",
      "nama_toko": "Alfamart Example",
      "kode_toko": "A001",
      "proyek": "Project A",
      "cabang": "Bandung",
      "alamat": "Jl. Contoh No. 1",
      "nama_kontraktor": "PT Maju Jaya"
    }
  }
}
```

### Error Responses

| Code | Kondisi                              |
| ---- | ------------------------------------ |
| 404  | Data pertambahan SPK tidak ditemukan |

---

## 4) Update Pertambahan SPK

**`PUT /api/pertambahan-spk/:id`**

Semua field bersifat opsional saat update, tetapi minimal satu field wajib dikirim.

### Contoh Request Body

```json
{
  "status_persetujuan": "Disetujui",
  "disetujui_oleh": "manager@example.com",
  "waktu_persetujuan": "2026-04-06 15:30:00",
  "link_pdf": "https://drive.google.com/file/d/baru/view"
}
```

### Response - 200 OK

```json
{
  "status": "success",
  "message": "Data pertambahan SPK berhasil diperbarui",
  "data": {
    "id": 1,
    "id_spk": 12,
    "status_persetujuan": "Disetujui",
    "disetujui_oleh": "manager@example.com"
  }
}
```

### Error Responses

| Code | Kondisi                                      |
| ---- | -------------------------------------------- |
| 404  | Data pertambahan SPK tidak ditemukan         |
| 422  | Validasi gagal / tidak ada field yang diubah |

---

## 5) Approval Pertambahan SPK

**`POST /api/pertambahan-spk/:id/approval`**

Memproses approval BM untuk pertambahan SPK.

Aturan:

- Hanya bisa diproses saat status masih `Menunggu Persetujuan`
- `APPROVE` mengubah status menjadi `Disetujui BM`
- `REJECT` mengubah status menjadi `Ditolak BM` dan `alasan_penolakan` wajib diisi
- Jika status sudah pernah diproses, request akan ditolak (guard anti double process)

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
  "alasan_penolakan": "Lampiran pendukung belum lengkap"
}
```

### Response - 200 OK

```json
{
  "status": "success",
  "message": "Approval pertambahan SPK berhasil diproses",
  "data": {
    "id": 1,
    "id_spk": 12,
    "status_persetujuan": "Disetujui BM",
    "disetujui_oleh": "manager@example.com",
    "waktu_persetujuan": "2026-04-06T09:00:00.000Z"
  }
}
```

### Error Responses

| Code | Kondisi                                                               |
| ---- | --------------------------------------------------------------------- |
| 404  | Data pertambahan SPK tidak ditemukan                                  |
| 409  | Data sudah pernah diproses (status bukan `Menunggu Persetujuan`)      |
| 422  | Validasi gagal (`REJECT` tanpa `alasan_penolakan`, format email, dll) |

---

## 6) Delete Pertambahan SPK

**`DELETE /api/pertambahan-spk/:id`**

### Response - 200 OK

```json
{
  "status": "success",
  "message": "Data pertambahan SPK berhasil dihapus"
}
```

### Error Responses

| Code | Kondisi                              |
| ---- | ------------------------------------ |
| 404  | Data pertambahan SPK tidak ditemukan |
