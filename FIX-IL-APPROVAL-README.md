# Fix Approval Data - Instruksi Lapangan

Script untuk memperbaiki data approval (pemberi persetujuan koordinator dan manager) pada IL yang sudah terlanjur di-migrasi tanpa data approval.

## 🎯 Problem

IL yang di-migrasi sebelum update parser **tidak memiliki data approval**:
- `pemberi_persetujuan_koordinator` = NULL
- `waktu_persetujuan_koordinator` = NULL  
- `pemberi_persetujuan_manager` = NULL
- `waktu_persetujuan_manager` = NULL

Padahal data ini **penting untuk PDF** yang menampilkan siapa dan kapan IL disetujui.

## ✅ Solution

Script akan:
1. Membaca data approval dari `rab_kedua.xlsx` (sheet Form2 & Form3)
2. Match dengan IL di database berdasarkan ULOK + Lingkup Pekerjaan
3. Update kolom approval yang kosong

## 📋 Prerequisites

- File `rab_kedua.xlsx` harus ada di: `c:/alfamart/SPARTA/rab_kedua.xlsx`
- Database connection string di `.env` (`DATABASE_URL`)
- Node.js installed
- Dependencies: `pg`, `xlsx`, `dotenv` (sudah ada di sparta-be)

## 🚀 Usage

### Step 1: Preview (Dry Run)

**WAJIB jalankan preview dulu** untuk melihat data yang akan di-update:

```bash
cd sparta-be
node fix-il-approval-data-preview.js
```

Output akan menampilkan:
- Berapa record yang akan di-update
- Preview 10 record pertama
- Breakdown by status
- Record yang tidak match di Excel

### Step 2: Execute Update

Setelah yakin preview benar, jalankan script update:

```bash
node fix-il-approval-data.js
```

Script akan:
1. Countdown 5 detik (tekan Ctrl+C untuk cancel)
2. Execute UPDATE dalam transaction
3. Menampilkan progress setiap 10 records
4. COMMIT jika berhasil, ROLLBACK jika error

## 📊 Example Output

### Preview:
```
================================================================================
PREVIEW - Fix Approval Data untuk Instruksi Lapangan
================================================================================

📖 Reading rab_kedua.xlsx...
   Form3: 87 rows
   Form2: 138 rows

✅ Parsed 215 unique ULOK+Lingkup with approval data

🔍 Querying database for IL records...
   Found 200 IL records from migration
   128 records need approval data update
   72 records already have approval data

📊 Matching Statistics:
   ✅ Matched (akan di-update): 120
   ⚠️  Not matched in Excel: 8
   ℹ️  Already have approval data: 72

================================================================================
📋 PREVIEW: 120 records will be updated
================================================================================

Showing first 10 records:

1. IL ID: 12345
   ULOK: TZ01-2511-0003 (Sipil)
   Toko: Taman Palem Balaraja
   Status: Disetujui
   Koordinator: sugeng.santosa@sat.co.id
   Waktu Koordinator: 2026-02-02 16:19:08
   Manager: firman soleh@...
   Waktu Manager: 2026-02-02 16:40:57

...
```

### Execute:
```
🚀 Updating database...
   Updated 10/120...
   Updated 20/120...
   ...
   Updated 120/120...

✅ Successfully updated 120 records!
```

## ⚠️ Safety Features

1. **Preview script**: Tidak mengubah database sama sekali
2. **Countdown**: 5 detik untuk cancel sebelum update
3. **Transaction**: Semua update dalam 1 transaction (all-or-nothing)
4. **Filter**: Hanya update IL dengan `email_pembuat LIKE '%migration@sparta%'`
5. **Validation**: Hanya update jika approval data masih NULL

## 🔍 Query yang Dijalankan

```sql
UPDATE instruksi_lapangan
SET 
    pemberi_persetujuan_koordinator = $1,
    waktu_persetujuan_koordinator = $2::timestamp,
    pemberi_persetujuan_manager = $3,
    waktu_persetujuan_manager = $4::timestamp
WHERE id = $5
  AND email_pembuat LIKE '%migration@sparta%'
  AND (
    pemberi_persetujuan_koordinator IS NULL 
    OR pemberi_persetujuan_manager IS NULL
  )
```

## 📝 Notes

- Script menggunakan **merge strategy** yang sama dengan parser:
  - Form3 prioritas lebih tinggi dari Form2
  - Jika ada duplicate ULOK+Lingkup, ambil yang timestamp paling baru
  
- **Not matched** records kemungkinan:
  - ULOK atau Lingkup Pekerjaan typo/berbeda antara DB vs Excel
  - Data sudah dihapus dari Excel
  - Data baru di DB, belum ada di Excel

- Script **AMAN dijalankan multiple kali** karena:
  - Hanya update yang masih NULL
  - Tidak akan overwrite data approval yang sudah ada

## 🧹 Cleanup

Setelah selesai, hapus script ini:

```bash
rm fix-il-approval-data.js
rm fix-il-approval-data-preview.js
rm FIX-IL-APPROVAL-README.md
```

## ❓ Troubleshooting

### "File rab_kedua.xlsx tidak ditemukan"
- Pastikan file ada di `c:/alfamart/SPARTA/rab_kedua.xlsx`
- Atau edit variable `filePath` di script

### "Connection refused" / Database error
- Cek `.env` sudah benar
- Cek database accessible
- Cek `DATABASE_URL` format: `postgresql://user:pass@host:port/dbname`

### "No records to update"
- Cek apakah IL sudah punya data approval (sudah di-fix sebelumnya)
- Cek filter `email_pembuat LIKE '%migration@sparta%'`
