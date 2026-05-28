# Dokumentasi API Email Notification - sparta-api

Terakhir diperbarui: 2026-05-28

Base URL: /api

---

## 1. Send Email Notification

POST /api/send-email-notification

Mengirim email notifikasi berdasarkan cabang dan flag template.

### Request Body

```json
{
  "cabang": "BATAM",
  "flag": "send-notification-spk",
  "id_toko": 123
}
```

Flag yang tersedia:

- `send-notification-spk` -> target: Branch Manager (cc: Branch Building & Maintenance Manager)
- `send-notification-pertambahan-spk` -> target: Branch Manager (cc: Branch Building & Maintenance Manager)
- `notification-spk-has-approve` -> target: semua user KONTRAKTOR pada cabang terkait
- `notification-spk-has-reject` -> target: semua user KONTRAKTOR pada cabang terkait

Catatan untuk `send-notification-spk` dan `send-notification-pertambahan-spk`:

- Email tujuan diambil dari tabel user cabang berdasarkan `cabang` dan jabatan `Branch Manager`.
- CC diambil dari user cabang dengan jabatan `BRANCH BUILDING & MAINTENANCE MANAGER`.
- `id_toko` boleh dikirim dari frontend untuk konsistensi payload, tetapi tidak dipakai untuk menentukan penerima pada dua flag ini.

Catatan untuk `notification-spk-has-approve` dan `notification-spk-has-reject`:

- Jika `id_toko` dikirim, email tujuan diambil dari `rab.email_pembuat` berdasarkan RAB terbaru untuk `id_toko`.
- CC akan ditambahkan dari `rab.pemberi_persetujuan_koordinator` dan `rab.pemberi_persetujuan_manager` (jika ada).
- Jika `id_toko` tidak dikirim, perilaku tetap seperti biasa (target kontraktor pada cabang terkait).

### Validasi

| Field   | Aturan                    |
| ------- | ------------------------- |
| cabang  | wajib, string min 1       |
| flag    | wajib, string min 1       |
| id_toko | opsional, integer positif |

### Response - 200 OK

```json
{
  "status": "success",
  "message": "Email notifikasi berhasil dikirim",
  "data": {
    "message_id": "18c7a8f0d2",
    "cabang": "BATAM",
    "flag": "send-notification-pertambahan-spk",
    "to": "manager.batam@alfamart.co.id",
    "cc": "building.manager@alfamart.co.id",
    "subject": "SPARTA Building - Notifikasi Approval Pertambahan Hari SPK"
  }
}
```

### Error Responses

| Code | Kondisi                                              |
| ---- | ---------------------------------------------------- |
| 400  | Template email untuk flag tidak ditemukan            |
| 404  | User target untuk cabang dan jabatan tidak ditemukan |
| 422  | Validasi request gagal                               |
| 500  | Gmail belum terkonfigurasi / EMAIL_USER belum diset  |

---

## Environment yang Dibutuhkan

| Env Var    | Deskripsi                                 |
| ---------- | ----------------------------------------- |
| EMAIL_USER | Email pengirim (harus sesuai OAuth Gmail) |

Catatan: OAuth Gmail tetap mengikuti konfigurasi token pada aplikasi (lihat GOOGLE_TOKEN_PATH).
