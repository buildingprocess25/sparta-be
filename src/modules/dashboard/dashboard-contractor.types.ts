export type ContractorPerformancePeriod = 
    | "THIS_MONTH"
    | "LAST_MONTH"
    | "THIS_YEAR"
    | "LAST_YEAR"
    | "YTD"
    | "ALL_TIME"
    | "CUSTOM";

export type ContractorJobType = "ALL" | "PROJECT" | "MAINTENANCE";

export interface ContractorPerformanceFilters {
    cabang?: string;
    job_type?: ContractorJobType;
    period?: ContractorPerformancePeriod;
    search?: string;
}

export interface ContractorGlobalSummary {
    avg_denda: number;
    avg_keterlambatan: number;
    sp_aktif_count: number;
    avg_kerja_tambah: number;
    avg_kerja_kurang: number;
}

export interface ContractorChartPoint {
    month: string;
    penawaran: number;
    spk: number;
    opname: number;
}

export interface ContractorLeaderboardRow {
    nama_kontraktor: string;
    avg_nilai_toko: number;
    history_sp_count: number;
    avg_design: number;
    avg_kualitas: number;
    avg_spek: number;
}

export interface ContractorRankingRow {
    nama_kontraktor: string;
    metric_value: number;
    metric_label: string;
}

export interface ContractorSpHistoryRow {
    id_action: number;
    nama_kontraktor: string;
    action_type: string;
    created_at: string;
    alasan_sp: string;
    lampiran_1_url: string | null;
}

export interface ContractorUlokRow {
    id_opname_final?: number;
    id_toko: number;
    nomor_ulok: string;
    nama_toko: string;
    cabang: string;
    nama_kontraktor: string;
    scopes: Array<{
        lingkup_pekerjaan: string;
        project_type: string;
        has_rab: boolean;
        has_spk: boolean;
        has_st: boolean;
        has_opname: boolean;
    }>;
    nilai_toko?: number;
    kualitas?: string;
    desain?: string;
    spesifikasi?: string;
    hari_denda?: number;
    nilai_denda?: number;
    kerja_tambah?: number;
    kerja_kurang?: number;
}

export interface ContractorUlokDetail {
    nomor_ulok: string;
    nama_toko: string;
    cabang: string;
    selected_scope: string;
    metrics: {
        nilai_toko?: number;
        kualitas?: string;
        desain?: string;
        spesifikasi?: string;
        hari_denda?: number;
        nilai_denda?: number;
        kerja_tambah?: number;
        kerja_kurang?: number;
    };
    identitas: any; 
}
