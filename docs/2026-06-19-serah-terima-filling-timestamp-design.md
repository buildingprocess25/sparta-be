# Timestamp Pengisian Berita Acara Serah Terima

## Latar Belakang

Tanggal Serah Terima pada PDF dan `berkas_serah_terima.created_at` saat ini
mengikuti tanggal kolom pengawasan yang dipilih di Gantt. Tanggal tersebut
merupakan tanggal jadwal pekerjaan, bukan waktu aktual pengguna mengisi atau
membuat Berita Acara Serah Terima (ST).

Contoh pada ULOK `CZ01-2603-0001`:

- tanggal pengawasan: 14 Juni 2026;
- timestamp ST yang tersimpan: 14 Juni 2026 pukul 00:00;
- data opname mulai diisi pada 18 Juni 2026.

Sebanyak 13 dari 14 record ST yang ada memiliki pola timestamp pukul 00:00 dan
terindikasi telah ditimpa tanggal Gantt.

## Tujuan

- Tanggal ST mengikuti timestamp aktual saat ST pertama kali dibuat.
- Timestamp bersumber dari server dengan zona waktu Asia/Jakarta.
- Pembuatan ulang PDF tidak mengubah timestamp ST pertama.
- Daftar dokumen, dashboard, perhitungan denda, dan PDF membaca waktu yang sama.
- Record historis yang terdampak dipulihkan menggunakan data aktivitas terdekat
  yang masih tersedia.

## Perubahan Frontend

`createPdfSerahTerima` hanya menerima dan mengirim `id_toko`. Halaman Gantt
tidak lagi menghitung atau mengirim tanggal kolom aktif sebagai
`tanggal_aktual`.

Pemulihan setelah network error tetap mengecek keberadaan record ST dengan
`link_pdf`, tetapi tidak membandingkan tanggal karena tanggal yang sah baru
diketahui oleh server.

## Perubahan Backend

Endpoint `POST /api/create_pdf_serah_terima` hanya membutuhkan `id_toko`.
Field lama `tanggal_aktual` boleh diabaikan sementara untuk kompatibilitas
client lama, tetapi tidak boleh lagi memengaruhi timestamp DB, PDF, atau denda.

Alur pembuatan ST:

1. Validasi toko dan data opname.
2. Cari record `berkas_serah_terima` terbaru untuk toko.
3. Jika belum ada, buat placeholder dengan default
   `timezone('Asia/Jakarta', now())`.
4. Gunakan `created_at` placeholder sebagai timestamp resmi ST.
5. Refresh denda menggunakan timestamp resmi tersebut.
6. Render PDF menggunakan timestamp resmi tersebut.
7. Upload PDF dan hanya perbarui `link_pdf`.
8. Jika record sudah ada, pertahankan `created_at` lama saat regenerate.

Auto-cascade ke lingkup saudara menjalankan alur yang sama. Setiap record
mendapat timestamp server ketika proses cascade-nya benar-benar dimulai, bukan
tanggal Gantt milik record pemicu.

Download/regenerate PDF menggunakan `berkas_serah_terima.created_at` sehingga
hasilnya konsisten dengan daftar dokumen.

## Model Data

Tidak diperlukan kolom baru. `berkas_serah_terima.created_at` dipertahankan
sebagai timestamp resmi pembuatan ST dan menggunakan default Jakarta yang sudah
ada di schema.

Parameter bernama `tanggalAktual` dan fungsi `upsertTanggalAktual` dihapus dari
alur bisnis agar arti `created_at` tidak kembali tercampur dengan tanggal
jadwal.

## Pemulihan Data Historis

Migrasi memperbarui record yang `created_at`-nya tepat pukul `00:00:00`.
Timestamp pengganti dipilih secara deterministik:

1. `MAX(opname_item.created_at)` untuk `opname_final` terbaru toko;
2. fallback `opname_final.created_at`;
3. record tidak diubah jika kedua sumber tidak tersedia.

Timestamp approval tidak dipakai karena approval dapat terjadi setelah ST
dibuat dan akan membuat tanggal ST terlalu maju.

Migrasi menyimpan snapshot nilai lama dan nilai pengganti dalam tabel audit
khusus sebelum update. Script bersifat idempotent dan hanya memperbarui record
yang masih memiliki pola timestamp salah.

Setelah migrasi, PDF ST terdampak harus diregenerasi dan link PDF diperbarui.
Regenerasi tidak boleh mengubah timestamp hasil pemulihan.

## Konsistensi Denda

Refresh denda menerima tanggal kalender dari timestamp resmi ST. Untuk record
baru, tanggal tersebut adalah tanggal pengisian server. Untuk record historis,
tanggal tersebut adalah tanggal aktivitas opname terakhir atau fallback header
opname.

Perubahan ini dapat mengubah nilai denda historis yang sebelumnya dihitung
dengan tanggal jadwal. Nilai baru dianggap benar karena mengikuti waktu aktual
pengisian yang diminta bisnis.

## Penanganan Kegagalan

- Placeholder dibuat hanya setelah data toko dan opname tervalidasi.
- Jika render atau upload gagal, record dapat tetap memiliki `link_pdf = NULL`;
  percobaan ulang menggunakan timestamp placeholder yang sama.
- Network recovery FE menerima record sebagai sukses hanya jika `link_pdf`
  sudah tersedia.
- Migrasi historis dijalankan dalam transaksi.
- Kegagalan regenerasi PDF tidak membatalkan koreksi timestamp DB; daftar ID
  yang gagal harus dilaporkan untuk retry.

## Verifikasi

- Membuat ST pada tanggal berbeda dari tanggal Gantt menghasilkan
  `created_at` sesuai waktu server Jakarta.
- PDF menampilkan tanggal dari `created_at`, bukan tanggal pengawasan.
- Regenerate dan download ulang mempertahankan tanggal ST pertama.
- Client lama yang masih mengirim `tanggal_aktual` tidak dapat menimpa
  `created_at`.
- Network recovery berhasil tanpa pencocokan tanggal Gantt.
- Auto-cascade menghasilkan timestamp aktual masing-masing proses.
- Migrasi hanya menyentuh record pukul 00:00 yang memiliki sumber pemulihan.
- Tidak ada record hasil migrasi yang tersisa pukul 00:00 jika sumber tersedia.
- TypeScript FE dan BE lolos typecheck.
- Build atau test terarah untuk modul ST tidak menghasilkan error baru.

## Batas Scope

- Tidak mengubah arti tanggal pengawasan atau PDF Memo Pengawasan.
- Tidak menambah field tanggal manual pada form.
- Tidak mengubah desain visual PDF selain sumber nilai Tanggal Serah Terima.
- Tidak memperbaiki timestamp tabel lain yang tidak terkait ST.
