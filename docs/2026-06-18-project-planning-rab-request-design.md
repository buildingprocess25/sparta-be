# Desain Permintaan RAB dari Project Planning

Tanggal: 18 Juni 2026

## Ringkasan

Project Planning tetap mensyaratkan RAB Sipil dan RAB ME berstatus `Disetujui`
sebelum Input Tahap 2 dapat dikirim. Perubahan ini menambahkan jembatan kerja dari
FPD ke halaman Penawaran Final Kontraktor agar kontraktor cabang mengetahui ULOK
yang membutuhkan RAB dan dapat membuka form RAB dengan data FPD terisi otomatis.

Notifikasi baru bernama **Permintaan RAB Project Planning** dan harus terpisah dari
notifikasi **Revisi RAB** yang sudah ada. Permintaan dibuat secara virtual dari
kondisi database aktif, bukan disimpan pada tabel antrean baru.

## Tujuan

- Menampilkan kebutuhan RAB Sipil dan ME untuk FPD yang sudah mencapai
  `WAITING_RAB_UPLOAD`.
- Membatasi permintaan kepada kontraktor pada cabang FPD terkait.
- Mengisi otomatis data header RAB dari FPD ketika kontraktor memilih permintaan.
- Menghilangkan permintaan per lingkup segera setelah RAB berhasil disubmit.
- Mencegah dua kontraktor membuat RAB untuk ULOK dan lingkup yang sama.
- Mempertahankan workflow approval RAB dan syarat Input Tahap 2 saat ini.

## Bukan Bagian Perubahan

- Item pekerjaan, kategori pekerjaan, volume, dan harga tidak berasal dari FPD.
- Durasi pekerjaan, data asuransi, logo perusahaan, dan identitas PT/CV tetap
  diisi atau berasal dari akun kontraktor.
- Workflow Gantt dan approval RAB tidak diubah.
- Revisi RAB tidak digabung dengan permintaan RAB Project Planning.
- Tidak ada tabel `rab_request` baru.

## Kondisi Sistem Saat Ini

FPD berpindah ke `WAITING_RAB_UPLOAD` setelah:

1. PP Specialist menyetujui Tahap 1 tanpa kebutuhan desain 3D; atau
2. PP Specialist selesai mengunggah desain 3D.

Pada Input Tahap 2, frontend dan backend mengharuskan RAB Sipil dan ME untuk ULOK
yang sama sudah berstatus `Disetujui`. Backend kemudian menyimpan relasi pada
`projek_planning.id_rab_sipil` dan `projek_planning.id_rab_me`.

Halaman `/rab` saat ini hanya memiliki notifikasi RAB yang ditolak untuk revisi.
Form RAB belum memiliki jalur prefill dari Project Planning.

## Arsitektur yang Dipilih

Backend menghitung permintaan secara langsung dari:

- `projek_planning.status = 'WAITING_RAB_UPLOAD'`;
- cabang pada FPD;
- dua lingkup wajib: `SIPIL` dan `ME`; serta
- ketiadaan RAB untuk kombinasi nomor ULOK dan lingkup tersebut.

Pendekatan ini dipilih karena status permintaan selalu mengikuti sumber data asli.
Jika FPD berpindah status atau RAB disubmit, hasil endpoint berubah otomatis tanpa
proses sinkronisasi antrean.

## Backend

### Endpoint daftar permintaan

Tambahkan endpoint:

`GET /api/project-planning/rab-requests`

Alias `/api/projek-planning/rab-requests` tetap tersedia mengikuti router saat ini.
Respons menyertakan `count` dan array `data`; `count` adalah jumlah lingkup yang
masih membutuhkan RAB.

Query:

- `actor_email`: email pengguna yang sedang login; wajib.

Backend mengambil daftar cabang pengguna dari mapping user/cabang yang sudah
dipakai aplikasi. Permintaan hanya dikembalikan jika cabang FPD termasuk cabang
yang dapat diakses pengguna tersebut. Parameter cabang dari frontend tidak menjadi
sumber otorisasi.

Setiap FPD yang memenuhi syarat menghasilkan maksimal dua baris virtual:

```json
{
  "projek_planning_id": 65,
  "id_toko": 123,
  "nomor_ulok": "Z001-2606-P091-R",
  "nama_toko": "Nama Toko",
  "nama_lokasi": "Nama Lokasi",
  "cabang": "HEAD OFFICE",
  "alamat_toko": "Alamat",
  "proyek": "Renovasi",
  "lingkup_pekerjaan": "SIPIL",
  "luas_bangunan": "120",
  "luas_area_terbuka": "20",
  "luas_area_terbangun": "130",
  "luas_area_parkir": "50",
  "luas_area_sales": "80",
  "luas_gudang": "20",
  "created_at": "2026-06-18T00:00:00.000Z"
}
```

