# Dokumentasi API Project Planning — sparta-api

Base URL: `/api/projek-planning`

> Catatan: Modul ini menggunakan tabel `projek_planning` dan `projek_planning_log`.

---

## Daftar Endpoint

| #   | Method | Path                                   | Deskripsi                                        |
| --- | ------ | -------------------------------------- | ------------------------------------------------ |
| 1   | `POST` | `/api/projek-planning/submit`          | Submit pengajuan FPD baru                        |
| 2   | `POST` | `/api/projek-planning/:id/resubmit`    | Resubmit FPD (update record DRAFT)               |
| 3   | `GET`  | `/api/projek-planning`                 | List pengajuan FPD (+ filter)                    |
| 4   | `GET`  | `/api/projek-planning/:id`             | Detail FPD + audit trail                         |
| 5   | `POST` | `/api/projek-planning/:id/bm-approval` | Approve/Reject oleh BM Manager                   |
| 6   | `POST` | `/api/projek-planning/:id/pp-approval-1` | Approve/Reject oleh PP Specialist (Tahap 1)    |
| 7   | `POST` | `/api/projek-planning/:id/upload-3d`   | Upload desain 3D oleh PP Specialist              |
| 8   | `POST` | `/api/projek-planning/:id/upload-rab`  | Upload RAB & Gambar Kerja oleh Coordinator       |
| 9   | `POST` | `/api/projek-planning/:id/pp-approval-2` | Approve/Reject oleh PP Specialist (Setelah RAB) |
| 10  | `POST` | `/api/projek-planning/:id/pp-manager-approval` | Approve/Reject oleh PP Manager (Final)          |
| 11  | `GET`  | `/api/projek-planning/:id/logs`        | Ambil audit trail                                |

---

## Status FPD

| Status                        | Keterangan                                      |
| ----------------------------- | ------------------------------------------------ |
| `DRAFT`                       | Belum diajukan / kembali setelah ditolak         |
| `WAITING_BM_APPROVAL`         | Menunggu persetujuan B&M Manager                 |
| `WAITING_PP_APPROVAL_1`       | Menunggu persetujuan PP Specialist (Tahap 1)     |
| `PP_DESIGN_3D_REQUIRED`       | PP perlu upload desain 3D                        |
| `WAITING_RAB_UPLOAD`          | Cabang perlu upload RAB & Gambar Kerja           |
| `WAITING_PP_APPROVAL_2`       | Menunggu persetujuan PP Specialist (Setelah RAB) |
| `WAITING_PP_MANAGER_APPROVAL` | Menunggu persetujuan final PP Manager            |
| `COMPLETED`                   | Selesai — FPD disetujui dan dikirim ke Cabang    |

Status aktif (tidak bisa submit baru untuk toko yang sama):

- `WAITING_BM_APPROVAL`
- `WAITING_PP_APPROVAL_1`
- `PP_DESIGN_3D_REQUIRED`
- `WAITING_RAB_UPLOAD`
- `WAITING_PP_MANAGER_APPROVAL`
- `WAITING_PP_APPROVAL_2`
- `COMPLETED`

---

## 1. Submit FPD

**`POST /api/projek-planning/submit`**

Membuat pengajuan FPD baru. Sistem akan:

- Validasi `id_toko` wajib sudah ada di master tabel `toko`
- Cek duplikasi: jika toko sudah punya FPD aktif, tolak dengan 409
- Snapshot data toko (`nama_toko`, `kode_toko`, `cabang`, `proyek`) ke record FPD
- Set status awal: `WAITING_BM_APPROVAL`
- Insert log SUBMIT ke `projek_planning_log`

### Request Body

