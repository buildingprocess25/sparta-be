# Dokumentasi API Auth - sparta-api

Base URL: /api/auth

---

## Daftar Endpoint

| #   | Method | Path                 | Deskripsi                        |
| --- | ------ | -------------------- | -------------------------------- |
| 1   | POST   | /api/auth/login      | Login user cabang + trigger OTP  |
| 2   | POST   | /api/auth/verify-otp | Verifikasi OTP login Head Office |

---

## 1. Login User Cabang

POST /api/auth/login

Login user cabang menggunakan email SAT dan cabang (sebagai password). Jika cabang adalah Head Office, server akan mengirim OTP via email.

### Request Body

```json
{
  "email_sat": "user.ho@alfamart.co.id",
  "cabang": "HEAD OFFICE"
}
```

### Response - 200 OK (Login berhasil tanpa OTP)

```json
{
  "status": "success",
  "data": {
    "cabang": "BATAM",
    "nama_lengkap": "Andi Saputra",
    "jabatan": "BRANCH BUILDING COORDINATOR",
    "email_sat": "user.cabang@alfamart.co.id",
    "nama_pt": "PT Sumber Alfaria Trijaya Tbk",
    "alamat_cabang": "Jl. Sudirman No 1"
  }
}
```

### Response - 200 OK (OTP dikirim - hanya Head Office)

```json
{
  "status": "success",
  "data": {
    "requires_otp": true,
    "otp_token": "59c6ad5b-1d4e-4b8d-93fd-e0a4a8ec4d2d",
    "otp_expires_at": "2026-05-18T06:15:00.000Z",
    "email_sat": "user.ho@alfamart.co.id",
    "cabang": "HEAD OFFICE"
  }
}
```

### Error Responses

| Code | Kondisi                    |
| ---- | -------------------------- |
| 401  | Password salah             |
| 404  | Email belum terdaftar      |
| 422  | Validasi request gagal     |
| 500  | Gmail belum terkonfigurasi |

---

## 2. Verifikasi OTP Login

POST /api/auth/verify-otp

Verifikasi OTP yang dikirim pada login Head Office. Jika valid, akan mengembalikan data user sama seperti login biasa.

### Request Body

```json
{
  "email_sat": "user.ho@alfamart.co.id",
  "cabang": "HEAD OFFICE",
  "otp_token": "59c6ad5b-1d4e-4b8d-93fd-e0a4a8ec4d2d",
  "otp_code": "123456"
}
```

### Response - 200 OK

```json
{
  "status": "success",
  "data": {
    "cabang": "HEAD OFFICE",
    "nama_lengkap": "Budi Santoso",
    "jabatan": "BRANCH MANAGER",
    "email_sat": "user.ho@alfamart.co.id",
    "nama_pt": "PT Sumber Alfaria Trijaya Tbk",
    "alamat_cabang": "Jl. Jendral Sudirman No 10"
  }
}
```

### Error Responses

| Code | Kondisi                                |
| ---- | -------------------------------------- |
| 400  | OTP tidak diperlukan (bukan HO)        |
| 401  | OTP salah / kadaluarsa / sudah dipakai |
| 404  | Email belum terdaftar                  |
| 422  | Validasi request gagal                 |
| 500  | Gmail belum terkonfigurasi             |

---

## Environment yang Dibutuhkan

| Env Var    | Deskripsi                                 |
| ---------- | ----------------------------------------- |
| EMAIL_USER | Email pengirim (harus sesuai OAuth Gmail) |

Catatan: OAuth Gmail tetap mengikuti konfigurasi token pada aplikasi (lihat GOOGLE_TOKEN_PATH).
