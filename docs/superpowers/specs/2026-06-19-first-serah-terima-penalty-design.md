# Denda Mengikuti Serah Terima Pertama per ULOK

## Latar Belakang

Satu ULOK dapat memiliki beberapa record `toko` untuk lingkup pekerjaan yang
berbeda, misalnya SIPIL dan ME. Setiap lingkup memiliki SPK, opname final, dan
berkas serah terima sendiri, tetapi denda merupakan nilai bersama pada level
ULOK.

Implementasi saat ini sudah mengelompokkan perhitungan denda berdasarkan
`nomor_ulok` dan cabang. Namun, tanggal Serah Terima (ST) yang dipakai adalah
`berkas_serah_terima.created_at` paling akhir dari seluruh lingkup. Hasil
perhitungan tersebut kemudian ditulis ke seluruh `opname_final` dalam scope,
sehingga nilai denda pada semua kartu konsisten tetapi tanggal acuannya salah.

Kasus produksi `CZ01-2603-0001` menunjukkan:

- ST SIPIL dibuat pada 18 Juni 2026;
- ST ME dibuat pada 19 Juni 2026;
- kedua opname saat ini menyimpan denda 4 hari atau Rp4.000.000 karena sistem
  mengikuti ST kedua;
- aturan bisnis mengharuskan denda mengikuti ST pertama, sehingga kedua
  lingkup harus menampilkan 3 hari atau Rp3.000.000.

## Aturan Bisnis

- Denda dihitung satu kali untuk satu scope ULOK dan cabang.
- Tanggal akhir SPK efektif tetap mengikuti tanggal paling akhir dari seluruh
  SPK valid dan perpanjangan SPK yang disetujui dalam scope tersebut.
- Tanggal ST untuk perhitungan denda adalah `created_at` paling awal dari
  seluruh `berkas_serah_terima` dalam scope.
- Hasil perhitungan yang sama disimpan dan ditampilkan pada semua lingkup dalam
  scope, termasuk kartu SIPIL dan ME.
- Pembuatan ST lingkup berikutnya tidak boleh memajukan tanggal acuan denda atau
  menaikkan denda yang sudah ditentukan oleh ST pertama.
- Jika belum ada ST dalam scope, denda tetap nol dengan tanggal ST `null`.

## Perubahan Backend

### Sumber Tanggal ST

Query ST pada `calculateDendaByTokoId` diubah dari:

```sql
ORDER BY created_at DESC, id DESC
LIMIT 1
```

menjadi pemilihan record paling awal secara deterministik:

```sql
ORDER BY created_at ASC, id ASC
LIMIT 1
```

Pemilihan tetap menggunakan seluruh `id_toko` hasil resolusi scope ULOK dan
cabang. Tidak ada perubahan pada formula hari kerja atau tarif denda.

### Sinkronisasi Opname

`refreshDendaByTokoId` tetap memperbarui seluruh `opname_final` dalam scope
penalty. Setiap record mendapatkan:

- `hari_denda` yang sama;
- `nilai_denda` yang sama;
- `tanggal_akhir_spk_denda` yang sama;
- `tanggal_serah_terima_denda` yang sama, yaitu tanggal ST pertama.

Dengan desain ini, endpoint daftar Berkas Serah Terima tidak perlu melakukan
perhitungan tambahan. Join ke opname terbaru per toko tetap menghasilkan nilai
bersama yang benar.

### Pemicu Refresh

Semua pemicu refresh yang sudah ada dipertahankan, termasuk:

- pembuatan atau regenerasi Berkas Serah Terima;
- approval atau perubahan Pertambahan SPK;
- alur Opname Final yang memanggil refresh denda.

Ketika ST kedua dibuat oleh auto-cascade atau secara langsung, refresh ulang
akan tetap menemukan ST pertama dan tidak mengubah tanggal acuan.

## Perubahan Frontend

Tidak diperlukan perubahan perilaku di `sparta-fe`.

Halaman daftar dokumen tetap membaca `hari_denda` dan `nilai_denda` dari API
dan menampilkannya pada kedua kartu. Setelah backend dan data historis
diperbaiki, SIPIL dan ME akan menampilkan nilai yang sama berdasarkan ST
pertama.

