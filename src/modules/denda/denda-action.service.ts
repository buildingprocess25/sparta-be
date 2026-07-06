import { AppError } from "../../common/app-error";
import type { AuthenticatedUser } from "../auth/auth-session.service";
import { dendaActionRepository } from "./denda-action.repository";
import type { CreateDendaActionInput, ListDendaActionsQuery } from "./denda-action.schema";
import { DENDA_ACTION_THRESHOLD_DAYS } from "./denda-keterlambatan";

const normalizeText = (value: unknown): string =>
    String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");

export const canManageDendaAction = (user?: AuthenticatedUser | null): boolean => {
    if (!user) return false;
    if (normalizeText(user.cabang) === "HEAD OFFICE") return true;

    return user.roles.some((role) => {
        const normalized = normalizeText(role);
        return normalized.includes("SUPER HUMAN")
            || normalized.includes("REGIONAL MANAGER")
            || normalized.includes("GENERAL MANAGER")
            || normalized.includes("SYSTEM MANAGER")
            || normalized.includes("MANAGER");
    });
};

export const dendaActionService = {
    ensureSchema: () => dendaActionRepository.ensureSchema(),

    async listCandidates() {
        await dendaActionRepository.ensureSchema();
        return dendaActionRepository.listCandidates();
    },

    async listActions(query: ListDendaActionsQuery) {
        await dendaActionRepository.ensureSchema();
        return dendaActionRepository.listActions(query);
    },

    async createAction(input: CreateDendaActionInput & { actor?: AuthenticatedUser | null }) {
        if (!canManageDendaAction(input.actor)) {
            throw new AppError("Anda tidak memiliki akses untuk membuat keputusan SP/Takeover.", 403);
        }

        await dendaActionRepository.ensureSchema();
        const target = await dendaActionRepository.findTargetByOpnameFinalId(input.id_opname_final);
        if (!target) {
            throw new AppError("Data opname final tidak ditemukan atau termasuk HEAD OFFICE.", 404);
        }

        if (target.hari_denda < DENDA_ACTION_THRESHOLD_DAYS) {
            throw new AppError(
                `Keputusan SP/Takeover hanya dapat dibuat mulai ${DENDA_ACTION_THRESHOLD_DAYS} hari denda.`,
                409
            );
        }

        return dendaActionRepository.createAction({
            target,
            action_type: input.action_type,
            catatan: input.catatan,
            actor_email: input.actor?.email_sat ?? null,
            actor_role: input.actor?.jabatan ?? input.actor?.roles.join(", ") ?? null,
        });
    },
};