```json
{
  "id_toko": 1234,
  "nomor_ulok": "OZ01-2602-O010-R",
  "email_pembuat": "coordinator@alfamart.co.id",
  "lingkup_pekerjaan": "SIPIL",
  "jenis_proyek": "Reguler",
  "estimasi_biaya": 500000000,
  "keterangan": "Renovasi total",
  "link_fpd": "https://drive.google.com/...",
  "nama_pengaju": "Budi Santoso",
  "nama_lokasi": "ALF Klaten 01",
  "jenis_pengajuan": "DRIVE THRU",
  "jenis_pengajuan_lainnya": "",
  "fasilitas_air_bersih": true,
  "fasilitas_air_bersih_keterangan": "PDAM tersedia",
  "fasilitas_drain": true,
  "fasilitas_drain_keterangan": "Sudah ada saluran",
  "fasilitas_ac": false,
  "fasilitas_ac_keterangan": "",
  "fasilitas_lainnya": "Listrik 3 Phase",
  "fasilitas_lainnya_keterangan": "Daya 16.500 VA",
  "ketentuan_1": "Jam kerja 08:00-17:00",
  "ketentuan_2": "",
  "ketentuan_3": "",
  "ketentuan_4": "",
  "ketentuan_5": "",
  "catatan_design_1": "Lebar muka 8m, kedalaman 15m",
  "catatan_design_2": "",
  "catatan_design_3": "",
  "catatan_design_4": "",
  "catatan_design_5": "",
  "link_gambar_rab_sipil": "https://drive.google.com/...",
  "link_gambar_rab_me": "https://drive.google.com/..."
}
```

### Validasi

| Field                   | Aturan                                    |
| ----------------------- | ----------------------------------------- |
| `id_toko`               | wajib, integer > 0                        |
| `nomor_ulok`            | wajib, string min 1                       |
| `email_pembuat`         | wajib, format email valid                 |
| `lingkup_pekerjaan`     | wajib, string min 1                       |
| `jenis_proyek`          | wajib, string min 1                       |
| `nama_pengaju`          | wajib, string min 1                       |
| `nama_lokasi`           | wajib, string min 1                       |
| `jenis_pengajuan`       | wajib, string min 1                       |
| `estimasi_biaya`        | opsional, angka >= 0                      |
| `fasilitas_air_bersih`  | opsional, boolean, default `false`        |
| `fasilitas_drain`       | opsional, boolean, default `false`        |
| `fasilitas_ac`          | opsional, boolean, default `false`        |
| `ketentuan_1` s/d `5`   | opsional, string                          |
| `catatan_design_1` s/d `5` | opsional, string                       |

### Response — 201 Created

```json
{
  "status": "success",
  "message": "Pengajuan project planning berhasil disimpan, menunggu approval BM Manager",
  "data": { ...projek_planning_row }
}
```

### Error Responses

| Code | Kondisi                                               |
| ---- | ----------------------------------------------------- |
| 404  | `id_toko` tidak ditemukan di master `toko`             |
| 409  | FPD aktif sudah ada untuk `id_toko` tersebut           |
| 422  | Validasi Zod gagal                                     |

---

## 2. Resubmit FPD

**`POST /api/projek-planning/:id/resubmit`**

Update record DRAFT yang sudah ada (setelah rejection). Sistem akan:

- Validasi record harus berstatus `DRAFT`
- Reset semua kolom approval (BM, PP1, PP Manager, PP2) ke NULL
- Set status ke `WAITING_BM_APPROVAL`
- Insert log SUBMIT ke `projek_planning_log`

### Request Body

Sama seperti Submit tetapi **tanpa** `id_toko` dan `nomor_ulok`.

### Response — 200 OK

```json
{
  "status": "success",
  "message": "FPD berhasil diajukan ulang, menunggu approval BM Manager",
  "data": { ...projek_planning_row }
}
```

### Error Responses

| Code | Kondisi                               |
| ---- | ------------------------------------- |
| 404  | Record FPD tidak ditemukan            |
| 409  | Status bukan `DRAFT`                  |
| 422  | Validasi Zod gagal                    |

---

