import { spkGroupRepository } from './spk-group.repository';
import { buildSpkCandidates } from './spk-group.rules';
import { assertSpkBranches, assertSpkRole } from './spk-access';
import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { opnameFinalService } from "../opname-final/opname-final.service";
import { tokoRepository } from "../toko/toko.repository";
import { SPK_STATUS } from "./spk.constants";
import { buildSpkPdfBuffer } from "./spk.pdf";
import { spkRepository } from "./spk.repository";
import type { SpkApprovalInput, SpkInterventionInput, SpkListQuery, SubmitSpkInput } from "./spk.schema";
import type { AuthenticatedUser } from "../auth/auth-session.service";
import { spkBackdatePolicyService } from "../spk-backdate-policy/spk-backdate-policy.service";

const terbilang = (angka: number): string => {
    const satuan = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];

    if (angka < 0) return "Minus " + terbilang(-angka);
    if (angka < 12) return satuan[angka];
    if (angka < 20) return satuan[angka - 10] + " Belas";
    if (angka < 100) return satuan[Math.floor(angka / 10)] + " Puluh" + (angka % 10 ? " " + satuan[angka % 10] : "");
    if (angka < 200) return "Seratus" + (angka - 100 ? " " + terbilang(angka - 100) : "");
    if (angka < 1000) return satuan[Math.floor(angka / 100)] + " Ratus" + (angka % 100 ? " " + terbilang(angka % 100) : "");
    if (angka < 2000) return "Seribu" + (angka - 1000 ? " " + terbilang(angka - 1000) : "");
    if (angka < 1_000_000) return terbilang(Math.floor(angka / 1000)) + " Ribu" + (angka % 1000 ? " " + terbilang(angka % 1000) : "");
    if (angka < 1_000_000_000) return terbilang(Math.floor(angka / 1_000_000)) + " Juta" + (angka % 1_000_000 ? " " + terbilang(angka % 1_000_000) : "");
    if (angka < 1_000_000_000_000) return terbilang(Math.floor(angka / 1_000_000_000)) + " Miliar" + (angka % 1_000_000_000 ? " " + terbilang(angka % 1_000_000_000) : "");
    return terbilang(Math.floor(angka / 1_000_000_000_000)) + " Triliun" + (angka % 1_000_000_000_000 ? " " + terbilang(angka % 1_000_000_000_000) : "");
};

async function uploadPdfToDrive(buffer: Buffer, filename: string, nomorUlok?: string | null, namaToko?: string | null, kodeToko?: string | null, cabang?: string | null): Promise<string> {
    const gp = GoogleProvider.instance;
    const drive = gp.spartaDrive;
    if (!drive) throw new AppError("Google Drive (Sparta) belum terkonfigurasi", 500);

    const folderId = await gp.getOrCreateProcessFolder("SPK", nomorUlok, namaToko, kodeToko, cabang);

    const result = await gp.uploadFile(
        folderId,
        filename,
        "application/pdf",
        buffer,
        2,
        drive,
    );

    return result.webViewLink ?? `https://drive.google.com/file/d/${result.id}/view`;
}

async function regenerateSpkPdfAndUpload(
    pengajuanSpkId: string,
    filenameParts?: { proyek?: string | null; nomorUlok?: string | null }
): Promise<string | null> {
    const data = await spkRepository.findById(pengajuanSpkId);
    if (!data) return null;

    const toko = await tokoRepository.findById(data.pengajuan.id_toko);
    if (!toko) return null;

    const pdfBuffer = await buildSpkPdfBuffer({
        pengajuan: data.pengajuan,
        groupMembers: await spkGroupRepository.members(String(data.pengajuan.id)),
        tokoNama: toko.nama_toko,
        tokoKode: toko.kode_toko,
        tokoAlamat: toko.alamat,
        tokoCabang: toko.cabang
    });

    const proyek = filenameParts?.proyek ?? data.pengajuan.proyek ?? "N/A";
    const nomorUlok = filenameParts?.nomorUlok ?? data.pengajuan.nomor_ulok ?? "UNKNOWN";
    const filename = `SPK_${proyek}_${nomorUlok}.pdf`;

    return uploadPdfToDrive(pdfBuffer, filename, nomorUlok, toko.nama_toko, toko.kode_toko, toko.cabang);
}

