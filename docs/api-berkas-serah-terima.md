# Dokumentasi API Berkas Serah Terima — sparta-api

Base URL: `/api`

---

## Daftar Endpoint

| #   | Method | Path                           | Deskripsi                                      |
| --- | ------ | ------------------------------ | ---------------------------------------------- |
| 1   | `POST` | `/api/create_pdf_serah_terima` | Generate PDF serah terima dan simpan ke Drive  |
| 2   | `GET`  | `/api/berkas_serah_terima`     | List semua berkas serah terima (+ filter toko) |

---

## Struktur Tabel `berkas_serah_terima`

- `id` (PK, SERIAL)
- `id_toko` (FK -> `toko.id`, NOT NULL)
- `link_pdf` (VARCHAR(500)) — link Google Drive PDF yang dihasilkan
- `created_at` (TIMESTAMP, default waktu Jakarta)

---

## 1. Create PDF Serah Terima

**`POST /api/create_pdf_serah_terima`**

### Alur Proses

1. Terima `id_toko` dari request body
2. Cari data `toko` berdasarkan `id_toko`
3. Cari data `opname_final` terbaru berdasarkan `id_toko`
4. Cari semua `opname_item` berdasarkan `id` opname_final (join `rab_item`)
5. Generate PDF "Berita Acara Serah Terima" dari data tersebut
6. Upload PDF ke Google Drive
7. Simpan/update link PDF di tabel `berkas_serah_terima`
8. Kembalikan response dengan link PDF

### Request Body

```json
{
  "id_toko": 56
}
```

| Field     | Tipe     | Wajib | Deskripsi             |
| --------- | -------- | ----- | --------------------- |
| `id_toko` | `number` | ✅    | ID toko (integer > 0) |

### Response — 200 OK

```json
{
  "status": "success",
  "message": "Berkas serah terima berhasil dibuat dan diupload",
  "data": {
    "id": 1,
    "id_toko": 56,
    "link_pdf": "https://drive.google.com/file/d/xxxx/view",
    "opname_final_id": 5,
    "item_count": 12,
    "created_at": "2026-04-27T10:00:00.000Z",
    "toko": {
      "id": 56,
      "nomor_ulok": "KZ01-2603-5050",
      "lingkup_pekerjaan": "SIPIL",
      "nama_toko": "Phase1",
      "kode_toko": "T-001",
      "proyek": "Reguler",
      "cabang": "CIKOKOL",
      "alamat": "Here.",
      "nama_kontraktor": "Kontraktor A"
    }
  }
}
```

### Response Fields

| Field             | Tipe     | Deskripsi                                     |
| ----------------- | -------- | --------------------------------------------- |
| `id`              | `number` | ID record berkas_serah_terima                 |
| `id_toko`         | `number` | ID toko yang diminta                          |
| `link_pdf`        | `string` | Link Google Drive PDF yang dihasilkan         |
| `opname_final_id` | `number` | ID opname_final yang digunakan sebagai sumber |
| `item_count`      | `number` | Jumlah item opname yang masuk ke PDF          |
| `created_at`      | `string` | Timestamp pembuatan record                    |
| `toko`            | `object` | Informasi toko terkait                        |

---

## Konten PDF

PDF yang dihasilkan berisi:

1. **Header**: Judul "Berita Acara Serah Terima"
2. **Informasi Toko**: Nomor ULOK, nama toko, kode toko, proyek, cabang, alamat, kontraktor, lingkup pekerjaan
3. **Status Opname Final**: Status approval dan email pembuat
4. **Tabel Pekerjaan**: Seluruh item opname dengan detail:
   - Kategori pekerjaan
   - Jenis pekerjaan
   - Satuan
   - Volume RAB vs Volume Akhir
   - Selisih volume
   - Total RAB vs Total Opname
   - Status item
5. **Ringkasan**: Grand total RAB, grand total opname, dan selisih total
6. **Kolom Tanda Tangan**: Pihak pertama (pemilik) dan pihak kedua (kontraktor)

---

## 2. List Berkas Serah Terima

**`GET /api/berkas_serah_terima`**

### Query Parameters (opsional)

| Parameter | Tipe     | Deskripsi               |
| --------- | -------- | ----------------------- |
| `id_toko` | `number` | Filter berdasarkan toko |

### Response — 200 OK

```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "id_toko": 56,
      "link_pdf": "https://drive.google.com/file/d/xxxx/view",
      "created_at": "2026-04-27T10:00:00.000Z",
      "toko": {
        "id": 56,
        "nomor_ulok": "KZ01-2603-5050",
        "lingkup_pekerjaan": "SIPIL",
        "nama_toko": "Phase1",
        "kode_toko": "T-001",
        "proyek": "Reguler",
        "cabang": "CIKOKOL",
        "alamat": "Here.",
        "nama_kontraktor": "Kontraktor A"
      }
    }
  ]
}
```

## Perilaku Upsert

- Jika belum ada record `berkas_serah_terima` untuk `id_toko` yang diberikan, akan dibuat record baru.
- Jika sudah ada, `link_pdf` akan diupdate dengan link PDF terbaru (replace).

---

## Error Responses

| Code | Kondisi                                                    |
| ---- | ---------------------------------------------------------- |
| 404  | Data toko tidak ditemukan                                  |
| 404  | Data opname_final tidak ditemukan untuk toko yang dimaksud |
| 422  | Validasi request body gagal (id_toko tidak valid)          |
| 500  | Google Drive belum terkonfigurasi                          |
