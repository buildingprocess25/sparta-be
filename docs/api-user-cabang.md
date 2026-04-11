# Dokumentasi API User Cabang - sparta-api

Base URL: /api/user_cabang

---

## Daftar Endpoint

| #   | Method | Path                 | Deskripsi                                 |
| --- | ------ | -------------------- | ----------------------------------------- |
| 1   | POST   | /api/user_cabang     | Tambah data user cabang                   |
| 2   | GET    | /api/user_cabang     | List user cabang (dengan filter opsional) |
| 3   | GET    | /api/user_cabang/:id | Detail user cabang berdasarkan ID         |
| 4   | PUT    | /api/user_cabang/:id | Update data user cabang                   |
| 5   | DELETE | /api/user_cabang/:id | Hapus data user cabang                    |

---

## Struktur Tabel user_cabang

Kolom utama yang dipakai endpoint:

- id (serial, primary key)
- cabang (varchar, required)
- nama_lengkap (varchar, nullable)
- jabatan (varchar, nullable)
- email_sat (varchar, required)
- nama_pt (varchar, nullable)

Unique constraint:

- uq_user_cabang_email_cabang: kombinasi email_sat + cabang harus unik

---

## 1. Create User Cabang

POST /api/user_cabang

### Request Body

```json
{
  "cabang": "BATAM",
  "email_sat": "user.cabang@alfamart.co.id",
  "nama_lengkap": "Andi Saputra",
  "jabatan": "BRANCH BUILDING COORDINATOR",
  "nama_pt": "PT Sumber Alfaria Trijaya Tbk"
}
```

### Validasi

| Field        | Aturan                    |
| ------------ | ------------------------- |
| cabang       | wajib, string min 1       |
| email_sat    | wajib, format email valid |
| nama_lengkap | opsional, string min 1    |
| jabatan      | opsional, string min 1    |
| nama_pt      | opsional, string min 1    |

### Response - 201 Created

```json
{
  "status": "success",
  "message": "Data user_cabang berhasil disimpan",
  "data": {
    "id": 1,
    "cabang": "BATAM",
    "nama_lengkap": "Andi Saputra",
    "jabatan": "BRANCH BUILDING COORDINATOR",
    "email_sat": "user.cabang@alfamart.co.id",
    "nama_pt": "PT Sumber Alfaria Trijaya Tbk"
  }
}
```

### Error Responses

| Code | Kondisi                                      |
| ---- | -------------------------------------------- |
| 409  | Kombinasi email_sat + cabang sudah terdaftar |
| 422  | Validasi request gagal                       |

---

## 2. List User Cabang

GET /api/user_cabang

### Query Parameters (opsional)

| Parameter | Tipe   | Deskripsi                                                   |
| --------- | ------ | ----------------------------------------------------------- |
| search    | string | Cari pada cabang, nama_lengkap, jabatan, email_sat, nama_pt |
| cabang    | string | Filter exact match cabang (case-insensitive)                |
| email_sat | string | Filter exact match email_sat (case-insensitive)             |
| jabatan   | string | Filter exact match jabatan (case-insensitive)               |
| nama_pt   | string | Filter exact match nama_pt (case-insensitive)               |

### Contoh Request

GET /api/user_cabang
GET /api/user_cabang?search=andi
GET /api/user_cabang?cabang=BATAM
GET /api/user_cabang?email_sat=user.cabang@alfamart.co.id

### Response - 200 OK

```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "cabang": "BATAM",
      "nama_lengkap": "Andi Saputra",
      "jabatan": "BRANCH BUILDING COORDINATOR",
      "email_sat": "user.cabang@alfamart.co.id",
      "nama_pt": "PT Sumber Alfaria Trijaya Tbk"
    }
  ]
}
```

---

## 3. Detail User Cabang

GET /api/user_cabang/:id

### Path Parameter

| Parameter | Tipe    | Deskripsi      |
| --------- | ------- | -------------- |
| id        | integer | ID user_cabang |

### Response - 200 OK

```json
{
  "status": "success",
  "data": {
    "id": 1,
    "cabang": "BATAM",
    "nama_lengkap": "Andi Saputra",
    "jabatan": "BRANCH BUILDING COORDINATOR",
    "email_sat": "user.cabang@alfamart.co.id",
    "nama_pt": "PT Sumber Alfaria Trijaya Tbk"
  }
}
```

### Error Responses

| Code | Kondisi                          |
| ---- | -------------------------------- |
| 404  | Data user_cabang tidak ditemukan |
| 422  | Validasi parameter gagal         |

---

## 4. Update User Cabang

PUT /api/user_cabang/:id

### Request Body

Semua field opsional, tetapi minimal satu field harus dikirim.

```json
{
  "jabatan": "BRANCH BUILDING & MAINTENANCE MANAGER",
  "nama_pt": "PT Sumber Alfaria Trijaya Tbk"
}
```

### Validasi

| Field        | Aturan                             |
| ------------ | ---------------------------------- |
| cabang       | opsional, string min 1             |
| email_sat    | opsional, format email valid       |
| nama_lengkap | opsional, string min 1, boleh null |
| jabatan      | opsional, string min 1, boleh null |
| nama_pt      | opsional, string min 1, boleh null |

### Response - 200 OK

```json
{
  "status": "success",
  "message": "Data user_cabang berhasil diperbarui",
  "data": {
    "id": 1,
    "cabang": "BATAM",
    "nama_lengkap": "Andi Saputra",
    "jabatan": "BRANCH BUILDING & MAINTENANCE MANAGER",
    "email_sat": "user.cabang@alfamart.co.id",
    "nama_pt": "PT Sumber Alfaria Trijaya Tbk"
  }
}
```

### Error Responses

| Code | Kondisi                                               |
| ---- | ----------------------------------------------------- |
| 404  | Data user_cabang tidak ditemukan                      |
| 409  | Kombinasi email_sat + cabang bentrok dengan data lain |
| 422  | Validasi request gagal                                |

---

## 5. Delete User Cabang

DELETE /api/user_cabang/:id

### Response - 200 OK

```json
{
  "status": "success",
  "message": "Data user_cabang berhasil dihapus",
  "data": {
    "id": 1,
    "cabang": "BATAM",
    "nama_lengkap": "Andi Saputra",
    "jabatan": "BRANCH BUILDING & MAINTENANCE MANAGER",
    "email_sat": "user.cabang@alfamart.co.id",
    "nama_pt": "PT Sumber Alfaria Trijaya Tbk"
  }
}
```

### Error Responses

| Code | Kondisi                          |
| ---- | -------------------------------- |
| 404  | Data user_cabang tidak ditemukan |
| 422  | Validasi parameter gagal         |
