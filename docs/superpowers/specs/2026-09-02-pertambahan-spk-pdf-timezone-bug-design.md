# Design Spec: Perbaikan Bug Timezone pada PDF Pertambahan SPK

## 1. Ringkasan Masalah
Pada modul Pertambahan SPK, terdapat perbedaan data tanggal akhir (sebelum dan sesudah perpanjangan) antara UI Detail (Front-End) dan file PDF yang di-generate (Back-End). 
Contoh kasus pada ULOK `YZ01-2605-0009`:
- **Detail FE**: 18 Agustus 2026 (Benar)
- **PDF BE**: 17 Agustus 2026 (Salah)

Hal ini terjadi karena logika `formatDateIndonesia` di backend menggunakan metode bawaan `date.getDate()` yang bergantung pada zona waktu server. Di lingkungan produksi yang berjalan pada UTC (GMT+0), tanggal dari WIB (GMT+7) akan bergeser mundur 1 hari.

## 2. Tujuan
Memastikan file PDF Pertambahan SPK yang di-generate oleh backend selalu menampilkan tanggal yang konsisten dengan data di database dan Front-End (berbasis Waktu Indonesia Barat / WIB), terlepas dari pengaturan zona waktu server (UTC).

## 3. Pendekatan Solusi
Mengubah implementasi `formatDateIndonesia` di dalam file `src/modules/pertambahan-spk/pertambahan-spk.pdf.ts`. 
Pendekatan yang digunakan adalah **Pendekatan 1**:
Alih-alih menggunakan `date.getDate()` dan `date.getMonth()`, kita akan menggunakan `Intl.DateTimeFormat` dan secara eksplisit mengunci zona waktu ke `"Asia/Jakarta"`.

### 3.1. Kode yang Diubah (Pertambahan SPK PDF Generator)
**Lokasi File:** `sparta-be/src/modules/pertambahan-spk/pertambahan-spk.pdf.ts`

**Implementasi Baru:**
```typescript
const formatDateIndonesia = (value?: string | null): string => {
    if (!value) return "-";
    const date = parseDateValue(value);
    if (Number.isNaN(date.getTime())) return String(value);

    // Mengunci timezone ke WIB agar konsisten dengan FE dan tidak terpengaruh server UTC
    const formatter = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "numeric",
        month: "long",
        year: "numeric"
    });
    return formatter.format(date);
};
```

## 4. Dampak Perubahan
- **Konsistensi UI dan Dokumen:** Dokumen PDF Pertambahan SPK akan menampilkan tanggal yang sama persis dengan yang dilihat oleh pengguna di UI Front-End.
- **Isolasi Logika:** Menggunakan `Intl.DateTimeFormat` di dalam fungsi pembantu khusus PDF generator meminimalisir risiko regresif pada modul lain. Tidak ada perubahan global pada zona waktu Node.js (aman).

## 5. Rencana Pengujian
1. Mensimulasikan server di zona waktu UTC secara lokal (`process.env.TZ = "UTC"`).
2. Memasukkan payload tanggal `2026-08-16`.
3. Memastikan fungsi `formatDateIndonesia` mengembalikan `16 Agustus 2026`, bukan `15 Agustus 2026`.
4. Mengunggah atau men-generate PDF dan memverifikasi teks tanggal yang tertera di dalamnya benar.