Baris lingkup tidak dikembalikan jika sudah ada RAB untuk kombinasi ULOK dan
lingkup tersebut, tanpa membedakan status RAB. Dengan demikian permintaan hilang
setelah submit pertama berhasil dan tidak diambil kontraktor lain.

Pencocokan lingkup menggunakan normalisasi yang sama dengan modul RAB:
`SIPIL` atau `ME`. Pencocokan cabang bersifat case-insensitive.

### Endpoint detail prefill

Tambahkan endpoint:

`GET /api/project-planning/:id/rab-prefill?lingkup=SIPIL|ME&actor_email=<email>`

Endpoint memvalidasi:

- FPD ditemukan;
- status FPD masih `WAITING_RAB_UPLOAD`;
- lingkup valid;
- belum ada RAB untuk nomor ULOK dan lingkup tersebut; dan
- cabang FPD termasuk cabang yang dapat diakses `actor_email`.

Respons hanya berisi field yang aman untuk menjadi sumber form RAB:

- `projek_planning_id`
- `nomor_ulok`
- `nama_toko`, fallback ke `nama_lokasi`
- `cabang`
- `alamat`
- `proyek`
- `lingkup_pekerjaan`
- `luas_bangunan`
- `luas_area_terbuka`
- `luas_terbangun`, memakai `luas_area_terbangun` bila tersedia
- `luas_area_parkir`
- `luas_area_sales`
- `luas_gudang`

Field kosong tetap dikirim sebagai `null`; frontend tidak boleh mengarang nilai.

### Validasi submit RAB

Payload submit RAB mendapat field opsional `projek_planning_id`.

Jika field tersebut dikirim, service RAB memvalidasi bahwa:

- FPD masih `WAITING_RAB_UPLOAD`;
- nomor ULOK payload sama dengan FPD;
- cabang payload sama dengan FPD setelah normalisasi;
- lingkup payload adalah `SIPIL` atau `ME`; dan
- RAB untuk kombinasi ULOK dan lingkup belum ada.

Validasi duplikasi yang sudah ada tetap menjadi pengaman utama di transaksi.
Repository RAB wajib mengunci record toko untuk kombinasi ULOK dan lingkup sebelum
memeriksa keberadaan dan membuat RAB. Pelanggaran duplikasi dikembalikan sebagai
HTTP `409`.

Relasi asal ditelusuri melalui kolom nullable `rab.projek_planning_id` yang
mereferensikan `projek_planning(id)`. Backend wajib menyimpan nilai ini untuk
submit yang berasal dari permintaan Project Planning. Status permintaan tetap
dihitung dari ULOK dan lingkup sehingga data lama tetap kompatibel.

### Task count

Dashboard memakai nilai `count` dari endpoint `rab-requests`. Jumlah dihitung per
lingkup, sehingga satu FPD tanpa RAB menghasilkan nilai dua.

## Database

Migrasi menambahkan:

```sql
ALTER TABLE rab
ADD COLUMN IF NOT EXISTS projek_planning_id INTEGER NULL
REFERENCES projek_planning(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rab_projek_planning_id
ON rab(projek_planning_id);
```

Tidak dibuat tabel antrean permintaan.

Constraint `uq_toko_nomor_ulok_lingkup` yang sudah menjamin satu record toko per
ULOK dan lingkup dipertahankan. Penguncian record toko di transaksi RAB mencegah
dua request bersamaan lolos pemeriksaan keberadaan RAB.

## Frontend

### Halaman Penawaran `/rab`

Tambahkan panel **Permintaan RAB Project Planning** yang terpisah dari dialog atau
lonceng **Revisi RAB**.

Panel permintaan:

- dimuat hanya untuk pengguna yang boleh membuat RAB;
- difilter berdasarkan cabang pengguna;
- menampilkan ULOK, nama toko/lokasi, cabang, lingkup, dan umur permintaan;
- memakai kartu/baris terpisah untuk Sipil dan ME;
- memiliki tombol **Buat Penawaran**; dan
- menampilkan empty state jika tidak ada permintaan.

State, badge, dialog, dan handler permintaan tidak menggunakan `rejectedList`,
`revisionListDialogOpen`, atau state revisi lainnya.

Klik **Buat Penawaran** membuka:

`/rab?projek_planning_id=<id>&lingkup=SIPIL|ME`

### Prefill form RAB

Saat parameter tersebut tersedia, halaman:

