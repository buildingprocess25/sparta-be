# Dokumentasi API DC Development - sparta-api

Terakhir diperbarui: 2026-05-28

Base URL: `/api/dc-development`

Modul ini mengelola proyek Development Center: project lifecycle, vendor, tender, approval, dan dokumen DC.

---

## Daftar Endpoint

| Method | Path | Deskripsi |
| --- | --- | --- |
| `GET` | `/api/dc-development/projects` | List project DC. |
| `POST` | `/api/dc-development/projects` | Buat project DC. |
| `GET` | `/api/dc-development/projects/:id` | Detail project DC. |
| `POST` | `/api/dc-development/projects/:id/advance-stage` | Maju/update stage project. |
| `POST` | `/api/dc-development/projects/:id/tenders` | Buat tender untuk project. |
| `GET` | `/api/dc-development/vendors` | List vendor DC. |
| `POST` | `/api/dc-development/vendors` | Buat vendor DC. |
| `POST` | `/api/dc-development/vendors/:id/users` | Buat user vendor DC. |
| `GET` | `/api/dc-development/approvals` | List approval DC. |
| `GET` | `/api/dc-development/documents` | List dokumen DC. |
| `GET` | `/api/dc-development/documents/:id/view` | Placeholder/proxy view dokumen. |
| `GET` | `/api/dc-development/documents/:id/download` | Placeholder/proxy download dokumen. |

---

## Project

### GET /api/dc-development/projects

Query opsional:

| Parameter | Keterangan |
| --- | --- |
| `status` | Filter status project. |
| `current_stage` | Filter stage saat ini. |
| `branch_name` | Filter cabang. |
| `search` | Pencarian project. |

### POST /api/dc-development/projects

```json
{
  "project_code": "DC-2026-001",
  "project_name": "DC Development Lampung",
  "location_name": "Lampung",
  "branch_name": "LAMPUNG",
  "address": "Jl. Contoh",
  "area_size": 10000,
  "created_by_email": "user@example.com",
  "created_by_role": "DC BUILDING & DEVELOPMENT SPECIALIST"
}
```

Validasi utama: `project_code` dan `project_name` wajib. `area_size` harus angka non-negatif jika dikirim.

### POST /api/dc-development/projects/:id/advance-stage

```json
{
  "actor_email": "manager@example.com",
  "actor_role": "DC BUILDING & DEVELOPMENT MANAGER",
  "reason": "Dokumen lengkap",
  "target_stage": "SOIL_TENDER",
  "is_intervention": false
}
```

`target_stage` opsional. Jika tidak dikirim, service memakai stage berikutnya sesuai urutan lifecycle.

Stage yang dikenal:

- `PROJECT_CREATED`
- `SOIL_TENDER`
- `SOIL_WORK_RESULT`
- `PLANNER_TENDER`
- `MK_TENDER`
- `CONTRACTOR_TENDER`
- `CONSTRUCTION_MONITORING`
- `SAT_SUPERVISION`
- `BAST_PREPARATION`
- `BAST_APPROVAL`
- `FINAL_TERM_BILLING`
- `COMPLETED`

---

## Tender

### POST /api/dc-development/projects/:id/tenders

```json
{
  "tender_type": "CONTRACTOR",
  "title": "Tender Kontraktor DC Lampung",
  "owner_estimate_amount": 25000000000,
  "oe_tolerance_percent": 10,
  "created_by_email": "user@example.com"
}
```

Nilai `tender_type`:

- `SOIL_INVESTIGATION`
- `PLANNER`
- `SUPERVISOR_MK`
- `CONTRACTOR`

---

## Vendor

### GET /api/dc-development/vendors

Mengembalikan daftar vendor DC.

### POST /api/dc-development/vendors

```json
{
  "company_name": "PT Vendor DC",
  "npwp": "00.000.000.0-000.000",
  "address": "Jakarta",
  "contact_name": "Budi",
  "contact_email": "vendor@example.com",
  "contact_phone": "08123456789",
  "service_types": ["CONTRACTOR"],
  "created_by_email": "user@example.com"
}
```

`service_types` memakai nilai tender type.

### POST /api/dc-development/vendors/:id/users

```json
{
  "email": "pic.vendor@example.com",
  "full_name": "PIC Vendor",
  "phone": "08123456789"
}
```

---

## Approval dan Dokumen

### GET /api/dc-development/approvals

Query opsional:

| Parameter | Keterangan |
| --- | --- |
| `status` | Filter status approval. |
| `required_role` | Filter role approval. |
| `project_id` | Filter project. |

Status approval yang dikenal:

- `PENDING`
- `APPROVED`
- `REJECTED`
- `REVISION_REQUESTED`

### GET /api/dc-development/documents

Query opsional:

| Parameter | Keterangan |
| --- | --- |
| `project_id` | Filter project. |
| `tender_id` | Filter tender. |
| `document_type` | Filter tipe dokumen. |
| `entity_type` | Filter entity pemilik dokumen. |

### GET /api/dc-development/documents/:id/view

Endpoint placeholder/proxy untuk view dokumen.

### GET /api/dc-development/documents/:id/download

Endpoint placeholder/proxy untuk download dokumen.
