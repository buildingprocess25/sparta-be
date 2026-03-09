export const SPK_STATUS = {
    WAITING_FOR_BM_APPROVAL: "WAITING_FOR_BM_APPROVAL",
    SPK_APPROVED: "SPK_APPROVED",
    SPK_REJECTED: "SPK_REJECTED"
} as const;

export type SpkStatus = (typeof SPK_STATUS)[keyof typeof SPK_STATUS];

export const ACTIVE_SPK_STATUSES: SpkStatus[] = [
    SPK_STATUS.WAITING_FOR_BM_APPROVAL,
    SPK_STATUS.SPK_APPROVED
];

export const BRANCH_TO_CODE_MAP: Record<string, string> = {
    "WHC IMAM BONJOL": "7AZ1", "LUWU": "2VZ1", "KARAWANG": "1JZ1", "REMBANG": "2AZ1",
    "BANJARMASIN": "1GZ1", "PARUNG": "1MZ1", "TEGAL": "2PZ1", "GORONTALO": "2SZ1",
    "PONTIANAK": "1PZ1", "LOMBOK": "1SZ1", "KOTABUMI": "1VZ1", "SERANG": "2GZ1",
    "CIANJUR": "2JZ1", "BALARAJA": "TZ01", "SIDOARJO": "UZ01", "MEDAN": "WZ01",
    "BOGOR": "XZ01", "JEMBER": "YZ01", "BALI": "QZ01", "PALEMBANG": "PZ01",
    "KLATEN": "OZ01", "MAKASSAR": "RZ01", "PLUMBON": "VZ01", "PEKANBARU": "1AZ1",
    "JAMBI": "1DZ1", "HEAD OFFICE": "Z001", "BANDUNG 1": "BZ01", "BANDUNG 2": "NZ01",
    "BEKASI": "CZ01", "CILACAP": "IZ01", "CILEUNGSI": "JZ01", "SEMARANG": "HZ01",
    "CIKOKOL": "KZ01", "LAMPUNG": "LZ01", "MALANG": "MZ01", "MANADO": "1YZ1",
    "BATAM": "2DZ1", "MADIUN": "2MZ1"
};

export const getCabangCode = (cabangName: string): string => {
    return BRANCH_TO_CODE_MAP[cabangName.toUpperCase()] ?? cabangName;
};
