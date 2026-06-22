export type FinancialDirection = "down" | "up";

export type FinancialSummary = {
    total: number;
    pembulatan: number;
    ppn: number;
    grand_total: number;
};

export type OpnameFinalFinancialInput = {
    rab: number;
    instruksiLapangan: number;
    kerjaTambah: number;
    kerjaKurang: number;
    denda: number;
    noPpn?: boolean;
};

const finiteNumber = (value: number): number => Number.isFinite(value) ? value : 0;

export const buildFinancialSummary = (
    rawTotal: number,
    direction: FinancialDirection,
    noPpn = false
): FinancialSummary => {
    const total = finiteNumber(rawTotal);
    const sign = total < 0 ? -1 : 1;
    const absolute = Math.abs(total);
    const roundedAbsolute = direction === "down"
        ? Math.floor(absolute / 10_000) * 10_000
        : (absolute === 0 ? 0 : Math.ceil(absolute / 10_000) * 10_000);
    const pembulatan = sign * roundedAbsolute;
    const ppn = noPpn ? 0 : Math.round(pembulatan * 0.11);

    return {
        total,
        pembulatan,
        ppn,
        grand_total: pembulatan + ppn,
    };
};

export const calculateOpnameFinalFinancials = (input: OpnameFinalFinancialInput) => {
    const rab = buildFinancialSummary(input.rab, "down", input.noPpn);
    const instruksiLapangan = buildFinancialSummary(input.instruksiLapangan, "up", input.noPpn);
    const kerjaTambah = buildFinancialSummary(input.kerjaTambah, "up", input.noPpn);
    const kerjaKurang = buildFinancialSummary(input.kerjaKurang, "up", input.noPpn);
    const denda = finiteNumber(input.denda);

    return {
        rab,
        instruksiLapangan,
        kerjaTambah,
        kerjaKurang,
        denda,
        selisihKerjaTambahKurang: kerjaTambah.grand_total - Math.abs(kerjaKurang.grand_total),
        totalFinal: rab.grand_total
            + instruksiLapangan.grand_total
            + kerjaTambah.grand_total
            - Math.abs(kerjaKurang.grand_total)
            - denda,
    };
};

export const isNoPpnArea = (toko: {
    cabang?: string | null;
    nama_toko?: string | null;
    alamat?: string | null;
}): boolean => {
    const identity = [toko.cabang, toko.nama_toko, toko.alamat]
        .map((value) => String(value ?? "").trim().toUpperCase());

    return identity.some(
        (value) => value === "BATAM"
            || value === "BINTAN"
            || /\bBATAM\b|\bBINTAN\b/.test(value)
    );
};
