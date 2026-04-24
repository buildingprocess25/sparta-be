# Dokumentasi API Toko - sparta-api

Base URL: /api/toko

---

## Daftar Endpoint

| #   | Method | Path                 | Deskripsi                             |
| --- | ------ | -------------------- | ------------------------------------- |
| 1   | POST   | /api/toko            | Tambah atau update data toko          |
| 2   | GET    | /api/toko            | List toko (bisa filter search/cabang) |
| 3   | GET    | /api/toko/:nomorUlok | Detail toko berdasarkan nomor ULOK    |
| 4   | GET    | /api/toko/detail     | Detail toko berdasarkan query opsional (id, nomor_ulok, lingkup) |

---

## 1. Tambah atau Update Toko

POST /api/toko

Menyimpan data toko baru atau update jika nomor ULOK sudah ada.

### Request Body

```json
{
  "nomor_ulok": "7AZ1-0001-0001",
  "nama_toko": "Alfamart Jl Sudirman",
  "kode_toko": "ALF001",
  "cabang": "BANDUNG",
  "alamat": "Jl. Sudirman No 1"
}
```

### Validasi

| Field      | Aturan                           |
| ---------- | -------------------------------- |
| nomor_ulok | Wajib, string minimal 1 karakter |
| nama_toko  | Wajib, string minimal 1 karakter |
| kode_toko  | Wajib, string minimal 1 karakter |
| cabang     | Wajib, string minimal 1 karakter |
| alamat     | Wajib, string minimal 1 karakter |

### Response - 201 Created

```json
{
  "status": "success",
  "data": {
    "id": 10,
    "nomor_ulok": "7AZ1-0001-0001",
    "lingkup_pekerjaan": null,
    "nama_toko": "Alfamart Jl Sudirman",
    "kode_toko": "ALF001",
    "proyek": null,
    "cabang": "BANDUNG",
    "alamat": "Jl. Sudirman No 1",
    "nama_kontraktor": null
  }
}
```

---

## 2. List Toko

GET /api/toko

Mengambil daftar toko. Endpoint ini mendukung filter opsional berdasarkan search, cabang, atau kombinasi keduanya.

### Query Parameters

| Parameter | Tipe   | Wajib | Deskripsi                                                             |
| --------- | ------ | ----- | --------------------------------------------------------------------- |
| search    | string | Tidak | Pencarian pada nomor_ulok, nama_toko, kode_toko, atau cabang (ILIKE). |
| cabang    | string | Tidak | Filter exact match cabang (case-insensitive).                         |

### Contoh Request

GET /api/toko
GET /api/toko?cabang=BANDUNG
GET /api/toko?search=alf
GET /api/toko?search=alf&cabang=BANDUNG

### Response - 200 OK

```json
{
  "status": "success",
  "data": [
    {
      "id": 10,
      "nomor_ulok": "7AZ1-0001-0001",
      "lingkup_pekerjaan": "SIPIL",
      "nama_toko": "ALFAMART SUDIRMAN",
      "kode_toko": "ALF001",
      "proyek": "RENOVASI",
      "cabang": "BANDUNG",
      "alamat": "Jl. Sudirman No 1",
      "nama_kontraktor": "PT Kontraktor ABC"
    }
  ]
}
```

---

## 3. Detail Toko

GET /api/toko/:nomorUlok

Mengambil detail satu toko berdasarkan nomor ULOK.

### Path Parameter

| Parameter | Tipe   | Deskripsi       |
| --------- | ------ | --------------- |
| nomorUlok | string | Nomor ULOK toko |

### Response - 200 OK

```json
{
  "status": "success",
  "data": {
    "id": 10,
    "nomor_ulok": "7AZ1-0001-0001",
    "lingkup_pekerjaan": "SIPIL",
    "nama_toko": "ALFAMART SUDIRMAN",
    "kode_toko": "ALF001",
    "proyek": "RENOVASI",
    "cabang": "BANDUNG",
    "alamat": "Jl. Sudirman No 1",
    "nama_kontraktor": "PT Kontraktor ABC"
  }
}
```

### Error Responses

| Code | Kondisi                   |
| ---- | ------------------------- |
| 404  | Data toko tidak ditemukan |
| 422  | Validasi request gagal    |

---

## 4. Detail Toko (Query Params)

GET /api/toko/detail

Mengambil detail satu toko menggunakan query parameters. Endpoint ini berguna jika ingin mengambil detail tidak hanya berdasarkan `nomor_ulok` tetapi juga `id` maupun spesifik `lingkup_pekerjaan`.

### Query Parameters

| Parameter  | Tipe   | Wajib                  | Deskripsi                         |
| ---------- | ------ | ---------------------- | --------------------------------- |
| id         | number | Ya (jika nomor_ulok kosong) | ID dari record toko di database   |
| nomor_ulok | string | Ya (jika id kosong)         | Nomor ULOK toko                   |
| lingkup    | string | Tidak                  | Filter tambahan lingkup pekerjaan |

> **Catatan:** Wajib mengirimkan salah satu antara `id` atau `nomor_ulok`. Parameter `lingkup` dapat dikirimkan bersama `id` atau `nomor_ulok`.

### Contoh Request

GET /api/toko/detail?id=10
GET /api/toko/detail?nomor_ulok=7AZ1-0001-0001&lingkup=SIPIL
GET /api/toko/detail?id=10&lingkup=ME

### Response - 200 OK

```json
{
  "status": "success",
  "data": {
    "id": 10,
    "nomor_ulok": "7AZ1-0001-0001",
    "lingkup_pekerjaan": "SIPIL",
    "nama_toko": "ALFAMART SUDIRMAN",
    "kode_toko": "ALF001",
    "proyek": "RENOVASI",
    "cabang": "BANDUNG",
    "alamat": "Jl. Sudirman No 1",
    "nama_kontraktor": "PT Kontraktor ABC"
  }
}
```

### Error Responses

| Code | Kondisi                                                 |
| ---- | ------------------------------------------------------- |
| 400  | Validasi request gagal (misal: id/nomor_ulok tidak ada) |
| 404  | Data toko tidak ditemukan                               |
