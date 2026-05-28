# Peta Endpoint API Backend Terkini

Terakhir diperbarui: 2026-05-28

Dokumen ini adalah indeks ringkas endpoint aktif berdasarkan `src/app.ts` dan file `*.routes.ts`. Detail payload tetap berada di dokumen domain masing-masing.

Base backend utama: `/api`

---

## System dan Auth

| Method | Endpoint | Modul |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `POST` | `/api/auth/login` | Auth login |
| `POST` | `/api/auth/verify-otp` | Auth OTP |
| `GET` | `/api/get_kontraktor` | Lookup kontraktor |

---

## Core Building Modules

### Toko

| Method | Endpoint |
| --- | --- |
| `POST` | `/api/toko` |
| `PUT` | `/api/toko/:id` |
| `GET` | `/api/toko` |
| `GET` | `/api/toko/detail` |
| `GET` | `/api/toko/:nomorUlok` |

### RAB

| Method | Endpoint |
| --- | --- |
| `POST` | `/api/rab/submit` |
| `GET` | `/api/rab` |
| `GET` | `/api/rab/:id` |
| `PUT` | `/api/rab/:id/items` |
| `PUT` | `/api/rab/:id/items/replace` |
| `POST` | `/api/rab/:id/sync-branch-prices` |
| `DELETE` | `/api/rab/:id/items` |
| `GET` | `/api/rab/:id/pdf` |
| `GET` | `/api/rab/:id/logo` |
| `GET` | `/api/rab/:id/file-asuransi` |
| `POST` | `/api/rab/:id/approval` |
| `PUT` | `/api/rab/update-status` |

### SPK

| Method | Endpoint |
| --- | --- |
| `POST` | `/api/spk/submit` |
| `GET` | `/api/spk` |
| `GET` | `/api/spk/:id` |
| `GET` | `/api/spk/:id/pdf` |
| `POST` | `/api/spk/:id/approval` |
| `POST` | `/api/spk/:id/intervention` |

### Pertambahan SPK

| Method | Endpoint |
| --- | --- |
| `POST` | `/api/pertambahan-spk` |
| `GET` | `/api/pertambahan-spk` |
| `GET` | `/api/pertambahan-spk/:id` |
| `GET` | `/api/pertambahan-spk/:id/pdf` |
| `GET` | `/api/pertambahan-spk/:id/lampiran-pendukung` |
| `PUT` | `/api/pertambahan-spk/:id` |
| `POST` | `/api/pertambahan-spk/:id/approval` |
| `DELETE` | `/api/pertambahan-spk/:id` |

### Gantt

| Method | Endpoint |
| --- | --- |
| `POST` | `/api/gantt/submit` |
| `GET` | `/api/gantt` |
| `GET` | `/api/gantt/detail/:id_toko` |
| `GET` | `/api/gantt/:id` |
| `PUT` | `/api/gantt/:id` |
| `POST` | `/api/gantt/:id/lock` |
| `DELETE` | `/api/gantt/:id` |
| `POST` | `/api/gantt/:id/day` |
| `POST` | `/api/gantt/:id/day/keterlambatan` |
| `POST` | `/api/gantt/:id/day/kecepatan` |
| `POST` | `/api/gantt/:id/pengawasan` |

### PIC Pengawasan dan Pengawasan

| Method | Endpoint |
| --- | --- |
| `POST` | `/api/pic_pengawasan` |
| `GET` | `/api/pic_pengawasan` |
| `GET` | `/api/pic_pengawasan/:id` |
| `POST` | `/api/pengawasan` |
| `POST` | `/api/pengawasan/bulk` |
| `GET` | `/api/pengawasan` |
| `GET` | `/api/pengawasan/:id/pdf` |
| `GET` | `/api/pengawasan/:id` |
| `PUT` | `/api/pengawasan/bulk` |
| `PUT` | `/api/pengawasan/:id` |
| `DELETE` | `/api/pengawasan/:id` |

### Opname dan Opname Final

| Method | Endpoint |
| --- | --- |
| `POST` | `/api/opname` |
| `POST` | `/api/opname/bulk` |
| `GET` | `/api/opname` |
| `GET` | `/api/opname/:id` |
| `GET` | `/api/opname/:id/foto` |
| `PUT` | `/api/opname/:id` |
| `DELETE` | `/api/opname/:id` |
| `GET` | `/api/final_opname` |
| `GET` | `/api/final_opname/:id` |
| `GET` | `/api/final_opname/:id/pdf` |
| `POST` | `/api/final_opname/:id/kunci_opname_final` |
| `POST` | `/api/final_opname/:id/approval` |
| `POST` | `/api/final_opname/approval/:id` |

### Instruksi Lapangan

