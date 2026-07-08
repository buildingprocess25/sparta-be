import { pool } from "../db/pool";

export const BRANCH_GROUPS: Record<string, string[]> = {
    LOMBOK: ["LOMBOK", "SUMBAWA"],
    CILEUNGSI: ["CILEUNGSI", "BOGOR", "BEKASI", "KARAWANG"],
    CIKOKOL: ["CIKOKOL", "PARUNG", "BALARAJA", "SERANG", "BINTAN"], // Added BINTAN to CIKOKOL group
    MEDAN: ["MEDAN", "ACEH"],
    LAMPUNG: ["LAMPUNG", "KOTABUMI"],
    PALEMBANG: ["PALEMBANG", "BENGKULU", "BANGKA", "BELITUNG"],
    SIDOARJO: ["SIDOARJO", "SIDOARJO BPN SMD", "MANOKWARI", "NTT", "SORONG"], // FIX: Use space not underscore
};

export const GLOBAL_ACCESS_ROLES = [
    "BUILDING & MAINTENANCE SUPER HUMAN",
    "BUILDING & MAINTENANCE REGIONAL MANAGER",
    "BUILDING MAINTENANCE & ENERGY SYSTEM MANAGER",
    "BUILDING & MAINTENANCE GENERAL MANAGER",
    "STORE & BRANCH CONTROLLING SPECIALIST",
];

export const normalizeBranchScopeName = (value?: string | null): string =>
    String(value ?? "")
        .trim()
        .replace(/\s+/g, " ")        // Multiple spaces → single space
        .replace(/_+/g, " ")         // Underscores → space (FIX for SIDOARJO BPN_SMD)
        .toUpperCase();

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

    const result = Array.from(candidates);
    console.log(`[BRANCH SCOPE] getBranchScopeCandidates('${branch}') → normalized:'${normalized}' → result:`, result);
    return result;
};

export const isSameBranchScope = (left?: string | null, right?: string | null): boolean => {
    const normalizedLeft = normalizeBranchScopeName(left);
    const normalizedRight = normalizeBranchScopeName(right);
    if (!normalizedLeft || !normalizedRight) return false;
    if (normalizedLeft === normalizedRight) return true;

    return getBranchScopeCandidates(normalizedLeft).includes(normalizedRight);
};

/**
 * Check if user has global access (can see all branches)
 */
export const hasGlobalAccess = (cabang?: string | null, roles?: string[]): boolean => {
    const normalizedCabang = normalizeBranchScopeName(cabang);
    if (normalizedCabang === "HEAD OFFICE") return true;
    
    return (roles ?? []).some(role => 
        GLOBAL_ACCESS_ROLES.includes(normalizeBranchScopeName(role))
    );
};

/**
 * Check if user has branch support role (can see all branches in their branch group)
 */
export const isBranchSupportRole = (roles?: string[]): boolean => {
    return (roles ?? []).some(role => 
        normalizeBranchScopeName(role).includes("BRANCH BUILDING SUPPORT")
    );
};

/**
 * Get user's coverage branches from user_branch_coverage table
 */
export const getUserCoverageBranches = async (emailSat: string, cabang: string): Promise<string[]> => {
    const result = await pool.query<{ covered_cabang: string }>(
        `
        SELECT DISTINCT ubc.covered_cabang
        FROM user_cabang uc
        JOIN user_branch_coverage ubc ON ubc.user_cabang_id = uc.id
        WHERE LOWER(TRIM(uc.email_sat)) = LOWER(TRIM($1))
          AND LOWER(TRIM(uc.cabang)) = LOWER(TRIM($2))
        ORDER BY ubc.covered_cabang ASC
        `,
        [emailSat, cabang]
    );

    return result.rows.map(row => normalizeBranchScopeName(row.covered_cabang)).filter(Boolean);
};

/**
 * Branches that have specific coverage rules (Manager/Coordinator have subdivisions)
 * Other branches allow all roles to access entire branch group
 */
const BRANCHES_WITH_SPECIFIC_COVERAGE = ["CIKOKOL", "CILEUNGSI"];

/**
 * Check if branch has specific coverage rules
 */
const hasSpecificCoverageRules = (cabang: string): boolean => {
    const normalized = normalizeBranchScopeName(cabang);
    return BRANCHES_WITH_SPECIFIC_COVERAGE.includes(normalized);
};

/**
 * Get effective accessible branches for a user based on role and coverage.
 * This is the single source of truth for branch access logic.
 * 
 * Business Rules:
 * 1. Global roles (Superhuman, Regional Manager) → All branches
 * 2. Branch Support role → All branches in branch group (all branches)
 * 3. CIKOKOL/CILEUNGSI only:
 *    - Manager/Coordinator → Coverage from user_branch_coverage (subdivided)
 *    - If no coverage → Fallback to login branch
 * 4. Other branches (Lombok, Medan, Lampung, etc):
 *    - ALL roles → Entire branch group (no subdivision)
 */
export const getEffectiveBranchesForUser = async (input: {
    emailSat: string;
    cabang: string;
    roles: string[];
}): Promise<{ branches: string[]; source: "global" | "support" | "coverage" | "branch_group" | "fallback" }> => {
    const { emailSat, cabang, roles } = input;
    const normalizedCabang = normalizeBranchScopeName(cabang);

    // 1. Global access
    if (hasGlobalAccess(cabang, roles)) {
        const allBranches = Array.from(
            new Set([
                ...Object.values(BRANCH_GROUPS).flat(),
                "LUWU", "REMBANG", "BANJARMASIN", "TEGAL", "GORONTALO", "PONTIANAK",
                "CIANJUR", "JEMBER", "BALI", "KLATEN", "MAKASSAR", "PLUMBON",
                "PEKANBARU", "JAMBI", "HEAD OFFICE", "BANDUNG RAYA", "CILACAP",
                "SEMARANG", "MALANG", "MANADO", "BATAM", "MADIUN"
            ])
        ).sort();
        return { branches: allBranches, source: "global" };
    }

    // 2. Branch Support role → Always entire branch group
    if (isBranchSupportRole(roles)) {
        const branchGroup = getBranchScopeCandidates(normalizedCabang);
        return { branches: branchGroup.sort(), source: "support" };
    }

    // 3. Check if this branch has specific coverage rules (CIKOKOL/CILEUNGSI only)
    const hasSpecificRules = hasSpecificCoverageRules(normalizedCabang);

    if (hasSpecificRules) {
        // For CIKOKOL/CILEUNGSI: Manager/Coordinator have subdivisions
        const coverage = await getUserCoverageBranches(emailSat, cabang);

        if (coverage.length > 0) {
            return { branches: coverage.sort(), source: "coverage" };
        }

        // Fallback: login branch only
        return { 
            branches: normalizedCabang ? [normalizedCabang] : [], 
            source: "fallback" 
        };
    }

    // 4. Other branches (Lombok, Medan, Lampung, etc): ALL roles access entire branch group
    const branchGroup = getBranchScopeCandidates(normalizedCabang);
    return { branches: branchGroup.sort(), source: "branch_group" };
};
