# Dokumentasi API PIC Pengawasan — sparta-api

Base URL: `/api/pic_pengawasan`

---

## Daftar Endpoint

| #   | Method | Path                      | Deskripsi                            |
| --- | ------ | ------------------------- | ------------------------------------ |
| 1   | `POST` | `/api/pic_pengawasan`     | Buat data PIC Pengawasan             |
| 2   | `GET`  | `/api/pic_pengawasan`     | List data PIC Pengawasan (+ filter)  |
| 3   | `GET`  | `/api/pic_pengawasan/:id` | Detail PIC Pengawasan berdasarkan ID |

---

## Struktur Tabel `pic_pengawasan`

Relasi 1:1 yang diterapkan:

- `nomor_ulok` -> `toko.nomor_ulok` (UNIQUE + FK)
- `id_rab` -> `rab.id` (UNIQUE + FK)
- `id_spk` -> `pengajuan_spk.id` (UNIQUE + FK)

Artinya satu data di tabel `toko`, `rab`, dan `pengajuan_spk` hanya bisa dipakai satu kali di tabel `pic_pengawasan`.

---

## 1. Create PIC Pengawasan

**`POST /api/pic_pengawasan`**

### Request Body

```json
{
  "nomor_ulok": "7AZ1-0001-0001",
  "id_rab": 12,
  "id_spk": 8,
  "kategori_lokasi": "URBAN",
  "durasi": "30 Hari",
  "tanggal_mulai_spk": "2026-04-01",
  "plc_building_support": "Andi Pratama"
}
```

### Validasi

| Field                  | Aturan              |
| ---------------------- | ------------------- |
| `nomor_ulok`           | wajib, string min 1 |
| `id_rab`               | wajib, integer > 0  |
| `id_spk`               | wajib, integer > 0  |
| `kategori_lokasi`      | wajib, string min 1 |
| `durasi`               | wajib, string min 1 |
| `tanggal_mulai_spk`    | wajib, string min 1 |
| `plc_building_support` | wajib, string min 1 |

### Response — 201 Created

```json
{
  "status": "success",
  "message": "Data pic_pengawasan berhasil disimpan",
  "data": {
    "id": 1,
    "nomor_ulok": "7AZ1-0001-0001",
    "id_rab": 12,
    "id_spk": 8,
    "kategori_lokasi": "URBAN",
    "durasi": "30 Hari",
    "tanggal_mulai_spk": "2026-04-01",
    "plc_building_support": "Andi Pratama",
    "created_at": "2026-04-10T10:00:00.000Z"
  }
}
```

### Error Responses

| Code | Kondisi                                                                               |
| ---- | ------------------------------------------------------------------------------------- |
| 404  | `nomor_ulok` / `id_rab` / `id_spk` tidak ditemukan di tabel referensi                 |
| 409  | Relasi 1:1 sudah terpakai (salah satu `nomor_ulok`, `id_rab`, `id_spk` sudah dipakai) |
| 422  | Validasi Zod gagal                                                                    |

---

## 2. List PIC Pengawasan

**`GET /api/pic_pengawasan`**

Mengambil daftar data PIC Pengawasan.

### Query Parameters (opsional)

| Parameter    | Tipe     | Deskripsi                 |
| ------------ | -------- | ------------------------- |
| `nomor_ulok` | `string` | Filter berdasarkan ULOK   |
| `id_rab`     | `number` | Filter berdasarkan ID RAB |
| `id_spk`     | `number` | Filter berdasarkan ID SPK |

### Response — 200 OK

```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "nomor_ulok": "7AZ1-0001-0001",
      "id_rab": 12,
      "id_spk": 8,
      "kategori_lokasi": "URBAN",
      "durasi": "30 Hari",
      "tanggal_mulai_spk": "2026-04-01",
      "plc_building_support": "Andi Pratama",
      "created_at": "2026-04-10T10:00:00.000Z"
    }
  ]
}
```

---

## 3. Detail PIC Pengawasan

**`GET /api/pic_pengawasan/:id`**

Mengambil detail satu data PIC Pengawasan berdasarkan ID.

### Response — 200 OK

```json
{
  "status": "success",
  "data": {
    "id": 1,
    "nomor_ulok": "7AZ1-0001-0001",
    "id_rab": 12,
    "id_spk": 8,
    "kategori_lokasi": "URBAN",
    "durasi": "30 Hari",
    "tanggal_mulai_spk": "2026-04-01",
    "plc_building_support": "Andi Pratama",
    "created_at": "2026-04-10T10:00:00.000Z"
  }
}
```

### Error Responses

| Code | Kondisi                             |
| ---- | ----------------------------------- |
| 404  | Data pic_pengawasan tidak ditemukan |
