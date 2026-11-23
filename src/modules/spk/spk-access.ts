import { AppError } from '../../common/app-error';
import { getEffectiveBranchesForUser, normalizeBranchScopeName } from '../../common/branch-scope';
import type { AuthenticatedUser } from '../auth/auth-session.service';

export function assertSpkRole(user: AuthenticatedUser | null | undefined, action: 'submit' | 'approval' | 'intervention'): asserts user is AuthenticatedUser {
    if (!user) throw new AppError('User tidak terautentikasi', 401);
    const roles = user.roles.map(r => r.trim().toUpperCase());
    const privileged = roles.some(r => r === 'SUPER HUMAN' || r === 'BUILDING & MAINTENANCE SUPER HUMAN');
    const allowed = action === 'intervention'
        ? privileged || roles.some(r => r.includes('STORE & BRANCH CONTROLLING'))
        : action === 'approval'
            ? privileged || roles.some(r => r === 'BRANCH MANAGER' || r === 'MANAGER')
            : privileged || user.cabang?.toUpperCase() === 'HEAD OFFICE' || roles.some(r => [
                'BRANCH BUILDING & MAINTENANCE MANAGER','BRANCH BUILDING COORDINATOR','BRANCH BUILDING SUPPORT',
                'BUILDING & MAINTENANCE REGIONAL MANAGER',
            ].includes(r));
    if (!allowed) throw new AppError('Role Anda tidak berwenang melakukan tindakan SPK ini', 403);
}

export async function assertSpkBranches(user: AuthenticatedUser, branches: Array<string | null | undefined>) {
    const scope = await getEffectiveBranchesForUser({ emailSat: user.email_sat, cabang: user.cabang, roles: user.roles });
    if (scope.source === 'global') return;
    const allowed = scope.branches.map(normalizeBranchScopeName);
    if (branches.some(b => !b || !allowed.includes(normalizeBranchScopeName(b)))) {
        throw new AppError('Anda tidak memiliki akses ke cabang SPK ini', 403);
    }
}
