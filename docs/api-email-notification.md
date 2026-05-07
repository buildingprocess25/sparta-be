# Dokumentasi API Email Notification - sparta-api

Base URL: /api

---

## 1. Send Email Notification

POST /api/send-email-notification

Mengirim email notifikasi ke Branch Manager berdasarkan cabang dan flag template.

### Request Body

```json
{
  "cabang": "BATAM",
  "flag": "send-notification-spk"
}
```

### Validasi

| Field  | Aturan              |
| ------ | ------------------- |
| cabang | wajib, string min 1 |
| flag   | wajib, string min 1 |

### Response - 200 OK

```json
{
  "status": "success",
  "message": "Email notifikasi berhasil dikirim",
  "data": {
    "message_id": "18c7a8f0d2",
    "cabang": "BATAM",
    "flag": "send-notification-spk",
    "to": "manager.batam@alfamart.co.id",
    "subject": "Notifikasi SPK"
  }
}
```

### Error Responses

| Code | Kondisi                                              |
| ---- | ---------------------------------------------------- |
| 400  | Template email untuk flag tidak ditemukan            |
| 404  | Branch Manager untuk cabang tersebut tidak ditemukan |
| 422  | Validasi request gagal                               |
| 500  | Gmail belum terkonfigurasi / EMAIL_USER belum diset  |

---

## Environment yang Dibutuhkan

| Env Var    | Deskripsi                                 |
| ---------- | ----------------------------------------- |
| EMAIL_USER | Email pengirim (harus sesuai OAuth Gmail) |

Catatan: OAuth Gmail tetap mengikuti konfigurasi token pada aplikasi (lihat GOOGLE_TOKEN_PATH).