export const spkService = {
    async submit(payload: SubmitSpkInput, actor?: AuthenticatedUser | null) {
        assertSpkRole(actor, 'submit');
        const createdMembers = await spkGroupRepository.saveSubmission({ ...payload, email_pembuat: actor.email_sat }, {
            terbilang,
            validate: async members => {
                await assertSpkBranches(actor, members.map(m => m.cabang));
                if (!/^[A-Z0-9]{4}$/i.test(payload.kode_toko)) throw new AppError('Kode toko harus 4 karakter alfanumerik', 400);
                const dateText = payload.waktu_mulai.slice(0, 10);
                const start = new Date(dateText + 'T00:00:00Z');
                if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText) || Number.isNaN(start.getTime()) || start.toISOString().slice(0,10) !== dateText) {
                    throw new AppError('Tanggal mulai SPK tidak valid', 400);
                }
                const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
                if (dateText < today && !await spkBackdatePolicyService.canBackdateBranch(members[0].cabang)) {
                    throw new AppError('Cabang ini tidak memiliki izin backdate SPK', 403);
                }
            },
        });
        const created = createdMembers[0];
        const normalizedProject = created.proyek;

        try {
            const linkPdf = await regenerateSpkPdfAndUpload(String(created.id), {
                proyek: normalizedProject ?? payload.proyek,
                nomorUlok: payload.nomor_ulok
            });

            if (linkPdf) {
                await spkGroupRepository.updatePdfLink(String(created.id), linkPdf);
                created.link_pdf = linkPdf;
            }
        } catch (err) {
            console.error("Warning: Gagal upload PDF SPK ke Drive:", err);
        }

        return { ...created, group_members: createdMembers, group_grand_total: createdMembers.reduce((sum, m) => sum + Number(m.grand_total), 0) };
    },

    async candidates(actor: AuthenticatedUser) {
        const { getEffectiveBranchesForUser, normalizeBranchScopeName } = await import('../../common/branch-scope');
        const scope = await getEffectiveBranchesForUser({ emailSat: actor.email_sat, cabang: actor.cabang, roles: actor.roles });
        const allowed = scope.branches.map(normalizeBranchScopeName);
        const sources = await spkGroupRepository.candidates(undefined, undefined, scope.source === 'global' ? undefined : allowed);
        return buildSpkCandidates(sources);
    },

    async list(query: SpkListQuery) {
        return spkRepository.list(query);
    },

    async getById(id: string) {
        const data = await spkRepository.findById(id);
        if (!data) {
            throw new AppError("Pengajuan SPK tidak ditemukan", 404);
        }

        const toko = await tokoRepository.findById(data.pengajuan.id_toko);
        const members = await spkGroupRepository.members(id);

        return {
            ...data,
            pengajuan: {
                ...data.pengajuan,
                group_members: members,
                group_grand_total: members.reduce((sum, member) => sum + Number(member.grand_total), 0),
                toko: {
                    id: toko?.id ?? null,
                    nomor_ulok: toko?.nomor_ulok ?? data.pengajuan.nomor_ulok,
                    kode_toko: toko?.kode_toko ?? null,
                    nama_toko: toko?.nama_toko ?? null,
                    cabang: toko?.cabang ?? null,
                    alamat: toko?.alamat ?? null
                }
            }
        };
    },

    async handleApproval(id: string, action: SpkApprovalInput) {
        const data = await spkRepository.findById(id);
        if (!data) {
            throw new AppError("Pengajuan SPK tidak ditemukan", 404);
        }

        const currentStatus = data.pengajuan.status;

        if (currentStatus !== SPK_STATUS.WAITING_FOR_BM_APPROVAL) {
            throw new AppError(
                `Tindakan sudah diproses. Status saat ini: ${currentStatus}`,
                409
            );
        }

        const newStatus = action.tindakan === "APPROVE"
            ? SPK_STATUS.SPK_APPROVED
            : SPK_STATUS.SPK_REJECTED;

        const members = await spkGroupRepository.transition(id, currentStatus, newStatus, action);

        if (action.tindakan === "APPROVE") {
            for (const member of members) {
                try { await opnameFinalService.refreshDendaByTokoId(member.id_toko); }
                catch (error) { console.error('SPK approved; denda refresh failed for toko', member.id_toko, error); }
            }

            try {
                const linkPdf = await regenerateSpkPdfAndUpload(id, {
                    proyek: data.pengajuan.proyek,
                    nomorUlok: data.pengajuan.nomor_ulok
                });

                if (linkPdf) {
                    await spkGroupRepository.updatePdfLink(id, linkPdf);
                }
            } catch (err) {
                console.error("Warning: Gagal regenerate PDF SPK setelah approval:", err);
            }
        }

        return {
            id,
            old_status: currentStatus,
            new_status: newStatus
        };
    },

    async intervene(id: string, action: SpkInterventionInput) {
        const role = action.actor_role.toUpperCase();
        const isAllowed = role.includes("SUPER HUMAN")
            || role.includes("STORE & BRANCH CONTROLLING");
        if (!isAllowed) {
            throw new AppError("Hanya Super Human atau Store & Branch Controlling Specialist yang dapat melakukan intervensi SPK", 403);
        }

        const data = await spkRepository.findById(id);
        if (!data) {
            throw new AppError("Pengajuan SPK tidak ditemukan", 404);
        }

        const currentStatus = data.pengajuan.status;
        const targetStatus = action.target_status;

        if (currentStatus === targetStatus) {
            throw new AppError(`Status SPK sudah ${targetStatus}`, 409);
        }

        const members = await spkGroupRepository.transition(id, currentStatus, targetStatus, {
            approver_email: action.actor_email, tindakan: targetStatus === SPK_STATUS.SPK_APPROVED ? 'APPROVE' : 'REJECT',
            alasan_penolakan: action.alasan_intervensi,
        }, action);
        for (const member of members) {
            try { await opnameFinalService.refreshDendaByTokoId(member.id_toko); }
            catch (error) { console.error('SPK intervention committed; denda refresh failed for toko', member.id_toko, error); }
        }

        if (targetStatus === SPK_STATUS.SPK_APPROVED) {
            try {
                const linkPdf = await regenerateSpkPdfAndUpload(id, {
                    proyek: data.pengajuan.proyek,
                    nomorUlok: data.pengajuan.nomor_ulok
                });

                if (linkPdf) {
                    await spkGroupRepository.updatePdfLink(id, linkPdf);
                }
            } catch (err) {
                console.error("Warning: Gagal regenerate PDF SPK setelah intervensi:", err);
            }
        }

        return {
            id,
            old_status: currentStatus,
            new_status: targetStatus
        };
    },

    async generatePdf(id: string) {
        const data = await spkRepository.findById(id);
        if (!data) {
            throw new AppError("Pengajuan SPK tidak ditemukan", 404);
        }

        const toko = await tokoRepository.findById(data.pengajuan.id_toko);
        if (!toko) {
            throw new AppError("Data toko tidak ditemukan", 404);
        }

        const pdfBuffer = await buildSpkPdfBuffer({
            pengajuan: data.pengajuan,
            groupMembers: await spkGroupRepository.members(String(data.pengajuan.id)),
            tokoNama: toko.nama_toko,
            tokoKode: toko.kode_toko,
            tokoAlamat: toko.alamat,
            tokoCabang: toko.cabang
        });

        const filename = `SPK_${data.pengajuan.proyek}_${data.pengajuan.nomor_ulok}.pdf`;
        return { filename, pdfBuffer };
    }
};
