# Desain Perbaikan Bug SPARTA Aktif

Tanggal: 22 Juni 2026

## Scope

Perbaikan mencakup lima masalah aktif:

1. Total nilai Approval Kerja Tambah Kurang.
2. Catatan item Instruksi Lapangan tidak tampil di PDF.
3. Opname gagal disimpan ketika verifikasi berisi `Tidak Sesuai` atau `Tidak Baik`.
4. Sumber dan koreksi tanggal Serah Terima.
5. Gantt tetap terkunci setelah RAB hasil intervensi ditolak koordinator.

Sinkronisasi durasi RAB dan Gantt tidak termasuk scope.

## 1. Total Nilai Approval KTK

### Masalah

Nilai KTK tersimpan di `opname_final.grand_total_final`, tetapi kalkulasi juga dilakukan secara terpisah di generator PDF. Data lama dapat menyimpan hasil yang stale sehingga nilai pada daftar/detail approval berbeda dari rekap PDF.

### Desain

- Buat satu kalkulator finansial backend yang digunakan oleh:
  - kalkulasi dan penyimpanan total `opname_final`;
  - response daftar/detail Approval KTK;
  - generator PDF Opname Final.
- Rumus resmi:

  `Total Final = RAB + IL + Kerja Tambah - Kerja Kurang - Denda`

- Aturan pembulatan dan PPN mengikuti aturan PDF yang sudah berjalan, termasuk area tanpa PPN.
- Response list/detail tidak mempercayai nilai lama secara buta. Backend menghitung ulang dan menyinkronkan kolom total sebelum mengembalikan data.
- Sediakan script migrasi/backfill idempoten untuk menghitung ulang seluruh `opname_final`, sehingga data lama dan data baru memakai aturan yang sama.

## 2. Catatan Instruksi Lapangan

### Masalah

FE mengirim catatan dan DB menyimpannya di `instruksi_lapangan_item.catatan`, tetapi generator PDF mengganti nilai tersebut dengan string kosong.

### Desain

- Generator PDF meneruskan `item.catatan` ke template.
- Catatan kosong tetap tidak menghasilkan baris tambahan.
- Tidak perlu memindahkan data lama karena catatan lama sudah berada di tabel item.
- Sediakan proses regenerasi PDF IL untuk dokumen lama agar PDF yang tersimpan di Drive ikut diperbarui.
- Semua PDF IL baru otomatis memakai catatan dari DB.

## 3. Opname dengan Nilai Tidak Sesuai/Tidak Baik

### Masalah

Nilai tersebut tersedia pada dropdown dan secara skema seharusnya valid. Penyebab kegagalan harus dibuktikan pada jalur submit item dan submit massal, baik JSON maupun multipart.

### Desain

- Tambahkan pengujian request dengan kombinasi:
  - `desain = Tidak Sesuai`;
  - `kualitas = Tidak Baik`;
  - `spesifikasi = Tidak Sesuai`;
  - kombinasi ketiganya;
  - request JSON dan multipart.
- Normalisasi nilai verifikasi di backend tanpa mengubah arti nilainya.
- Backend memvalidasi enum nilai yang didukung dan mengembalikan pesan per field yang jelas.
- FE tidak mengganti pilihan negatif menjadi kosong dan menampilkan isi error backend, termasuk detail validasi Zod.
- Alur upsert mempertahankan foto lama dan catatan ketika tidak ada file baru.
- Fix dianggap selesai hanya jika payload negatif berhasil tersimpan dan terbaca kembali dari DB.

## 4. Tanggal Serah Terima

### Masalah

Saat ini tanggal dokumen dan perhitungan denda menggunakan `berkas_serah_terima.created_at`. Kolom ini juga berfungsi sebagai timestamp pembuatan record. Perhitungan denda mengambil tanggal ST pertama pada scope ULOK/cabang, sehingga mengubah record yang bukan record pertama tidak memengaruhi hasil.

### Desain

- Tambahkan kolom resmi `berkas_serah_terima.tanggal_serah_terima`.
- Backfill data lama dari `created_at`.
- PDF, daftar ST, dan kalkulator denda membaca field resmi tersebut.
- `created_at` kembali hanya bermakna waktu record dibuat dan tidak menjadi tanggal bisnis.
- Tambahkan service/script koreksi tanggal berdasarkan scope ULOK dan cabang. Koreksi akan:
  1. memperbarui `tanggal_serah_terima` seluruh berkas dalam scope;
  2. menghitung ulang `hari_denda`, `nilai_denda`, `tanggal_akhir_spk_denda`, dan `tanggal_serah_terima_denda` seluruh `opname_final` terkait;
  3. menghitung ulang total final KTK;
  4. meregenerasi PDF ST dan Opname Final.

Untuk koreksi langsung melalui DB setelah migrasi, field utama yang diubah adalah:

```sql
UPDATE berkas_serah_terima
SET tanggal_serah_terima = DATE '2026-06-22'
WHERE id_toko IN (...scope ULOK/cabang...);
```

Namun update SQL saja tidak dapat meregenerasi file di Google Drive. Setelah update harus menjalankan script refresh yang disediakan aplikasi. Jalur yang direkomendasikan adalah memakai script/service koreksi agar seluruh turunan diperbarui sekaligus.

## 5. Gantt Setelah Penolakan Koordinator

### Masalah

Intervensi dapat mengunci Gantt dan melepaskan RAB ke approval. Ketika koordinator menolak RAB, alur approval hanya mengubah status RAB. Gantt tidak dibuka kembali, sehingga RAB perlu revisi tetapi jadwal tetap terkunci.

### Desain

- Pada transisi RAB menjadi `Ditolak oleh Koordinator`, backend mencari Gantt aktif/latest pada toko yang sama.
- Jika status Gantt `terkunci`, ubah menjadi `active` dalam transaksi yang sama dengan penolakan RAB.
- Tambahkan activity log Gantt dengan sumber `rab_rejected_by_coordinator`.
- Jika Gantt sudah aktif, operasi menjadi no-op dan tetap aman diulang.
- FE memuat ulang detail setelah penolakan agar status terbaru langsung terlihat.

## Migrasi dan Kompatibilitas

- Semua migrasi bersifat idempoten.
- Backfill total KTK mencakup seluruh data lama.
- Backfill tanggal ST menggunakan `created_at` hanya sekali untuk mengisi field resmi yang kosong.
- Catatan IL lama tidak diubah; PDF lama diregenerasi dari data item yang sudah tersimpan.
- Perubahan tidak menghapus atau mengubah data historis approval.

## Verifikasi

- Typecheck FE dan BE.
- Test kalkulator total dengan RAB, IL, tambah, kurang, denda, pembulatan, dan area tanpa PPN.
- Test penyimpanan opname nilai positif dan negatif melalui JSON/multipart.
- Test koreksi tanggal ST dan hasil denda.
- Test penolakan koordinator membuka Gantt serta menulis activity log.
- Render PDF IL, Opname Final, dan ST untuk memastikan nilai/catatan/tanggal tampil benar.