## 3. List FPD

**`GET /api/projek-planning`**

Mengambil daftar pengajuan FPD. Mendukung filter query.

### Query Parameters

| Parameter      | Tipe   | Deskripsi                          |
| -------------- | ------ | ---------------------------------- |
| `status`       | string | Filter status (exact match)        |
| `nomor_ulok`   | string | Filter nomor ULOK (exact match)    |
| `cabang`       | string | Filter cabang (ILIKE / partial)    |
| `email_pembuat`| string | Filter email pembuat (exact match) |
| `id_toko`      | number | Filter ID toko (exact match)       |

### Contoh Request

```http
GET /api/projek-planning
GET /api/projek-planning?status=WAITING_BM_APPROVAL
GET /api/projek-planning?cabang=KLATEN
```

### Response — 200 OK

```json
{
  "status": "success",
  "data": [ ...array_of_projek_planning_rows ]
}
```

---

## 4. Detail FPD

**`GET /api/projek-planning/:id`**

Mengambil detail 1 FPD beserta riwayat audit trail.

### Path Parameter

| Parameter | Tipe   | Deskripsi     |
| --------- | ------ | ------------- |
| `id`      | number | ID record FPD |

### Response — 200 OK

```json
{
  "status": "success",
  "data": {
    "projek": { ...detail_lengkap },
    "logs": [ ...audit_trail ]
  }
}
```

### Error Responses

| Code | Kondisi                    |
| ---- | -------------------------- |
| 404  | Record FPD tidak ditemukan |

---

## 5. BM Approval

**`POST /api/projek-planning/:id/bm-approval`**

Memproses approval oleh Branch Manager.

Aturan:

- Hanya bisa diproses saat status `WAITING_BM_APPROVAL`
- `APPROVE` → status bergeser ke `WAITING_PP_APPROVAL_1`
- `REJECT` → status kembali ke `DRAFT` (reset total), wajib isi `alasan_penolakan`
- Selalu menulis jejak audit ke `projek_planning_log`

### Request Body (Approve)

```json
{
  "approver_email": "bm@alfamart.co.id",
  "tindakan": "APPROVE"
}
```

### Request Body (Reject)

```json
{
  "approver_email": "bm@alfamart.co.id",
  "tindakan": "REJECT",
  "alasan_penolakan": "Data tidak lengkap"
}
```

### Error Responses

| Code | Kondisi                          |
| ---- | -------------------------------- |
| 404  | Record FPD tidak ditemukan       |
| 409  | Status bukan `WAITING_BM_APPROVAL` |
| 422  | Validasi Zod gagal               |

---

## 6. PP Specialist Approval (Tahap 1)

**`POST /api/projek-planning/:id/pp-approval-1`**

PP Specialist menentukan apakah pengajuan butuh desain 3D.

Aturan:

- Hanya bisa diproses saat status `WAITING_PP_APPROVAL_1`
- `APPROVE` + `butuh_desain_3d: true` → `PP_DESIGN_3D_REQUIRED`
- `APPROVE` + `butuh_desain_3d: false` → `WAITING_RAB_UPLOAD`
- `REJECT` → `DRAFT` (reset total)

### Request Body (Approve dengan 3D)

```json
{
  "approver_email": "pp@alfamart.co.id",
  "tindakan": "APPROVE",
  "butuh_desain_3d": true
}
```

### Request Body (Approve tanpa 3D)

```json
{
  "approver_email": "pp@alfamart.co.id",
  "tindakan": "APPROVE",
  "butuh_desain_3d": false
}
```

---

## 7. Upload Desain 3D

**`POST /api/projek-planning/:id/upload-3d`**

PP Specialist mengupload link desain 3D.

Aturan:

- Hanya bisa diproses saat status `PP_DESIGN_3D_REQUIRED`
- Status bergeser ke `WAITING_RAB_UPLOAD`

### Request Body

