# Penjelasan: IL Detection dalam Migrasi Opname

## Apa itu IL (Instruksi Lapangan)?

**IL (Instruksi Lapangan)** adalah item pekerjaan **TAMBAHAN** yang **TIDAK ADA di RAB** awal, tapi ditambahkan di lapangan karena:
- Ada kebutuhan pekerjaan tambahan yang tidak terduga
- Ada perubahan design atau spesifikasi
- Ada kondisi lapangan yang berbeda dari perencanaan

**Contoh:**
- RAB awal hanya ada "Pembersihan lokasi" 1 Ls
- Di lapangan ternyata butuh tambahan "Galian tanah untuk pondasi tambahan" karena ada air tanah
- Kontraktor buat IL (Instruksi Lapangan) untuk pekerjaan tambahan ini
- Setelah approved, IL ini jadi bagian dari pekerjaan yang harus di-opname

---

## Perbedaan RAB Item vs IL Item

### RAB Item (Rencana Anggaran Biaya)
- **Source**: Dari tabel `rab` dan `rab_item`
- **Karakteristik**: 
  - Item yang **sudah direncanakan** dari awal
  - Ada di proposal/kontrak awal
  - Sudah ada harga, volume, spesifikasi dari awal
  - Kolom `IL` di Excel: **NULL** atau kosong

### IL Item (Instruksi Lapangan)
- **Source**: Dari tabel `instruksi_lapangan` dan `instruksi_lapangan_item`
- **Karakteristik**:
  - Item **TAMBAHAN** yang tidak ada di RAB awal
  - Dibuat kontraktor di lapangan
  - Harus disetujui dulu sebelum dikerjakan
  - Kolom `IL` di Excel: **"ya"**

---

## Bagaimana IL Detection Bekerja?

### 1. Di Excel (OPNAME_v1.xlsx)

File OPNAME_v1.xlsx punya kolom `IL`:
```
| no_ulok        | jenis_pekerjaan              | IL   |
|----------------|------------------------------|------|
| Z001-2510-0001 | Pembersihan lokasi           | NULL |  ← RAB item
| Z001-2510-0001 | Pembuatan bedeng             | NULL |  ← RAB item
| Z001-2512-0123 | Galian tanah tambahan        | ya   |  ← IL item
```

**Statistik dari file:**
- RAB items: 4,098 rows (97.1%)
- IL items: 124 rows (2.9%)

### 2. Di Parser Code

```typescript
// Parse Excel - detect IL
const items: SourceItem[] = latestRows.map((row) => ({
    jenis_pekerjaan: text(row.jenis_pekerjaan),
    is_il: key(row.IL) === "YA",  // ← Deteksi IL vs RAB
    // ... fields lainnya
}));
```

**Logic:**
- `key(row.IL)` → convert ke uppercase & trim whitespace
- `"ya"` → `"YA"` → `is_il = true`
- `null` atau empty → `is_il = false`

### 3. Matching dengan Database

Ketika matching item opname dengan source di database:

```typescript
const chooseSourceMatch = (item: SourceItem, sources: DbSourceItem[]) => {
    // Step 1: Filter by type (RAB vs IL)
    const expectedType = item.is_il ? "IL" : "RAB";  // ← Penting!
    
    const byName = sources.filter((source) =>
        source.source_type === expectedType  // ← Hanya match dengan type yang sama!
        && workKey(source.jenis_pekerjaan) === workKey(item.jenis_pekerjaan)
    );
    
    // Step 2-4: Filter by kategori, harga, volume...
};
```

**Kenapa penting?**
- Item opname dengan `IL = "ya"` **HANYA** akan di-match dengan items dari tabel `instruksi_lapangan_item`
- Item opname dengan `IL = null` **HANYA** akan di-match dengan items dari tabel `rab_item`
- Ini mencegah salah match antara RAB item vs IL item

### 4. Query Database Sources

Parser fetch data dari 2 tabel berbeda:

```typescript
// Query RAB items
rabSourceResult = await pool.query(`
    SELECT ri.id, 'RAB'::text AS source_type,
           ri.kategori_pekerjaan, ri.jenis_pekerjaan, ri.satuan,
           ri.volume, ri.harga_material, ri.harga_upah
    FROM rab_item ri
    JOIN rab r ON ri.id_rab = r.id
    WHERE r.id_toko = ANY($1)
`);

// Query IL items (yang sudah disetujui)
ilSourceResult = await pool.query(`
    SELECT ili.id, 'IL'::text AS source_type,
           ili.kategori_pekerjaan, ili.jenis_pekerjaan, ili.satuan,
           ili.volume, ili.harga_material, ili.harga_upah
    FROM instruksi_lapangan_item ili
    JOIN instruksi_lapangan il ON ili.id_instruksi_lapangan = il.id
    WHERE il.id_toko = ANY($1)
      AND il.status IN ('DISETUJUI', 'APPROVED')  -- ← Hanya IL yang sudah approved
`);

// Gabung semua sources
const sources = [...rabSourceResult.rows, ...ilSourceResult.rows];
```

### 5. Insert ke Database

Saat insert ke `opname_item`, IL items dan RAB items masuk ke **kolom berbeda**:

```typescript
INSERT INTO opname_item (
    id_toko, 
    id_opname_final, 
    id_rab_item,                    -- ← NULL untuk IL items
    id_instruksi_lapangan_item,     -- ← NULL untuk RAB items
    status, 
    volume_akhir, 
    ...
)

// Untuk RAB item:
values.push(
    toko_id,
    opname_final_id,
    item.source_id,  // ← id_rab_item = 123
    null,            // ← id_instruksi_lapangan_item = NULL
    ...
);

// Untuk IL item:
values.push(
    toko_id,
    opname_final_id,
    null,            // ← id_rab_item = NULL
    item.source_id,  // ← id_instruksi_lapangan_item = 456
    ...
);
```

