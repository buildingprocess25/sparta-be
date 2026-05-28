# Dokumentasi API Activity Log - sparta-api

Terakhir diperbarui: 2026-05-28

Base URL: `/api/activity-log`

API ini mengambil riwayat aktivitas per dokumen/entity. Route aktif saat ini hanya list berdasarkan tipe entity dan ID entity.

---

## Endpoint

| Method | Path | Deskripsi |
| --- | --- | --- |
| `GET` | `/api/activity-log` | List log berdasarkan `entity_type` dan `entity_id`. |

---

## GET /api/activity-log

### Query Parameters

| Parameter | Wajib | Tipe | Keterangan |
| --- | --- | --- | --- |
| `entity_type` | Ya | enum | Tipe entity dokumen. |
| `entity_id` | Ya | number | ID entity, integer >= 0. |

Nilai `entity_type` yang valid:

- `RAB`
- `SPK`
- `PERTAMBAHAN_SPK`
- `OPNAME_FINAL`
- `PENGAWASAN`
- `BERKAS_SERAH_TERIMA`
- `INSTRUKSI_LAPANGAN`
- `PROJECT_PLANNING`
- `DOKUMENTASI_BANGUNAN`
- `PENYIMPANAN_DOKUMEN`

### Contoh

```http
GET /api/activity-log?entity_type=SPK&entity_id=12
```

### Response 200

```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "entity_type": "SPK",
      "entity_id": 12,
      "action": "APPROVE",
      "actor_email": "bm@example.com",
      "actor_role": "Branch Manager",
      "description": "SPK disetujui",
      "created_at": "2026-05-28T10:00:00.000Z"
    }
  ]
}
```

Field response dapat bertambah mengikuti data log yang dicatat repository.

### Error

| Code | Kondisi |
| --- | --- |
| 422 | Query tidak valid, `entity_type` tidak dikenal, atau `entity_id` bukan integer. |
