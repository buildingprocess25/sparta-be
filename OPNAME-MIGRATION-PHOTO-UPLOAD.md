# Opname Migration - Photo Re-upload to Google Drive

## 🎯 Feature

Saat migrasi opname dari OPNAME_v1.xlsx, foto item opname yang aslinya di-host di **Cloudinary** akan otomatis:
1. ✅ **Di-download** dari URL Cloudinary
2. ✅ **Di-upload** ke Google Drive (folder `opname-migration/{ULOK}`)
3. ✅ **File ID Drive** disimpan ke database
4. ✅ **Foto muncul di PDF** opname tanpa masalah authentication

---

## 📋 Kolom yang Di-Import

Dari Excel `OPNAME_v1.xlsx` sheet `opname_final`:

### **Kolom Foto:**
| Excel Column | Database Column | Type | Keterangan |
|---|---|---|---|
| `foto_url` | `foto` | VARCHAR(500) | URL Cloudinary → Di-convert jadi Drive file ID |

### **Kolom Kualitas/Desain/Spesifikasi:**
| Excel Column | Database Column | Type | Keterangan |
|---|---|---|---|
| `desain` | `desain` | VARCHAR(255) | Text, disimpan as-is |
| `kualitas` | `kualitas` | VARCHAR(255) | Text, disimpan as-is |
| `spesifikasi` | `spesifikasi` | VARCHAR(255) | Text, disimpan as-is |
| `catatan` | `catatan` | VARCHAR(500) | Text, disimpan as-is |

---

## 🔄 Flow Migrasi Foto

```
┌─────────────────────────────────────────────┐
│ Excel: foto_url                             │
│ https://res.cloudinary.com/.../image.jpg    │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│ 1. Download from Cloudinary                 │
│    - Fetch URL dengan timeout               │
│    - Validate Content-Type (image/*)        │
│    - Return buffer                          │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│ 2. Upload to Google Drive                   │
│    - Folder: opname-migration/{ULOK}        │
│    - Filename: {jenis-pekerjaan}-{index}.jpg│
│    - MIME: image/jpeg                       │
│    - Return file ID                         │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│ 3. Save to Database                         │
│    opname_item.foto = Drive file ID         │
│    (bukan URL lagi!)                        │
└─────────────────────────────────────────────┘
```

---

## ⚙️ Implementation Details

### **1. Download Function**

```typescript
const downloadImageFromUrl = async (url: string): Promise<Buffer | null> => {
    // Validate URL
    if (!url || !url.startsWith("http")) return null;
    
    // Fetch with proper headers
    const response = await fetch(url, {
        method: "GET",
        headers: { "User-Agent": "SPARTA-Migration/1.0" }
    });
    
    // Validate response
    if (!response.ok) return null;
    if (!response.headers.get("content-type")?.startsWith("image/")) return null;
    
    // Return buffer
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
```

### **2. Upload Function**

```typescript
const uploadImageToDrive = async (
    googleProvider: GoogleProvider,
    buffer: Buffer,
    nomorUlok: string,
    itemIndex: number,
    jenisPekerjaan: string
): Promise<string | null> => {
    // Sanitize filename (remove special chars)
    const sanitizedJenis = jenisPekerjaan
        .replace(/[^a-zA-Z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .substring(0, 50);
    
    // Upload to Drive
    const fileId = await googleProvider.uploadFile(
        `opname-migration/${nomorUlok}`,      // Folder
        `${sanitizedJenis}-${itemIndex}.jpg`, // Filename
        "image/jpeg",                          // MIME type
        buffer                                 // Image buffer
    );
    
    return fileId;
}
```

### **3. Insert Items with Photo Processing**

```typescript
const insertItems = async (
    client: PoolClient,
    candidate: Candidate,
    opnameFinalId: number,
    googleProvider: GoogleProvider
) => {
    // Process each item's photo
    const processedItems = await Promise.all(
        candidate.items.map(async (item, index) => {
            if (!item.foto) return item;
            
            // Skip if already Drive ID
            if (item.foto.length < 100 && !item.foto.startsWith("http")) {
                return item;
            }
            
            // Download from URL
            const imageBuffer = await downloadImageFromUrl(item.foto);
            if (!imageBuffer) return { ...item, foto: null };
            
            // Upload to Drive
            const driveFileId = await uploadImageToDrive(
                googleProvider, buffer, nomorUlok, index + 1, item.jenis_pekerjaan
            );
            if (!driveFileId) return { ...item, foto: null };
            
            return { ...item, foto: driveFileId };
        })
    );
    
    // Insert to DB with Drive file IDs
    await client.query(`INSERT INTO opname_item (...) VALUES (...)`);
}
```

---

## 📊 Performance

### **Timing Estimates:**

| Operation | Time (per foto) | Notes |
|---|---|---|
| Download from Cloudinary | ~1-2 seconds | Depends on image size & network |
| Upload to Drive | ~1-3 seconds | Depends on image size |
| **Total per foto** | **~2-5 seconds** | Average |

