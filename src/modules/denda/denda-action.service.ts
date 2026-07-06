import { AppError } from "../../common/app-error";
import type { AuthenticatedUser } from "../auth/auth-session.service";
import { dendaActionRepository } from "./denda-action.repository";
import type { CreateDendaActionInput, ListDendaActionsQuery, RejectDendaActionInput } from "./denda-action.schema";
import { DENDA_ACTION_THRESHOLD_DAYS } from "./denda-keterlambatan";

const normalizeText = (value: unknown): string =>
    String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");

const userRolesText = (user?: AuthenticatedUser | null): string =>
    [user?.jabatan, ...(user?.roles ?? [])].map(normalizeText).filter(Boolean).join(" ");

const actorEmail = (user?: AuthenticatedUser | null): string | null => user?.email_sat ?? null;
const actorRole = (user?: AuthenticatedUser | null): string | null => user?.jabatan ?? user?.roles?.join(", ") ?? null;

export const canSubmitDendaAction = (user?: AuthenticatedUser | null): boolean => {
    if (!user) return false;
    if (normalizeText(user.cabang) === "HEAD OFFICE") return true;

    const roles = userRolesText(user);
    return roles.includes("SUPER HUMAN")
        || roles.includes("KOORDINATOR")
        || roles.includes("COORDINATOR");
};

export const canApproveDendaAction = (user?: AuthenticatedUser | null): boolean => {
    if (!user) return false;
    if (normalizeText(user.cabang) === "HEAD OFFICE") return true;

    const roles = userRolesText(user);
    return roles.includes("SUPER HUMAN")
        || roles.includes("REGIONAL MANAGER")
        || roles.includes("GENERAL MANAGER")
        || roles.includes("SYSTEM MANAGER")
        || roles.includes("MANAGER");
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
        if (!canSubmitDendaAction(input.actor)) {
            throw new AppError("Hanya koordinator atau user berwenang yang dapat mengajukan SP/Takeover.", 403);
        }

        await dendaActionRepository.ensureSchema();
        const target = await dendaActionRepository.findTargetByOpnameFinalId(input.id_opname_final);
        if (!target) {
            throw new AppError("Data opname final tidak ditemukan atau termasuk HEAD OFFICE.", 404);
        }

        if (target.hari_denda < DENDA_ACTION_THRESHOLD_DAYS) {
            throw new AppError(
                `SP/Takeover hanya dapat diajukan mulai ${DENDA_ACTION_THRESHOLD_DAYS} hari denda.`,
                409
            );
        }

        const stats = await dendaActionRepository.getActionStatsByOpnameFinalId(input.id_opname_final);
        if (stats.pending_approval_count > 0) {
            throw new AppError("Masih ada pengajuan SP/Takeover yang menunggu approval manager.", 409);
        }

        if (input.action_type === "SP") {
            if (stats.active_sp_count >= 3) {
                throw new AppError("SP aktif sudah mencapai maksimal 3. Tunggu masa aktif SP berakhir atau gunakan opsi lain.", 409);
            }

            const expectedLevel = stats.active_sp_count + 1;
            if (input.sp_level !== expectedLevel) {
                throw new AppError(`SP berikutnya harus SP ke-${expectedLevel}.`, 409);
            }

            return dendaActionRepository.createAction({
                target,
                action_type: input.action_type,
                sp_level: input.sp_level,
                catatan: input.catatan,
                instruksi_tindak_lanjut: input.instruksi_tindak_lanjut,
                deadline_tindak_lanjut: input.deadline_tindak_lanjut,
                lampiran_1_url: input.lampiran_1_url,
                lampiran_2_url: input.lampiran_2_url,
                actor_email: actorEmail(input.actor),
                actor_role: actorRole(input.actor),
            });
        }

        return dendaActionRepository.createAction({
            target,
            action_type: input.action_type,
            catatan: input.catatan,
            lampiran_1_url: input.lampiran_1_url,
            lampiran_2_url: input.lampiran_2_url,
            actor_email: actorEmail(input.actor),
            actor_role: actorRole(input.actor),
        });
    },

    async approveAction(input: { id: number; actor?: AuthenticatedUser | null }) {
        if (!canApproveDendaAction(input.actor)) {
            throw new AppError("Hanya manager atau user berwenang yang dapat approve SP/Takeover.", 403);
        }

        await dendaActionRepository.ensureSchema();
        const current = await dendaActionRepository.findActionById(input.id);
        if (!current) throw new AppError("Pengajuan SP/Takeover tidak ditemukan.", 404);
        if (current.status !== "WAITING_MANAGER") {
            throw new AppError("Pengajuan ini sudah diproses manager.", 409);
        }

        const updated = await dendaActionRepository.approveAction({
            id: input.id,
            actor_email: actorEmail(input.actor),
            actor_role: actorRole(input.actor),
        });
        if (!updated) throw new AppError("Pengajuan ini sudah diproses manager.", 409);
        return updated;
    },

    async rejectAction(input: { id: number; payload: RejectDendaActionInput; actor?: AuthenticatedUser | null }) {
        if (!canApproveDendaAction(input.actor)) {
            throw new AppError("Hanya manager atau user berwenang yang dapat reject SP/Takeover.", 403);
        }

        await dendaActionRepository.ensureSchema();
        const current = await dendaActionRepository.findActionById(input.id);
        if (!current) throw new AppError("Pengajuan SP/Takeover tidak ditemukan.", 404);
        if (current.status !== "WAITING_MANAGER") {
            throw new AppError("Pengajuan ini sudah diproses manager.", 409);
        }

        const updated = await dendaActionRepository.rejectAction({
            id: input.id,
            reason: input.payload.alasan_penolakan,
            actor_email: actorEmail(input.actor),
            actor_role: actorRole(input.actor),
        });
        if (!updated) throw new AppError("Pengajuan ini sudah diproses manager.", 409);
        return updated;
    },
};
