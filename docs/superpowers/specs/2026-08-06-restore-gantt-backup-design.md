# Restore Gantt Chart Data dari SQL Dump Backup

## Tujuan
Mengembalikan data tabel `kategori_pekerjaan_gantt` dan `day_gantt_chart` dari file backup yang dibuat kemarin (`2026-08-05T19-00-00-166Z.sql.gz`) khusus untuk entri-entri lama yang rusak hari ini. Proses ini dijamin TIDAK akan menghapus atau mengubah data Gantt Chart baru yang dibuat oleh pengguna hari ini.

## Latar Belakang Masalah
1. Eksekusi skrip `migrate-il-mass.js` versi lama memasukkan item RAB dengan rentang tanggal Instruksi Lapangan (IL).
2. Eksekusi `fix-il-prefix.js` mengganti nama item RAB asli menjadi berawalan `[IL]`.
3. Skrip `rollback.js` secara sepihak mengubah rentang tanggal dari item RAB yang sudah ada mengikuti tanggal IL.
4. Meskipun `undo-all.js` telah mencoba mengembalikan nama dan rentang tanggal, namun masih ada data asli RAB yang rentang awalnya tertimpa karena kesalahan pembacaan log.

Untuk memastikan akurasi 100%, cara terbaik adalah melakukan restorasi langsung dari *backup* semalam.

## Arsitektur dan Langkah Eksekusi

### 1. Ekstraksi Data Spesifik (Streaming)
Karena ukuran backup cukup besar (1.3 GB terkompresi gz, kemungkinan > 10 GB SQL mentah), kita tidak akan me-restore seluruh database atau melakukan `pg_restore` penuh.
Sebaliknya, kita akan menulis sebuah skrip `extract-backup.js` yang memanfaatkan `zlib` dan stream Node.js untuk membaca file SQL baris per baris di memori.
Skrip ini akan mencari blok:
- `COPY public.kategori_pekerjaan_gantt`
- `COPY public.day_gantt_chart`
Lalu mengekstrak isinya (yang berupa format tab-separated dari perintah COPY) dan menyimpannya menjadi dua file lokal:
- `backup_kpg.tsv`
- `backup_dgc.tsv`

### 2. Membangun Tabel Staging (Sementara)
Di database PostgreSQL saat ini, kita akan membuat dua tabel *temporary / staging*:
- `temp_kategori_pekerjaan_gantt` (struktur sama dengan aslinya)
- `temp_day_gantt_chart` (struktur sama dengan aslinya)

File `.tsv` hasil ekstraksi akan dimasukkan ke tabel sementara ini dengan cepat menggunakan instruksi COPY / bulk insert.

### 3. Identifikasi Perbedaan
Setelah tabel staging siap, kita akan menjalankan query yang membandingkan tabel utama saat ini dengan tabel staging:
- Mencari `id_gantt` yang memiliki data yang *hilang*, *berubah nama*, atau *berubah hari* dibandingkan dengan tabel staging.
- **Kunci Keamanan**: Kita akan *mengabaikan* ID Gantt yang tidak ada di tabel staging (karena itu berarti Gantt Chart tersebut baru dibuat hari ini).

### 4. Pelaporan (Dry Run)
Skrip akan mencetak log yang merinci:
- Berapa jumlah Gantt Chart yang akan dipulihkan.
- Perbedaan konkret apa saja yang ditemukan.
Langkah ini memastikan transparansi sehingga pengguna bisa memberikan persetujuan sebelum database benar-benar diubah.

### 5. Restorasi Aktual (Update & Delete)
Setelah disetujui, skrip eksekusi final akan berjalan dalam satu `TRANSACTION` untuk menjamin integritas. Skrip akan:
- Menghapus item dari Gantt Chart terimbas di tabel utama.
- Menyalin kembali item dari tabel staging khusus untuk Gantt Chart tersebut.
- Mengakhiri transaksi dan menghapus tabel sementara.

## Rencana Pengujian (Testing & Verification)
1. Perbandingan jumlah baris ekstraksi TSV dengan ekspektasi ukuran tabel.
2. Pengujian parsial (Dry Run) wajib sukses tanpa error constraint foreign key.
3. Setelah selesai, cek acak (random check) pada salah satu `id_gantt` yang bermasalah (misalnya `1436` atau `1438`) untuk memastikan datanya identik dengan yang ada semalam.
