# API Documentation: Instruksi Lapangan

Base URL: `/api/instruksi-lapangan`

## 1. Submit Instruksi Lapangan

**Endpoint**: `/submit`  
**Method**: `POST`  
**Content-Type**: `multipart/form-data`

### Payload Form Data:

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `nomor_ulok` | string | Yes | Nomor ULOK toko. |
| `email_pembuat` | string | Yes | Email pembuat instruksi lapangan. |
| `lampiran` | file | No | File lampiran PDF/Gambar (maks 10MB). |
| `detail_items` | string (JSON) | Yes | Array of object yang di-stringify. Detail lihat di bawah. |

#### Format `detail_items` (JSON String):
```json
[
  {
    "kategori_pekerjaan": "Persiapan",
    "jenis_pekerjaan": "Pembersihan Lahan",
    "satuan": "m2",
    "volume": 100,
    "harga_material": 0,
    "harga_upah": 5000
  }
]
```

### Response Sukses (201 Created):
```json
{
  "status": "success",
  "message": "Pengajuan Instruksi Lapangan berhasil disimpan",
  "data": {
    "id": 1,
    "id_toko": 123,
    "status": "Menunggu Persetujuan Koordinator",
    "link_pdf_gabungan": "https://drive.google.com/...",
    ...
  }
}
```

---

## 2. List Instruksi Lapangan

**Endpoint**: `/list`  
**Method**: `GET`

### Query Params:
- `status` (string, opsional)
- `nomor_ulok` (string, opsional)
- `cabang` (string, opsional)
- `email_pembuat` (string, opsional)

### Response:
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "status": "Menunggu Persetujuan Koordinator",
      "nomor_ulok": "12345",
      "nama_toko": "Toko A",
      "cabang": "Jakarta",
      ...
    }
  ]
}
```

---

## 3. Detail Instruksi Lapangan

**Endpoint**: `/:id`  
**Method**: `GET`

### Response:
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "id_toko": 123,
    "status": "Menunggu Persetujuan Koordinator",
    "items": [
      {
        "id": 1,
        "kategori_pekerjaan": "Persiapan",
        ...
      }
    ]
  }
}
```

---

## 4. Download PDF Instruksi Lapangan

**Endpoint**: `/:id/pdf`  
**Method**: `GET`

Men-download file PDF yang di-generate dari data instruksi lapangan dan di-merge dengan lampiran (jika PDF).

---

## 5. Download Lampiran

**Endpoint**: `/:id/lampiran`  
**Method**: `GET`

Men-download file lampiran original yang diunggah saat submit.

---

## 6. Handle Approval Instruksi Lapangan

**Endpoint**: `/:id/approval`  
**Method**: `POST`  
**Content-Type**: `application/json`

### Payload:
```json
{
  "action": "APPROVE", // atau "REJECT"
  "approver_email": "manager@alfamart.com",
  "reason": "Opsional, wajib jika REJECT"
}
```

### Flow Status:
`Menunggu Persetujuan Koordinator` -> `Menunggu Persetujuan Manager` -> `Menunggu Persetujuan Kontraktor` -> `Disetujui`

### Response:
```json
{
  "status": "success",
  "message": "Approval berhasil diproses",
  "data": { ... }
}
```
