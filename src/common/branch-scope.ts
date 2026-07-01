export const BRANCH_GROUPS: Record<string, string[]> = {
    LOMBOK: ["LOMBOK", "SUMBAWA"],
    CILEUNGSI: ["CILEUNGSI", "BOGOR", "BEKASI", "KARAWANG"],
    CIKOKOL: ["CIKOKOL", "BINTAN", "PARUNG", "BALARAJA", "SERANG"],
    MEDAN: ["MEDAN", "ACEH"],
    LAMPUNG: ["LAMPUNG", "KOTABUMI"],
    PALEMBANG: ["PALEMBANG", "BENGKULU", "BANGKA", "BELITUNG"],
    SIDOARJO: ["SIDOARJO", "SIDOARJO BPN_SMD", "MANOKWARI", "NTT", "SORONG"],
};

export const normalizeBranchScopeName = (value?: string | null): string =>
    String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();

export const getBranchScopeCandidates = (branch?: string | null): string[] => {
    const normalized = normalizeBranchScopeName(branch);
    if (!normalized) return [];

    const candidates = new Set<string>([normalized]);
    for (const [parentBranch, branchGroup] of Object.entries(BRANCH_GROUPS)) {
        if (branchGroup.includes(normalized)) {
            candidates.add(parentBranch);
            branchGroup.forEach(item => candidates.add(item));
        }
    }

    return Array.from(candidates);
};

export const isSameBranchScope = (left?: string | null, right?: string | null): boolean => {
    const normalizedLeft = normalizeBranchScopeName(left);
    const normalizedRight = normalizeBranchScopeName(right);
    if (!normalizedLeft || !normalizedRight) return false;
    if (normalizedLeft === normalizedRight) return true;

    return getBranchScopeCandidates(normalizedLeft).includes(normalizedRight);
};
