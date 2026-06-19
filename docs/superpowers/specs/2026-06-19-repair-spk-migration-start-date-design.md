# Repair Tanggal Mulai Migrasi SPK

## Tujuan

Memperbaiki tanggal mulai 14 SPK hasil migrasi yang tersimpan satu hari lebih awal daripada nilai pada sheet `SPK_Data`, sekaligus mencegah pergeseran tanggal yang sama pada migrasi berikutnya.

Perubahan ini tidak memigrasikan ulang SPK, tidak mengganti nilai kontrak, nomor SPK, status, durasi, tanggal selesai, PDF, atau relasi toko.

## Akar Masalah

Parser migrasi SPK memakai `Date.toISOString()` untuk nilai tanggal Excel. Nilai `Date` yang mewakili tanggal kalender lokal dapat dikonversi ke UTC pada hari sebelumnya. Fungsi `dateOnly()` kemudian mengambil bagian tanggal dari hasil UTC tersebut.

Timestamp seperti `Timestamp` dan `Waktu Persetujuan` tetap membutuhkan parsing waktu. Sementara `Waktu Mulai` dan `Waktu Selesai` merupakan tanggal kalender dan harus diproses tanpa konversi zona waktu.

## Perubahan Parser

Tambahkan parser tanggal kalender khusus dengan aturan:

1. Nilai `Date` dibaca memakai `getFullYear()`, `getMonth() + 1`, dan `getDate()`.
2. Serial number Excel dikonversi ke tahun, bulan, dan hari tanpa menggeser zona waktu.
3. String ISO `YYYY-MM-DD` dipertahankan sebagai tanggal yang sama.
4. String tanggal spreadsheet menerima format tanggal yang sudah digunakan pada `SPK_Data`.
5. Nilai tidak valid menghasilkan `null`.

`Waktu Mulai` dan `Waktu Selesai` memakai parser tanggal kalender. `Timestamp` dan `Waktu Persetujuan` tetap memakai parser timestamp.

## Identifikasi Data Repair

Repair hanya berlaku pada SPK yang memenuhi seluruh kondisi:

- Berasal dari source ID migrasi SPK yang tercatat pada activity log.
- ULOK dan lingkup cocok dengan baris `SPK_Data`.
- Nomor SPK, total, durasi, dan tanggal selesai sudah cocok.
- Tanggal mulai DB tepat satu hari sebelum tanggal mulai pada Excel.

Record lain tidak boleh diperbarui. Daftar final ID SPK dan nilai lama/baru harus terlihat pada query preview sebelum `UPDATE`.

## Audit dan Transaksi

SQL repair membuat tabel audit idempoten yang menyimpan:

- ID SPK
- ULOK
- lingkup pekerjaan
- tanggal mulai lama
- tanggal mulai baru
- waktu repair

Proses berjalan dalam satu transaksi:

1. Bangun candidate set.
2. Simpan candidate ke tabel audit dengan `ON CONFLICT DO NOTHING`.
3. Perbarui `pengajuan_spk.waktu_mulai`.
4. Verifikasi jumlah record yang berubah harus 14.
5. Commit.

Jika jumlah kandidat bukan 14, transaksi harus gagal agar perubahan parsial tidak terjadi.

## Dampak Turunan

Repair ini dapat mengubah perhitungan hari relatif pada fitur yang membaca tanggal mulai SPK, tetapi tidak langsung mengubah:

- `gantt_chart`
- `day_gantt_chart`
- `pengawasan_gantt`
- `pengawasan`

Setelah repair, Gantt harus dianalisis ulang pada tahap berikutnya. Tidak dilakukan pembaruan Gantt otomatis dalam repair ini.

## Pengujian

Tambahkan tes parser untuk:

- `Date` lokal tidak bergeser hari.
- Serial number Excel menghasilkan tanggal yang benar.
- String ISO tetap sama.
- Format tanggal spreadsheet yang digunakan file diterima.
- Nilai invalid ditolak.

Verifikasi database setelah repair:

- Tepat 14 SPK berubah.
- Tanggal mulai 14 SPK sama dengan `SPK_Data`.
- Nomor SPK, durasi, tanggal selesai, nilai, status, dan PDF tidak berubah.
- Tidak terdapat SPK di luar candidate set yang berubah.

