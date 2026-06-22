# Release Perbaikan Bug Aktif — 22 Juni 2026

Urutan deployment:

1. Deploy backend dan frontend.
2. Jalankan migrasi:
   - `sql/2026-06-22-reopen-gantt-for-coordinator-rejected-rab.sql`
3. Sinkronkan total KTK lama:
   - `npm run backfill:opname-financial`
4. Regenerasi PDF IL lama agar catatan yang sudah tersimpan muncul:
   - `npm run regenerate:il-pdfs`

Koreksi tanggal Serah Terima setelah release:

```powershell
npm run correct:serah-terima-date -- --nomor-ulok=UZ01-2601-0003 --cabang="SIDOARJO BPN_SMD" --tanggal=2026-06-22
```

Perintah tersebut memperbarui tanggal dokumen pada `berkas_serah_terima.created_at` untuk seluruh scope ULOK/cabang, lalu menyinkronkan `opname_final.tanggal_serah_terima_denda`, menghitung ulang denda dan total KTK, serta meregenerasi PDF Serah Terima dan Opname Final.

Jika terpaksa mengubah lewat SQL:

```sql
UPDATE berkas_serah_terima bst
SET created_at = (
    DATE '2026-06-22' + COALESCE(bst.created_at::time, TIME '00:00:00')
)::timestamp
FROM toko t
WHERE t.id = bst.id_toko
  AND t.nomor_ulok = 'UZ01-2601-0003'
  AND UPPER(t.cabang) = UPPER('SIDOARJO BPN_SMD');
```

Setelah SQL manual, tetap jalankan script koreksi dengan parameter yang sama agar seluruh data turunan dan PDF ikut diperbarui.
