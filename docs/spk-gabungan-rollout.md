# SPK baru gabungan SIPIL + ME

## Perubahan

Pengajuan dengan RAB SIPIL dan ME disetujui, kontraktor sama, dan tanpa riwayat SPK menjadi satu pilihan SIPIL + ME. Backend menyimpan dua record dengan `spk_group_id` yang sama dan nilai masing-masing RAB. Nomor SPK, PAR, kode toko, tanggal mulai, durasi, dan tanggal selesai sama.

Durasi awal gabungan menggunakan durasi RAB terlama dan dapat diisi pada form. Revisi gabungan menggunakan durasi SPK sebelumnya. Form tunggal tetap mengambil durasi RAB seperti sebelumnya.

Approve/reject/intervensi dan revisi grup bersifat atomik. Dokumen grup memuat biaya SIPIL, biaya ME, total, terbilang total, dan satu pasangan tanda tangan. Record lama tidak di-backfill, tidak digabung berdasarkan ULOK, dan PDF-nya tetap tunggal. Kontraktor berbeda menampilkan pesan dan menahan submit gabungan.

## Urutan penerapan

1. Jalankan `sql/2026-09-10-spk-groups.sql` pada database tujuan menggunakan prosedur deployment database proyek. Skrip menambahkan kolom nullable dan indeks, tanpa UPDATE/DELETE data lama. Skrip dapat dijalankan ulang.
2. Deploy backend dari branch `codex/contractor-first-opname-be`.
3. Deploy frontend dari branch `codex/contractor-first-opname-fe`.

Migrasi wajib selesai sebelum backend baru dipakai: query membaca kolom `spk_group_id`. Endpoint `GET /api/spk/candidates` juga wajib tersedia sebelum frontend baru dipakai. Migrasi telah diterapkan atas persetujuan pengguna pada 10 September 2026 pukul 19:35 WIB, melalui konfigurasi sparta-be/.env. Sebanyak 1.071 SPK lama tetap tanpa grup; checksum SPK, log approval, toko, dan RAB identik sebelum/sesudah. Audit tersimpan di outputs/spk-group-migration. Backend lokal port 8081 dan frontend lokal port 3000 aktif untuk testing. Deployment aplikasi ke hosting belum dilakukan.

Contoh perintah migrasi ketika konfigurasi koneksi database tujuan sudah diatur oleh operator:

```powershell
psql --set ON_ERROR_STOP=1 --file sql/2026-09-10-spk-groups.sql
```

Verifikasi schema setelah migrasi:

```sql
SELECT column_name,data_type,is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='pengajuan_spk' AND column_name='spk_group_id';
```

Jangan menghapus kolom grup atau mengembalikan backend lama setelah grup mulai dibuat: backend lama tidak memahami tindakan untuk dua anggota. Jika ada masalah setelah grup dipakai, hentikan pengajuan/tindakan sementara dan lakukan perbaikan dengan metadata grup tetap utuh.

## Pemeriksaan lokal

Dari `sparta-be`:

```powershell
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
node node_modules/tsx/dist/cli.mjs --test src/modules/spk/spk-group.rules.test.ts src/modules/spk/spk-access.test.ts
node node_modules/tsx/dist/cli.mjs src/scripts/verify-spk-pdf-fixtures.ts
```

Tes transaksi hanya menerima database khusus localhost bernama `spk_group_integration`. Tes membuat/truncate tabel fixture dalam database tersebut dan tidak menggunakan `.env` sebagai fallback. Pada lingkungan implementasi, cluster khusus berada di `outputs/spk-test-db`, role `spk_test`, port `55439`.

```powershell
$env:SPK_TEST_DATABASE_URL='postgresql://spk_test@127.0.0.1:55439/spk_group_integration?sslmode=disable'
node node_modules/tsx/dist/cli.mjs --test src/modules/spk/spk-group.integration.test.ts
```

Tes mencakup biaya nol, rollback anggota kedua, submit paralel/ulang, status berubah, approval kedua ID, legacy terpisah, reject/revisi, nomor historis terbesar, intervensi/log, link PDF, migrasi berulang, dan filter cabang.

Dari root workspace:

```powershell
node sparta-fe/node_modules/typescript/bin/tsc --noEmit -p sparta-fe/tsconfig.json
node sparta-be/node_modules/tsx/dist/cli.mjs --test sparta-fe/lib/spk-groups.test.ts
python sparta-fe/scripts/verify-spk-browser.py
```

Tes browser membutuhkan frontend lokal pada port 3000. Semua request API dimock dan koneksi remote diblokir; submit dan notifikasi tidak diteruskan ke layanan nyata. Artefak browser berada di `artifacts/spk-browser`; PDF contoh dan hasil pemeriksaan berada di `artifacts/spk-pdf-fixtures`.

Pembuatan PDF/unggahan Drive dan refresh denda dilakukan setelah commit database. Kegagalan layanan turunan dicatat; status SPK tidak dibatalkan sebagian. Integrasi Drive/email nyata tidak dijalankan dalam pengujian.
