import { AppError } from "../../common/app-error";
import type { AuthenticatedUser } from "../auth/auth-session.service";
import {
    SYSTEM_MAINTENANCE_TEMPLATE,
    systemMaintenanceRepository,
    type SystemMaintenanceRow,
} from "./system-maintenance.repository";

const normalizeText = (value: unknown): string =>
    String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");

export const canManageSystemMaintenance = (user?: AuthenticatedUser | null): boolean =>
    Boolean(user?.roles.some((role) => normalizeText(role).includes("SUPER HUMAN")));

export const systemMaintenanceService = {
    ensureSchema: () => systemMaintenanceRepository.ensureSchema(),

    async getStatus(): Promise<SystemMaintenanceRow> {
        return systemMaintenanceRepository.getStatus();
    },

    async setActive(input: { is_active: boolean; actor?: AuthenticatedUser | null }): Promise<SystemMaintenanceRow> {
        if (!canManageSystemMaintenance(input.actor)) {
            throw new AppError("Anda tidak memiliki akses untuk mengubah status pemeliharaan sistem.", 403);
        }

        return systemMaintenanceRepository.updateStatus({
            is_active: input.is_active,
            title: SYSTEM_MAINTENANCE_TEMPLATE.title,
            message: SYSTEM_MAINTENANCE_TEMPLATE.message,
            actor_email: input.actor?.email_sat ?? null,
            actor_role: input.actor?.jabatan ?? input.actor?.roles.join(", ") ?? null,
        });
    },
};