```json
{
  "uploader_email": "pp@alfamart.co.id",
  "link_desain_3d": "https://drive.google.com/...",
  "keterangan": "Desain 3D selesai dibuat"
}
```

### Validasi

| Field            | Aturan                    |
| ---------------- | ------------------------- |
| `uploader_email` | wajib, format email valid |
| `link_desain_3d` | wajib, string min 1       |
| `keterangan`     | opsional, string          |

---

## 8. Upload RAB & Gambar Kerja

**`POST /api/projek-planning/:id/upload-rab`**

Coordinator mengupload link RAB dan/atau gambar kerja.

Aturan:

- Hanya bisa diproses saat status `WAITING_RAB_UPLOAD`
- Minimal salah satu dari `link_rab` atau `link_gambar_kerja` harus diisi
- Status bergeser ke `WAITING_PP_MANAGER_APPROVAL`

### Request Body

```json
{
  "uploader_email": "coordinator@alfamart.co.id",
  "link_rab": "https://drive.google.com/...",
  "link_gambar_kerja": "https://drive.google.com/...",
  "keterangan": "RAB dan gambar kerja sudah diupload"
}
```

---

## 9. PP Manager Approval

**`POST /api/projek-planning/:id/pp-manager-approval`**

Aturan:

- Hanya bisa diproses saat status `WAITING_PP_MANAGER_APPROVAL`
- `APPROVE` → `WAITING_PP_APPROVAL_2`
- `REJECT` → `DRAFT` (reset total)

### Request Body

Sama seperti BM Approval (#5).

---

## 10. PP Specialist Approval (Final)

**`POST /api/projek-planning/:id/pp-approval-2`**

Aturan:

- Hanya bisa diproses saat status `WAITING_PP_APPROVAL_2`
- `APPROVE` → `COMPLETED`
- `REJECT` → `DRAFT` (reset total)

### Request Body

Sama seperti BM Approval (#5).

---

## 11. Audit Trail (Logs)

**`GET /api/projek-planning/:id/logs`**

### Response — 200 OK

```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "projek_planning_id": 5,
      "actor_email": "coordinator@alfamart.co.id",
      "role": "COORDINATOR",
      "aksi": "SUBMIT",
      "status_sebelum": null,
      "status_sesudah": "WAITING_BM_APPROVAL",
      "alasan_penolakan": null,
      "keterangan": "FPD berhasil diajukan oleh Coordinator",
      "created_at": "2026-05-08T07:20:00Z"
    }
  ]
}
```

---

## Rejection Behavior

Saat terjadi **REJECT** di tahap mana pun:

1. Status → `DRAFT`
2. Semua kolom approval (BM, PP1, PP Manager, PP2) di-NULL-kan
3. Flag `butuh_desain_3d` → `FALSE`
4. File links (link_fpd, link_rab, dll) **tetap tersimpan** sebagai referensi
5. Data FPD (fasilitas, ketentuan, catatan) **tetap tersimpan**
6. Log aksi REJECT dicatat di `projek_planning_log`
7. Coordinator harus menggunakan `POST /:id/resubmit` untuk mengajukan ulang

---

## Jenis Pengajuan Design

| Value        | Deskripsi                                         |
| ------------ | ------------------------------------------------- |
| `DRIVE THRU` | Pengajuan design drive thru                       |
| `BEAN SPOT`  | Pengajuan design bean spot                        |
| `FASADE`     | Pengajuan design fasade                           |
| `LAINNYA`    | Jenis lainnya (isi `jenis_pengajuan_lainnya`)     |

---

## Mapping Tabel

- `projek_planning`: data header FPD (identitas, fasilitas, ketentuan, catatan, status, approval)
- `projek_planning_log`: histori tindakan (submit, approve, reject, upload)

Relasi:

- `projek_planning.id_toko` -> `toko.id`
- `projek_planning_log.projek_planning_id` -> `projek_planning.id`
