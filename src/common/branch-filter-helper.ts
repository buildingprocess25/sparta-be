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
    if (scope.source === "global") {
        return query;
    }

    return {
        ...query,
        cabang_array: scope.branches
    };
};