---

## Contoh Kasus Real

### Scenario: ULOK Z001-2512-0123

**RAB Awal (dari tabel `rab_item`):**
```
1. Pembersihan lokasi - 1 Ls - Rp 1,000,000
2. Galian tanah pondasi - 10 M3 - Rp 5,000,000
3. Pasir urug - 5 M3 - Rp 2,500,000
```

**IL Tambahan (dari tabel `instruksi_lapangan_item`):**
```
4. Pembongkaran batu besar - 1 Ls - Rp 3,000,000 (IL=ya)
   → Ditemukan batu besar di lapangan, tidak ada di RAB
```

**Saat Opname (di Excel OPNAME_v1.xlsx):**
```
Row 1: Pembersihan lokasi | IL=NULL | Vol RAB=1 | Vol Akhir=1 | Status=APPROVED
Row 2: Galian tanah       | IL=NULL | Vol RAB=10 | Vol Akhir=12 | Status=APPROVED
Row 3: Pasir urug         | IL=NULL | Vol RAB=5 | Vol Akhir=4 | Status=APPROVED
Row 4: Pembongkaran batu  | IL=ya   | Vol RAB=1 | Vol Akhir=1 | Status=APPROVED
```

**Parser akan:**

1. **Row 1-3** (IL=NULL):
   - Match dengan `rab_item` (source_type = "RAB")
   - Insert dengan `id_rab_item = [id dari rab_item]`
   - `id_instruksi_lapangan_item = NULL`

2. **Row 4** (IL=ya):
   - Match dengan `instruksi_lapangan_item` (source_type = "IL")
   - Insert dengan `id_instruksi_lapangan_item = [id dari IL]`
   - `id_rab_item = NULL`

**Result di database `opname_item`:**
```
| id | id_rab_item | id_instruksi_lapangan_item | jenis_pekerjaan      |
|----|-------------|----------------------------|----------------------|
| 1  | 101         | NULL                       | Pembersihan lokasi   |
| 2  | 102         | NULL                       | Galian tanah         |
| 3  | 103         | NULL                       | Pasir urug           |
| 4  | NULL        | 201                        | Pembongkaran batu    |
```

---

## Kenapa Ini Penting?

### 1. **Traceability**
- Kita bisa track item opname ini asalnya dari RAB atau IL
- Untuk audit: "Item X ini ada di RAB awal atau tambahan?"

### 2. **Correct Pricing**
- RAB items → harga dari `rab_item`
- IL items → harga dari `instruksi_lapangan_item`
- Harga bisa berbeda untuk item dengan nama sama!

### 3. **Reporting**
- Laporan bisa pisahkan: "Pekerjaan sesuai RAB" vs "Pekerjaan tambahan (IL)"
- Finance bisa track berapa budget tambahan dari IL

### 4. **Prevent Mismatch**
- Tanpa IL detection, bisa salah match:
  ```
  Opname: "Galian tanah tambahan" (seharusnya IL)
  Salah match dengan: rab_item "Galian tanah" (RAB)
  → Harga & volume tidak tepat!
  ```

### 5. **PDF Generation**
- PDF opname bisa highlight IL items dengan warna/label berbeda
- User bisa lihat mana yang pekerjaan normal vs tambahan

---

## Error Handling

### Jika IL Item Tidak Ditemukan di Database

```typescript
if (!match) {
    return {
        ...item,
        match_issue: `Item IL tidak ditemukan`
    };
}
```

**Kemungkinan penyebab:**
- IL belum di-approve (status bukan "DISETUJUI")
- IL sudah dihapus dari database
- IL di-submit untuk toko/ULOK yang salah

### Jika RAB Item Tidak Ditemukan

```typescript
if (!match) {
    return {
        ...item,
        match_issue: `Item RAB tidak ditemukan`
    };
}
```

**Kemungkinan penyebab:**
- RAB belum dibuat untuk toko ini
- Nama item di Excel tidak match dengan DB (typo)
- Item sudah dihapus dari RAB

---

## Summary

| Aspect           | RAB Item                  | IL Item                          |
|------------------|---------------------------|----------------------------------|
| **Excel Column** | `IL = NULL` atau kosong   | `IL = "ya"`                      |
| **Parser Flag**  | `is_il = false`           | `is_il = true`                   |
| **Match dengan** | `rab_item` table          | `instruksi_lapangan_item` table  |
| **DB Column**    | `id_rab_item = [id]`      | `id_instruksi_lapangan_item = [id]` |
| **Source**       | Perencanaan awal          | Pekerjaan tambahan lapangan      |
| **Count (Excel)**| 4,098 rows (97.1%)        | 124 rows (2.9%)                  |

---

## Kesimpulan

**IL Detection** memastikan:
1. ✅ Item opname di-match dengan sumber data yang benar (RAB vs IL)
2. ✅ Harga dan volume diambil dari tabel yang tepat
3. ✅ Traceability untuk audit dan reporting
4. ✅ Prevent data mismatch antara RAB dan IL items
5. ✅ Proper foreign key relationships di database

**Tanpa IL detection**, semua item akan dianggap sebagai RAB items dan bisa terjadi:
- ❌ Salah match dengan item RAB yang berbeda
- ❌ Harga tidak akurat
- ❌ Kehilangan info bahwa item ini adalah pekerjaan tambahan
- ❌ Foreign key constraint error (insert id_rab_item padahal seharusnya id_instruksi_lapangan_item)

---

**Documented by**: Kiro AI  
**Date**: 2026-06-25
