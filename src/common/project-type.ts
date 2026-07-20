export const RENOVATION_PROJECT_LABEL = "Renovasi";

export const isRenovationUlok = (nomorUlok?: string | null): boolean =>
    /-R$/i.test(String(nomorUlok ?? "").trim());

export const normalizeProjectByUlok = (
    nomorUlok?: string | null,
    proyek?: string | null
): string | null => {
    if (isRenovationUlok(nomorUlok)) {
        return RENOVATION_PROJECT_LABEL;
    }

    const trimmed = String(proyek ?? "").trim();
    return trimmed || null;
};