| Method | Endpoint |
| --- | --- |
| `POST` | `/api/instruksi-lapangan/submit` |
| `GET` | `/api/instruksi-lapangan/list` |
| `GET` | `/api/instruksi-lapangan/:id` |
| `GET` | `/api/instruksi-lapangan/:id/pdf` |
| `GET` | `/api/instruksi-lapangan/:id/lampiran` |
| `POST` | `/api/instruksi-lapangan/:id/approval` |

### Serah Terima

| Method | Endpoint |
| --- | --- |
| `POST` | `/api/create_pdf_serah_terima` |
| `GET` | `/api/berkas_serah_terima` |
| `GET` | `/api/berkas_serah_terima/:id/pdf` |

---

## Dokumen, Dashboard, dan Utility

### Dokumentasi Bangunan

| Method | Endpoint |
| --- | --- |
| `POST` | `/api/dok/bangunan` |
| `GET` | `/api/dok/bangunan` |
| `GET` | `/api/dok/bangunan/:id` |
| `PUT` | `/api/dok/bangunan/:id` |
| `DELETE` | `/api/dok/bangunan/:id` |
| `POST` | `/api/dok/bangunan/:id/items` |
| `DELETE` | `/api/dok/bangunan/items/:itemId` |
| `POST` | `/api/dok/bangunan/:id/pdf` |
| `GET` | `/api/dok/bangunan/:id/pdf/download` |

### Penyimpanan Dokumen

| Method | Endpoint |
| --- | --- |
| `POST` | `/api/doc/penyimpanan-dokumen` |
| `GET` | `/api/doc/penyimpanan-dokumen` |
| `GET` | `/api/doc/penyimpanan-dokumen/archive-stores` |
| `POST` | `/api/doc/penyimpanan-dokumen/archive-stores` |
| `POST` | `/api/doc/penyimpanan-dokumen/migration-preview` |
| `POST` | `/api/doc/penyimpanan-dokumen/migration-commit` |
| `GET` | `/api/doc/penyimpanan-dokumen/:id` |
| `PUT` | `/api/doc/penyimpanan-dokumen/:id` |
| `DELETE` | `/api/doc/penyimpanan-dokumen/:id` |

### Dashboard, Activity, Email, User

| Method | Endpoint |
| --- | --- |
| `GET` | `/api/dashboard` |
| `GET` | `/api/dashboard/all` |
| `GET` | `/api/activity-log` |
| `POST` | `/api/send-email-notification` |
| `POST` | `/api/user_cabang` |
| `GET` | `/api/user_cabang` |
| `GET` | `/api/user_cabang/:id` |
| `PUT` | `/api/user_cabang/:id` |
| `DELETE` | `/api/user_cabang/:id` |

### Price RAB

| Method | Endpoint |
| --- | --- |
| `GET` | `/get-data` |
| `GET` | `/get-data-price-rab` |
| `GET` | `/api/get-data` |
| `GET` | `/api/get-data-price-rab` |

---

## Project Planning

Route tersedia pada dua prefix: `/api/project-planning` dan `/api/projek-planning`.

| Method | Endpoint |
| --- | --- |
| `POST` | `/:prefix/submit` |
| `POST` | `/:prefix/:id/resubmit` |
| `POST` | `/:prefix/:id/upload-rab` |
| `GET` | `/:prefix` |
| `GET` | `/:prefix/task-counts` |
| `GET` | `/:prefix/:id` |
| `GET` | `/:prefix/:id/logs` |
| `GET` | `/:prefix/:id/pdf` |
| `GET` | `/:prefix/:id/proxy-file` |
| `POST` | `/:prefix/:id/bm-approval` |
| `POST` | `/:prefix/:id/pp-approval-1` |
| `POST` | `/:prefix/:id/upload-3d` |
| `POST` | `/:prefix/:id/pp-approval-2` |
| `POST` | `/:prefix/:id/pp-manager-approval` |

---

## DC Development

| Method | Endpoint |
| --- | --- |
| `GET` | `/api/dc-development/projects` |
| `POST` | `/api/dc-development/projects` |
| `GET` | `/api/dc-development/projects/:id` |
| `POST` | `/api/dc-development/projects/:id/advance-stage` |
| `POST` | `/api/dc-development/projects/:id/tenders` |
| `GET` | `/api/dc-development/vendors` |
| `POST` | `/api/dc-development/vendors` |
| `POST` | `/api/dc-development/vendors/:id/users` |
| `GET` | `/api/dc-development/approvals` |
| `GET` | `/api/dc-development/documents` |
| `GET` | `/api/dc-development/documents/:id/view` |
| `GET` | `/api/dc-development/documents/:id/download` |