1. meminta detail prefill ke backend;
2. mengisi ULOK, nama toko, cabang, alamat, proyek, lingkup, dan data luasan;
3. mengunci nomor ULOK, cabang, dan lingkup agar identitas permintaan tidak berubah;
4. memuat master harga berdasarkan cabang dan lingkup;
5. membiarkan item pekerjaan tetap kosong;
6. menampilkan banner bahwa form berasal dari Project Planning; dan
7. mengirim `projek_planning_id` ketika submit.

Kontraktor tetap mengisi:

- kategori dan item pekerjaan;
- volume;
- harga kondisional/manual;
- durasi pekerjaan;
- kategori lokasi;
- logo;
- nomor polis, masa berlaku, dan file asuransi.

Jika prefill sudah tidak valid karena RAB dibuat pengguna lain, frontend
menampilkan pesan bahwa permintaan sudah diambil dan kembali memuat daftar
permintaan.

### Badge dashboard

Badge menu Penawaran dapat menampilkan total:

`jumlah revisi milik pengguna + jumlah permintaan RAB cabang`

Di halaman `/rab`, kedua sumber selalu ditampilkan terpisah dan memiliki label
masing-masing agar pengguna tidak mengira permintaan baru sebagai revisi.

## Alur Data

1. PP Tahap 1 selesai atau desain 3D selesai.
2. FPD menjadi `WAITING_RAB_UPLOAD`.
3. Endpoint permintaan menghasilkan kebutuhan Sipil dan ME yang belum memiliki
   RAB.
4. Kontraktor cabang membuka halaman Penawaran.
5. Kontraktor memilih salah satu lingkup.
6. Frontend mengambil prefill FPD dan mengisi header form.
7. Kontraktor melengkapi detail RAB lalu submit.
8. Backend memvalidasi FPD dan duplikasi, kemudian menyimpan RAB berstatus
   `Menunggu Gantt Chart`.
9. Permintaan lingkup tersebut tidak lagi muncul.
10. Setelah kedua RAB melalui Gantt dan approval hingga `Disetujui`, Input Tahap 2
    FPD dapat dikirim seperti workflow saat ini.

## Error Handling

- `404`: FPD tidak ditemukan.
- `409`: RAB ULOK dan lingkup sudah dibuat, atau permintaan tidak lagi aktif.
- `422`: lingkup, ULOK, cabang, atau data prefill tidak cocok.
- Kegagalan mengambil daftar permintaan tidak boleh membuka dialog revisi.
- Kegagalan prefill tidak boleh menyisakan form setengah terisi; state dikembalikan
  ke kondisi awal.
- Submit biasa tanpa `projek_planning_id` tetap berfungsi untuk kebutuhan RAB di
  luar Project Planning.

## Pengujian

### Backend

- FPD `WAITING_RAB_UPLOAD` tanpa RAB menghasilkan dua permintaan.
- Adanya RAB Sipil menghilangkan hanya permintaan Sipil.
- Status RAB apa pun dianggap sudah disubmit.
- FPD dengan status lain tidak menghasilkan permintaan.
- Filter cabang tidak membocorkan permintaan cabang lain.
- Detail prefill memetakan semua field yang tersedia dan mempertahankan `null`.
- Submit dengan identitas FPD yang tidak cocok ditolak.
- Dua submit bersamaan untuk lingkup yang sama menghasilkan satu sukses dan satu
  `409`.
- Submit RAB biasa tanpa FPD tetap berhasil.

### Frontend

- Panel permintaan dan dialog revisi dapat tampil bersamaan tanpa mencampur data.
- Klik Sipil mengunci lingkup Sipil; klik ME mengunci lingkup ME.
- Header dan luasan terisi dari FPD.
- Item pekerjaan tetap kosong.
- Master harga mengikuti cabang dan lingkup hasil prefill.
- Setelah submit, permintaan terkait hilang saat daftar dimuat ulang.
- Error permintaan tidak mengubah badge atau dialog revisi.
- Badge dashboard menjumlahkan dua kategori tanpa menghilangkan label terpisah di
  halaman RAB.

### Regresi

- RAB tetap masuk ke Gantt setelah submit.
- Approval RAB tetap berjalan.
- Input Tahap 2 tetap memerlukan RAB Sipil dan ME berstatus `Disetujui`.
- Revisi RAB lama tetap memuat detail dan item revisi seperti sebelumnya.

## Kriteria Selesai

- Kontraktor cabang dapat melihat kebutuhan Sipil dan ME secara terpisah.
- Klik permintaan membuka form dengan data FPD yang benar.
- Item pekerjaan tetap menjadi input kontraktor.
- Permintaan hilang setelah submit, bukan setelah approval.
- Duplikasi RAB untuk ULOK dan lingkup yang sama dicegah backend/database.
- Notifikasi permintaan dan revisi tidak berbagi tampilan atau state.
- Workflow Project Planning dan RAB yang sudah ada tidak berubah di luar integrasi
  ini.
