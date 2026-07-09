/**
 * Branch Filter Helper
 * 
 * Helper untuk enforce branch filtering di controller level
 * sesuai dengan business rules yang telah diklarifikasi:
 * 
 * 1. CIKOKOL & CILEUNGSI: Gunakan user_branch_coverage (subdivisi)
 * 2. Branch lain (Lombok, Medan, dll): Seluruh branch group
 * 3. Support role: Seluruh branch group
 * 4. Global roles: Semua branches
 */

import type { AuthenticatedUser } from "../modules/auth/auth-session.service";
import { getEffectiveBranchesForUser } from "./branch-scope";

/**
 * Get user's accessible branches untuk filtering query
 * 
 * @param user - Authenticated user dari req.user
 * @returns Array of branch names yang boleh diakses user
 */
export const getUserAccessibleBranches = async (user: AuthenticatedUser): Promise<string[]> => {
    const { branches } = await getEffectiveBranchesForUser({
        emailSat: user.email_sat,
        cabang: user.cabang,
        roles: user.roles
    });

    return branches;
};

/**
 * Helper type untuk query object yang punya cabang_array field
 */
export type QueryWithBranchArray = {
    cabang_array?: string[];
    [key: string]: unknown;
};

/**
 * Inject user's accessible branches ke dalam query object
 * 
 * Usage di controller:
 * ```typescript
 * const query = listQuerySchema.parse(req.query);
 * await injectBranchFilter(req.user!, query);
 * const data = await service.list(query);
 * ```
 */
export const injectBranchFilter = async <T extends QueryWithBranchArray>(
    user: AuthenticatedUser,
    query: T
): Promise<T> => {
    const scope = await getEffectiveBranchesForUser({
        emailSat: user.email_sat,
        cabang: user.cabang,
        roles: user.roles
    });
    
    // Log untuk debugging
    console.log('[BRANCH FILTER] User:', user.email_sat, 'Cabang:', user.cabang, 'Source:', scope.source, 'Branches:', scope.branches);
    
    if (scope.source === "global") {
        // Global user: bypass branch filtering entirely.
        // Return object without cabang_array so repositories skip the ANY($X) filter.
        return {
            ...query,
            cabang_array: undefined
        };
    }

    // Non-global user: wajib punya minimal 1 branch
    if (scope.branches.length === 0) {
        console.error('[BRANCH FILTER] ERROR: Non-global user has no accessible branches!', {
            email: user.email_sat,
            cabang: user.cabang,
            roles: user.roles,
            source: scope.source
        });
        // Return array dengan cabang yang impossible agar query tidak return semua data
        return {
            ...query,
            cabang_array: ['__NO_ACCESS__']
        };
    }

    return {
        ...query,
        cabang_array: scope.branches
    };
};
