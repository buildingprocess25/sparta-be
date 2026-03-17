# Sparta V2 (Node.js + TypeScript)

Service ini khusus untuk alur **SPARTA V2**, dengan PostgreSQL sebagai sumber data.

## Fitur

- Manajemen data toko (master data)
- Pengajuan RAB dengan approval workflow
- Pengajuan SPK dengan approval workflow
- Endpoint untuk generate PDF RAB dan SPK
- Filter dan pagination untuk list RAB dan SPK
- Validasi input yang ketat menggunakan Zod
- Struktur kode modular dan terorganisir
- Logging dan error handling yang baik
- Dokumentasi API yang jelas
- Contoh request/response untuk setiap endpoint
- Unit test untuk fungsi-fungsi utama (opsional)
- Middleware untuk autentikasi dan otorisasi (opsional)
- CORS dan rate limiting (opsional)

## Struktur Folder

```text
src/
├── index.ts
├── app.ts
├── config/
├── database.ts
├── modules/
│   ├── toko/
│   │   ├── toko.controller.ts
│   │   ├── toko.service.ts
│   │   ├── toko.schema.ts
│   │   └── toko.routes.ts
│   ├── rab/
│   │   ├── rab.controller.ts
│   │   ├── rab.service.ts
│   │   ├── rab.schema.ts
│   │   └── rab.routes.ts
│   └── spk/
│       ├── spk.controller.ts
│       ├── spk.service.ts
│       ├── spk.schema.ts
│       └── spk.routes.ts
├── utils/
└── templates/
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
- `POST /api/spk/submit`
- `GET /api/spk`
- `GET /api/spk/:id`
- `GET /api/spk/:id/pdf`
- `POST /api/spk/:id/approval`

## Dokumentasi API

- `docs/api-toko.md`
- `docs/api-rab.md`
- `docs/api-gantt.md`
- `docs/api-spk.md`

Dibuat pada 2026-03-02
