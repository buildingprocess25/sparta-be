# Sparta API (Node.js + TypeScript)

Service ini khusus untuk alur **RAB utama** (bukan RAB kedua), dengan PostgreSQL sebagai sumber data.

## Fitur

- Master data toko (`toko`)
- Submit pengajuan RAB (`pengajuan_rab`) + detail item (`detail_item_rab`)
- Hitung total mengikuti flow backend lama:
  - `grand_total_nonsbo`: total item selain kategori `PEKERJAAN SBO`
  - `grand_total_final`: pembulatan bawah ke kelipatan 10.000 lalu + 11%
- Approval berjenjang (`approval_log`):
  - Koordinator -> Manager -> Approved
  - Reject per level dengan alasan penolakan
- Generate PDF RAB dari data pengajuan (`/api/rab/:id/pdf`)

## Struktur Folder

```text
sparta-api/
  sql/
    001_create_rab_tables.sql
  src/
    common/
    config/
    db/
    modules/
      approval/
      rab/
      toko/
```

## Setup

1. Copy env:

```bash
cp .env.example .env
```

2. Install dependency:

```bash
npm install
```

Project ini memakai toolchain modern: `tsx` + TypeScript terbaru (Node 22 LTS direkomendasikan).

3. Jalankan SQL migration manual ke PostgreSQL:

```bash
psql "$DATABASE_URL" -f sql/001_create_rab_tables.sql
```

4. Jalankan service:

```bash
npm run dev
```

## Endpoint

- `POST /api/toko`
- `GET /api/toko`
- `GET /api/toko/:nomorUlok`
- `POST /api/rab/submit`
- `GET /api/rab`
- `GET /api/rab/:id`
- `GET /api/rab/:id/pdf`
- `POST /api/rab/:id/approval`

## Contoh Submit RAB

```json
{
  "nomor_ulok": "Z001-2512-TEST",
  "email_pembuat": "kontraktor@example.com",
  "nama_pt": "PT Contoh",
  "lingkup_pekerjaan": "SIPIL",
  "durasi_pekerjaan": "45 Hari",
  "link_pdf_gabungan": "https://drive.google.com/file/d/xxx/view",
  "detail_items": [
    {
      "kategori_pekerjaan": "PEKERJAAN PERSIAPAN",
      "jenis_pekerjaan": "Pembersihan area",
      "satuan": "LS",
      "volume": 1,
      "harga_material": 500000,
      "harga_upah": 250000
    }
  ]
}
```

## Contoh Approval

```json
{
  "approver_email": "koordinator@contoh.com",
  "jabatan": "KOORDINATOR",
  "tindakan": "APPROVE"
}
```

Untuk reject:

```json
{
  "approver_email": "manager@contoh.com",
  "jabatan": "MANAGER",
  "tindakan": "REJECT",
  "alasan_penolakan": "Volume tidak sesuai survey lapangan"
}
```
