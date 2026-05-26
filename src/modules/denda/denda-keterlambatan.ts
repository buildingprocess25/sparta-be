import { pool } from "../../db/pool";

export type DendaKeterlambatanResult = {
    hari_denda: number;
    nilai_denda: number;
    tanggal_akhir_spk: string | null;
    tanggal_serah_terima: string | null;
};

type SpkPenaltySourceRow = {
    waktu_selesai: string | null;
    tanggal_spk_akhir_setelah_perpanjangan: string | null;
};

type SerahTerimaPenaltyRow = {
    created_at: string | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const startOfLocalDay = (date: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const parseDateValue = (value?: string | null): Date | null => {
    const raw = String(value ?? "").trim();
    if (!raw) return null;

    const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
        const [, day, month, year] = slashMatch;
        return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return null;
    return startOfLocalDay(date);
};

const toIsoDate = (date: Date | null): string | null => {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 0 || day === 6;
};

const addDays = (date: Date, days: number): Date => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

const nextBusinessDayAfter = (date: Date): Date => {
    let current = addDays(startOfLocalDay(date), 1);
    while (isWeekend(current)) {
        current = addDays(current, 1);
    }
    return current;
};

const countWeekdaysAfterFreeDate = (freeDate: Date, stDate: Date): number => {
    const normalizedFreeDate = startOfLocalDay(freeDate);
    const normalizedStDate = startOfLocalDay(stDate);
    if (normalizedStDate <= normalizedFreeDate) return 0;

    let current = addDays(normalizedFreeDate, 1);
    let count = 0;
    while (current <= normalizedStDate) {
        if (!isWeekend(current)) count += 1;
        current = addDays(current, 1);
    }
    return count;
};

export const calculateDendaNominal = (hariDenda: number): number => {
    if (hariDenda <= 0) return 0;
    const hariPertama = Math.min(hariDenda, 5);
    const hariBerikutnya = Math.max(0, Math.min(hariDenda - 5, 10));
    return Math.min((hariPertama * 1_000_000) + (hariBerikutnya * 500_000), 10_000_000);
};

export const calculateDendaFromDates = (
    tanggalAkhirSpk: Date | null,
    tanggalSerahTerima: Date | null
): DendaKeterlambatanResult => {
    if (!tanggalAkhirSpk || !tanggalSerahTerima) {
        return {
            hari_denda: 0,
            nilai_denda: 0,
            tanggal_akhir_spk: toIsoDate(tanggalAkhirSpk),
            tanggal_serah_terima: toIsoDate(tanggalSerahTerima)
        };
    }

    const freeDate = nextBusinessDayAfter(tanggalAkhirSpk);
    const hariDenda = countWeekdaysAfterFreeDate(freeDate, tanggalSerahTerima);

    return {
        hari_denda: hariDenda,
        nilai_denda: calculateDendaNominal(hariDenda),
        tanggal_akhir_spk: toIsoDate(tanggalAkhirSpk),
        tanggal_serah_terima: toIsoDate(tanggalSerahTerima)
    };
};

export const calculateDendaByTokoId = async (idToko: number): Promise<DendaKeterlambatanResult> => {
    const spkResult = await pool.query<SpkPenaltySourceRow>(
        `
        SELECT
            ps.waktu_selesai,
            MAX(pt.tanggal_spk_akhir_setelah_perpanjangan) FILTER (
                WHERE UPPER(COALESCE(pt.status_persetujuan, '')) = 'APPROVED'
            ) AS tanggal_spk_akhir_setelah_perpanjangan
        FROM pengajuan_spk ps
        LEFT JOIN pertambahan_spk pt ON pt.id_spk = ps.id
        WHERE ps.id_toko = $1
          AND UPPER(COALESCE(ps.status, '')) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
        GROUP BY ps.id, ps.waktu_selesai
        `,
        [idToko]
    );

    const latestAkhirSpk = spkResult.rows
        .map((row) => parseDateValue(row.tanggal_spk_akhir_setelah_perpanjangan) ?? parseDateValue(row.waktu_selesai))
        .filter((date): date is Date => Boolean(date))
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    const stResult = await pool.query<SerahTerimaPenaltyRow>(
        `
        SELECT created_at
        FROM berkas_serah_terima
        WHERE id_toko = $1
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        `,
        [idToko]
    );

    const tanggalSerahTerima = parseDateValue(stResult.rows[0]?.created_at ?? null);
    return calculateDendaFromDates(latestAkhirSpk, tanggalSerahTerima);
};
