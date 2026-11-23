export type WorkflowVersion = "legacy" | "contractor_first";
export type OpnameReviewDecision = "disetujui" | "ditolak";
export type PengawasanStatus = "progress" | "selesai" | "terlambat";

export function subtractOneCalendarDay(yyyyMmDd: string): string {
    const normalized = yyyyMmDd.slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);

    if (!match) {
        throw new Error("Tanggal harus menggunakan format YYYY-MM-DD");
    }

    const [, year, month, day] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    date.setUTCDate(date.getUTCDate() - 1);

    return date.toISOString().slice(0, 10);
}

export function workItemKey(input: { id_rab_item?: number | null; id_instruksi_lapangan_item?: number | null }): string {
    const hasRabItem = typeof input.id_rab_item === "number" && input.id_rab_item > 0;
    const hasInstruksiLapanganItem =
        typeof input.id_instruksi_lapangan_item === "number" && input.id_instruksi_lapangan_item > 0;

    if (hasRabItem === hasInstruksiLapanganItem) {
        throw new Error("Work item source must be exactly one of RAB or IL");
    }

    if (hasInstruksiLapanganItem) return `il:${input.id_instruksi_lapangan_item}`;
    return `rab:${input.id_rab_item}`;
}

export function allowedStatusesForContractorFirst(input: {
    hasOpnameSubmission: boolean;
    decision?: OpnameReviewDecision | null;
    hasFutureHit: boolean;
}): PengawasanStatus[] {
    if (!input.hasOpnameSubmission) return input.hasFutureHit ? ["progress"] : ["terlambat"];
    if (input.decision === "disetujui") return ["selesai"];
    if (input.decision === "ditolak") return input.hasFutureHit ? ["selesai", "progress"] : ["selesai", "terlambat"];
    return input.hasFutureHit ? ["progress"] : ["terlambat"];
}