### **Example Scenarios:**

| Total Foto | Estimated Time | Notes |
|---|---|---|
| 10 foto | ~30-50 seconds | Fast |
| 50 foto | ~3-4 minutes | Acceptable |
| 100 foto | ~5-8 minutes | Needs patience |
| 500 foto | ~25-40 minutes | Long (but runs in background) |

---

## 🛡️ Error Handling

### **Download Failures:**
- ❌ URL tidak valid → `foto = NULL`
- ❌ HTTP error (404, 403, 500) → `foto = NULL`
- ❌ Content-Type bukan image → `foto = NULL`
- ✅ **Migration tetap jalan**, item disimpan tanpa foto

### **Upload Failures:**
- ❌ Drive API error → `foto = NULL`
- ❌ Network timeout → `foto = NULL`
- ❌ Quota exceeded → `foto = NULL`
- ✅ **Migration tetap jalan**, item disimpan tanpa foto

### **Transaction Safety:**
- ✅ Semua insert items dalam **single transaction**
- ✅ Jika ada error fatal → **rollback all**
- ✅ Jika hanya foto gagal → **insert tetap jalan** (foto = NULL)

---

## 📝 Logging

### **Console Logs:**

```
[MIGRATION] Starting opname final migration with photo re-upload...
[MIGRATION] Will process 5 opname with 23 photos to re-upload
[MIGRATION] Processing 1/5: Z001-2601-0001...
[MIGRATION] Processing 15 items for Z001-2601-0001...
[MIGRATION] Item 1: Re-uploading foto to Drive...
[MIGRATION] Downloading image from: https://res.cloudinary.com/...
[MIGRATION] Downloaded 245678 bytes
[MIGRATION] Uploading to Drive: opname-migration/Z001-2601-0001/plafon-gypsum-1.jpg
[MIGRATION] Uploaded successfully, file ID: 1a2B3c4D5e6F...
[MIGRATION] Item 1: Foto migrated successfully
...
[MIGRATION] Inserted 15 items (12 with foto) for Z001-2601-0001
[MIGRATION] Migration completed. Queueing 3 PDF generations...
```

---

## 🎨 Frontend Changes

### **Stats Display:**

```
┌────────────────┬────────────────┬────────────────┐
│ Total Kandidat │ Opname Parsial │ Final / KTK    │
│      25        │       12       │      13        │
├────────────────┼────────────────┼────────────────┤
│ Total Item     │ Item Terpetakan│ Foto (Migrasi) │
│     450        │      445       │      87        │
└────────────────┴────────────────┴────────────────┘
```

### **Info Box:**

```
📸 Foto akan di-migrasi ke Google Drive
87 foto dari Cloudinary akan di-download dan di-upload ulang ke 
Google Drive agar bisa muncul di PDF. Proses ini akan memakan 
waktu ~2-5 detik per foto. Estimasi: 5 menit.
```

---

## ✅ Testing Checklist

- [ ] Upload OPNAME_v1.xlsx dengan foto Cloudinary
- [ ] Preview menampilkan jumlah foto yang akan di-migrasi
- [ ] Proses migrasi berhasil download + upload foto
- [ ] Database menyimpan Drive file ID (bukan URL Cloudinary)
- [ ] PDF opname menampilkan foto dengan benar
- [ ] Error handling: foto gagal download → item tetap tersimpan
- [ ] Performance: 100 foto selesai dalam ~10 menit
- [ ] Logging jelas di console untuk tracking progress

---

## 🚀 Deployment Notes

1. ✅ **Google Drive credentials** harus valid
2. ✅ **Drive folder permissions** harus "anyone with link can view"
3. ✅ **Network firewall** harus allow outbound ke Cloudinary
4. ✅ **Timeout settings** harus cukup besar untuk banyak foto
5. ✅ **Memory** cukup untuk buffer gambar (512MB recommended)

---

## 📌 Future Improvements

1. **Batch upload** - Upload multiple foto parallel (max 5 concurrent)
2. **Progress bar** - Real-time progress indicator di UI
3. **Retry logic** - Auto-retry failed downloads (max 3 attempts)
4. **Caching** - Cache downloaded foto untuk avoid duplicate download
5. **Background job** - Offload foto migration ke background worker

---

## 🔧 Maintenance

### **Monitor Drive Storage:**
```bash
# Check Drive usage
gcloud storage du gs://your-bucket/opname-migration/

# Cleanup old migrations (if needed)
gsutil -m rm -r gs://your-bucket/opname-migration/old-folder/
```

### **Debug Failed Photos:**
```sql
-- Find opname items without foto
SELECT 
    of.id,
    t.nomor_ulok,
    oi.jenis_pekerjaan,
    oi.foto
FROM opname_item oi
JOIN opname_final of ON oi.id_opname_final = of.id
JOIN toko t ON oi.id_toko = t.id
WHERE of.email_pembuat LIKE '%migration%'
  AND oi.foto IS NULL
ORDER BY of.id DESC;
```
