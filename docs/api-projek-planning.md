# API Documentation — Project Planning

Base URL: `/api/projek-planning`

---

## Status Flow

```
(tidak ada)
    ↓ POST /submit (record baru)
WAITING_BM_APPROVAL
    ↓ POST /:id/bm-approval  [APPROVE]
WAITING_PP_APPROVAL_1
    ↓ POST /:id/pp-approval-1  [APPROVE, butuh_desain_3d: true]
PP_DESIGN_3D_REQUIRED
    ↓ POST /:id/upload-3d
WAITING_RAB_UPLOAD ←── juga dari pp-approval-1 [APPROVE, butuh_desain_3d: false]
    ↓ POST /:id/upload-rab
WAITING_PP_MANAGER_APPROVAL
    ↓ POST /:id/pp-manager-approval  [APPROVE]
WAITING_PP_APPROVAL_2
    ↓ POST /:id/pp-approval-2  [APPROVE]
COMPLETED

REJECT di tahap mana pun → DRAFT (reset total semua kolom approval)
DRAFT → POST /:id/resubmit (coordinator ajukan ulang) → WAITING_BM_APPROVAL
```

---

## Endpoints

### 1. Submit FPD (Record Baru)
**POST** `/api/projek-planning/submit`

**Role:** Coordinator (Cabang)

**Body:**
```json
{
  "id_toko": 1234,
  "nomor_ulok": "OZ01-2602-O010-R",
  "email_pembuat": "coordinator@alfamart.co.id",
  "lingkup_pekerjaan": "SIPIL",
  "jenis_proyek": "Reguler",
  "estimasi_biaya": 500000000,
  "keterangan": "Renovasi total lantai dan dinding",
  "link_fpd": "https://drive.google.com/..."
}
```

**Response 201:**
```json
{
  "status": "success",
  "message": "Pengajuan project planning berhasil disimpan, menunggu approval BM Manager",
  "data": { ...projek_planning_row }
}
```

> Jika sudah ada record DRAFT untuk toko yang sama (setelah rejection), gunakan endpoint resubmit.

---

### 2. Resubmit FPD (Update Record DRAFT)
**POST** `/api/projek-planning/:id/resubmit`

**Role:** Coordinator (Cabang)

**Status yang dibutuhkan:** `DRAFT`

**Body:**
```json
{
  "email_pembuat": "coordinator@alfamart.co.id",
  "lingkup_pekerjaan": "SIPIL",
  "jenis_proyek": "Reguler",
  "estimasi_biaya": 600000000,
  "keterangan": "Revisi setelah penolakan, data diperbaiki",
  "link_fpd": "https://drive.google.com/..."
}
```

**Response 200:**
```json
{
  "status": "success",
  "message": "FPD berhasil diajukan ulang, menunggu approval BM Manager",
  "data": { ...projek_planning_row }
}
```

> Endpoint ini digunakan setelah record ditolak (DRAFT). Semua data approval sebelumnya sudah direset.

---

### 3. List Project Planning
**GET** `/api/projek-planning`

**Query Params (semua opsional):**
| Param | Tipe | Contoh |
|-------|------|--------|
| `status` | string | `WAITING_BM_APPROVAL` |
| `nomor_ulok` | string | `OZ01-2602-O010-R` |
| `cabang` | string | `KLATEN` |
| `email_pembuat` | string | `coordinator@alfamart.co.id` |
| `id_toko` | number | `1234` |

---

### 4. Get Detail
**GET** `/api/projek-planning/:id`

**Response 200:**
```json
{
  "status": "success",
  "data": {
    "projek": { ...detail },
    "logs": [ ...audit_trail ]
  }
}
```

---

### 5. BM Approval
**POST** `/api/projek-planning/:id/bm-approval`

**Role:** BM (Branch Manager)

**Status yang dibutuhkan:** `WAITING_BM_APPROVAL`

**Body (APPROVE):**
```json
{
  "approver_email": "bm@alfamart.co.id",
  "tindakan": "APPROVE"
}
```

**Body (REJECT):**
```json
{
  "approver_email": "bm@alfamart.co.id",
  "tindakan": "REJECT",
  "alasan_penolakan": "Data tidak lengkap"
}
```

