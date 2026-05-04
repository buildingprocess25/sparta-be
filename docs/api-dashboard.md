# Dokumentasi API Dashboard - sparta-api

Base URL: /api/dashboard

---

## Daftar Endpoint

| #   | Method | Path           | Deskripsi                            |
| --- | ------ | -------------- | ------------------------------------ |
| 1   | GET    | /api/dashboard | Dashboard view (toko + semua relasi) |

---

## 1. Dashboard View

GET /api/dashboard

Mengambil satu data toko berdasarkan pencarian dan seluruh relasi turunannya
(rab + items, gantt + child tables, spk + logs, instruksi lapangan, opname, dll).

### Query Parameters

| Parameter | Tipe   | Wajib | Deskripsi                                                                    |
| --------- | ------ | ----- | ---------------------------------------------------------------------------- |
| search    | string | Ya\*  | Pencarian pada kolom toko: nomor_ulok, nama_toko, kode_toko, cabang, atau id |
| id        | number | Ya\*  | ID toko (jika dikirim, akan diutamakan dari search)                          |

> **Catatan:** Wajib mengirim `search` atau `id`.

### Contoh Request

GET /api/dashboard?search=alfamart
GET /api/dashboard?search=7AZ1-0001
GET /api/dashboard?id=10

### Response - 200 OK

```json
{
  "status": "success",
  "data": {
    "toko": {
      "id": 10,
      "nomor_ulok": "7AZ1-0001-0001",
      "lingkup_pekerjaan": "SIPIL",
      "nama_toko": "ALFAMART SUDIRMAN",
      "kode_toko": "ALF001",
      "proyek": "RENOVASI",
      "cabang": "BANDUNG",
      "alamat": "Jl. Sudirman No 1",
      "nama_kontraktor": "PT Kontraktor ABC"
    },
    "rab": [
      {
        "id": 101,
        "id_toko": 10,
        "status": "Menunggu Persetujuan Koordinator",
        "created_at": "2026-05-01 08:00:00",
        "items": [
          {
            "id": 9001,
            "id_rab": 101,
            "kategori_pekerjaan": "PEKERJAAN PERSIAPAN",
            "jenis_pekerjaan": "Pembersihan Lokasi",
            "satuan": "m2",
            "volume": "100",
            "harga_material": "50000",
            "harga_upah": "30000",
            "total_material": "5000000",
            "total_upah": "3000000",
            "total_harga": "8000000",
            "catatan": "Akses area dibatasi"
          }
        ]
      }
    ],
    "gantt": [
      {
        "id": 200,
        "id_toko": 10,
        "status": "active",
        "timestamp": "2026-05-01",
        "kategori_pekerjaan": [
          {
            "id": 1,
            "id_gantt": 200,
            "kategori_pekerjaan": "PEKERJAAN PERSIAPAN"
          }
        ],
        "day_items": [],
        "pengawasan_gantt": [],
        "pengawasan": [],
        "dependencies": [],
        "berkas_pengawasan": []
      }
    ],
    "spk": [
      {
        "id": 300,
        "id_toko": 10,
        "status": "APPROVED",
        "approval_logs": [],
        "pertambahan_spk": []
      }
    ],
    "pic_pengawasan": {
      "id": 12,
      "id_toko": 10,
      "nomor_ulok": "7AZ1-0001-0001",
      "id_rab": 101,
      "id_spk": 300,
      "kategori_lokasi": "URBAN",
      "durasi": "30",
      "tanggal_mulai_spk": "2026-05-01",
      "plc_building_support": "BAGIAN SIPIL",
      "created_at": "2026-05-02 10:00:00"
    },
    "instruksi_lapangan": [
      {
        "id": 400,
        "id_toko": 10,
        "status": "Menunggu Persetujuan Koordinator",
        "items": []
      }
    ],
    "opname_final": [
      {
        "id": 500,
        "id_toko": 10,
        "status_opname_final": "Menunggu Persetujuan Koordinator",
        "items": []
      }
    ],
    "berkas_serah_terima": [
      {
        "id": 600,
        "id_toko": 10,
        "link_pdf": "https://drive.google.com/..."
      }
    ]
  }
}
```

### Error Responses

| Code | Kondisi                   |
| ---- | ------------------------- |
| 404  | Data toko tidak ditemukan |
| 422  | Validasi request gagal    |
