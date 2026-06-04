# Backup Database Harian ke Google Drive

Backup dijalankan sebagai Render Cron Job terpisah dari web service backend.

## Command

Build command:

```bash
npm install && npm run build
```

Start command / command:

```bash
npm run backup:drive:prod
```

Schedule Render Cron:

```cron
0 17 * * *
```

Render memakai UTC. `0 17 * * *` sama dengan pukul 00:00 WIB.

## Environment

Gunakan environment yang sama dengan backend:

- `DATABASE_URL`
- `GOOGLE_DOC_TOKEN_PATH=/etc/secrets/token_doc.json`
- `DOC_DRIVE_ROOT_ID`

Opsional:

- `DB_BACKUP_DRIVE_ROOT_ID`: root folder Drive khusus backup. Jika kosong, memakai `DOC_DRIVE_ROOT_ID`.
- `DB_BACKUP_DRIVE_FOLDER_NAME`: default `backup database building`.
- `DB_BACKUP_RETENTION_COUNT`: default `10`.

Pastikan `DATABASE_URL` mengarah ke koneksi Postgres langsung, bukan pooler/PGBouncer.

## Perilaku

Setiap run akan:

1. Menjalankan `pg_dump`.
2. Mengompres hasil menjadi `.sql.gz`.
3. Membuat folder `backup database building` jika belum ada.
4. Upload file backup ke folder itu sebagai file private.
5. Menyimpan hanya 10 backup terbaru dan menghapus sisanya.

Retention dijalankan setelah upload sukses, jadi backup lama tidak dihapus jika backup baru gagal.