> REJECT → status kembali ke `DRAFT`, semua kolom approval direset total.

---

### 6. PP Specialist Approval Stage 1
**POST** `/api/projek-planning/:id/pp-approval-1`

**Role:** PP Specialist

**Status yang dibutuhkan:** `WAITING_PP_APPROVAL_1`

**Body (APPROVE dengan 3D):**
```json
{
  "approver_email": "pp@alfamart.co.id",
  "tindakan": "APPROVE",
  "butuh_desain_3d": true
}
```

**Body (APPROVE tanpa 3D):**
```json
{
  "approver_email": "pp@alfamart.co.id",
  "tindakan": "APPROVE",
  "butuh_desain_3d": false
}
```

**Body (REJECT → kembali ke DRAFT):**
```json
{
  "approver_email": "pp@alfamart.co.id",
  "tindakan": "REJECT",
  "alasan_penolakan": "Perlu revisi data FPD"
}
```

---

### 7. Upload Desain 3D
**POST** `/api/projek-planning/:id/upload-3d`

**Role:** PP Specialist

**Status yang dibutuhkan:** `PP_DESIGN_3D_REQUIRED`

**Body:**
```json
{
  "uploader_email": "pp@alfamart.co.id",
  "link_desain_3d": "https://drive.google.com/...",
  "keterangan": "Desain 3D selesai dibuat"
}
```

---

### 8. Upload RAB & Gambar Kerja
**POST** `/api/projek-planning/:id/upload-rab`

**Role:** Coordinator (Cabang)

**Status yang dibutuhkan:** `WAITING_RAB_UPLOAD`

**Body:**
```json
{
  "uploader_email": "coordinator@alfamart.co.id",
  "link_rab": "https://drive.google.com/...",
  "link_gambar_kerja": "https://drive.google.com/...",
  "keterangan": "RAB dan gambar kerja sudah diupload"
}
```

> Minimal salah satu dari `link_rab` atau `link_gambar_kerja` harus diisi.

---

### 9. PP Manager Approval
**POST** `/api/projek-planning/:id/pp-manager-approval`

**Role:** PP Manager

**Status yang dibutuhkan:** `WAITING_PP_MANAGER_APPROVAL`

**Body:** sama seperti BM Approval

> REJECT → status kembali ke `DRAFT`, semua kolom approval direset total.

---

### 10. PP Specialist Approval Stage 2 (Final)
**POST** `/api/projek-planning/:id/pp-approval-2`

**Role:** PP Specialist

**Status yang dibutuhkan:** `WAITING_PP_APPROVAL_2`

**Body:** sama seperti BM Approval

> Jika APPROVE → status menjadi `COMPLETED`, FPD dikirim ke Cabang

> Jika REJECT → status kembali ke `DRAFT` (reset total dari awal)

---

### 11. Audit Trail (Logs)
**GET** `/api/projek-planning/:id/logs`

**Response 200:**
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

## Status Enum Reference

| Status | Deskripsi |
|--------|-----------|
| `DRAFT` | Belum diajukan / kembali setelah ditolak |
| `WAITING_BM_APPROVAL` | Menunggu persetujuan BM Manager |
| `WAITING_PP_APPROVAL_1` | Menunggu persetujuan PP Specialist (Tahap 1) |
| `PP_DESIGN_3D_REQUIRED` | PP perlu upload desain 3D |
| `WAITING_RAB_UPLOAD` | Cabang perlu upload RAB & Gambar Kerja |
| `WAITING_PP_MANAGER_APPROVAL` | Menunggu persetujuan PP Manager |
| `WAITING_PP_APPROVAL_2` | Menunggu persetujuan final PP Specialist |
| `COMPLETED` | Selesai — FPD disetujui dan dikirim ke Cabang |

## Rejection Behavior

Saat terjadi **REJECT** di tahap mana pun:
1. Status → `DRAFT`
2. Semua kolom approval (BM, PP1, PP Manager, PP2) di-NULL-kan
3. Flag `butuh_desain_3d` → `FALSE`
4. File links (link_fpd, link_rab, dll) **tetap tersimpan** sebagai referensi
5. Log aksi REJECT dicatat di `projek_planning_log`
6. Coordinator harus menggunakan `POST /:id/resubmit` untuk mengajukan ulang