Tipe `BerkasSerahTerimaItem` dapat dilengkapi dengan field finansial yang
memang sudah dikirim API jika diperlukan untuk ketepatan TypeScript, tetapi
perubahan tersebut tidak boleh menambahkan kalkulasi denda baru di frontend.
Backend tetap menjadi sumber kebenaran.

## Perbaikan Data Historis

Data existing yang pernah dihitung memakai ST terakhir harus dihitung ulang.
Disediakan script SQL atau utility terarah yang:

1. mengidentifikasi scope ULOK dan cabang dengan lebih dari satu ST;
2. memilih ST pertama per scope;
3. memilih tanggal akhir SPK efektif paling akhir per scope;
4. menghitung ulang hari dan nominal menggunakan aturan aplikasi;
5. memperbarui seluruh `opname_final` pada scope tersebut;
6. bersifat idempotent sehingga aman dijalankan ulang.

Perbaikan wajib mencakup `CZ01-2603-0001`. Sebelum update, nilai lama dan nilai
baru dicatat atau ditampilkan sebagai preview agar perubahan dapat diaudit.
Operasi koreksi database dijalankan dalam transaksi.

PDF Opname Final dan Berkas Serah Terima yang menampilkan denda harus
diregenerasi bila nilai denda tercetak di dalam dokumen. Kegagalan regenerasi
PDF tidak boleh membatalkan nilai DB yang sudah benar; ID yang gagal dilaporkan
untuk retry.

## Penanganan Kondisi Tepi

- Dua ST dengan timestamp sama dipilih berdasarkan `id` terkecil.
- Record ST dengan `created_at` tidak valid tidak boleh mengalahkan timestamp
  valid; schema DB saat ini mengharuskan timestamp tersedia.
- ULOK tanpa `nomor_ulok` tetap dihitung hanya untuk `id_toko` target.
- Scope cabang mempertahankan aturan kompatibilitas saat ini agar ULOK sama
  dari cabang berbeda tidak tercampur.
- SPK ditolak atau dibatalkan tetap dikecualikan sesuai filter status saat ini.
- ST kedua yang dibuat lebih lambat tidak mengubah denda, termasuk bila
  lingkup yang pertama adalah ME dan yang kedua SIPIL.

## Verifikasi

### Unit

- `calculateDendaFromDates` tetap menghasilkan nominal sesuai formula yang ada.
- Pemilihan ST scope memakai record paling awal.
- Timestamp sama memakai ID terkecil.

### Integrasi

- SIPIL ST lebih dahulu, ME kemudian: kedua opname menggunakan tanggal SIPIL.
- ME ST lebih dahulu, SIPIL kemudian: kedua opname menggunakan tanggal ME.
- Pembuatan ST kedua tidak menaikkan denda.
- Perpanjangan SPK yang disetujui tetap dapat mengubah tanggal akhir SPK dan
  menghitung ulang denda terhadap ST pertama.
- ULOK tunggal tetap menghasilkan perilaku yang sama seperti sebelumnya.
- API `GET /api/berkas_serah_terima` mengirim denda identik untuk seluruh
  lingkup satu ULOK.

### Regresi

- TypeScript backend dan frontend lolos pemeriksaan.
- Daftar dokumen menampilkan nilai yang sama pada kedua kartu.
- Dashboard tidak menggandakan total denda per ULOK dan tetap memakai nilai
  backend.
- PDF hasil regenerasi menampilkan nilai koreksi.
- Preview perbaikan historis menunjukkan `CZ01-2603-0001` berubah dari 4 hari
  atau Rp4.000.000 menjadi 3 hari atau Rp3.000.000.

## Batas Scope

- Tidak mengubah formula tarif denda.
- Tidak mengubah definisi hari kerja atau hari bebas denda.
- Tidak memisahkan denda per lingkup pekerjaan.
- Tidak mengubah urutan kartu pada frontend.
- Tidak mengubah desain visual halaman atau PDF.
- Tidak mengubah cara penentuan tanggal akhir SPK efektif selain memastikan
  tanggal tersebut tetap merupakan tanggal paling akhir dalam scope.
