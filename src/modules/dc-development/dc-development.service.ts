import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
import { pool } from "../../db/pool";
import { DC_MEMBER_ACCESS_LEVEL, DC_PROJECT_STAGE_SEQUENCE, DC_ROLES, type DcMemberAccessLevel } from "./dc-development.constants";
import { dcDevelopmentRepository, type DcDocumentRow } from "./dc-development.repository";
import type {
    AdvanceDcProjectStageInput,
    CreateDcArchiveProjectInput,
    CreateDcDocumentInput,
    CreateDcProjectInput,
    CreateDcTenderInput,
    CreateDcVendorInput,
    CreateDcVendorUserInput,
    DcApprovalListQuery,
    DcArchiveProjectListQuery,
    DcDocumentActorQuery,
    DcDocumentListQuery,
    DcProjectListQuery,
    UpdateDcDocumentInput
} from "./dc-development.schema";

export type UploadedDcDocumentFile = Express.Multer.File;

const MAX_UPLOAD_CONCURRENCY = 3;
const RESUMABLE_THRESHOLD_BYTES = 10 * 1024 * 1024;

const accessRank: Record<DcMemberAccessLevel, number> = {
    VIEW: 1,
    UPLOAD: 2,
    MANAGE: 3
};

const hasSuperHumanRole = (role?: string | null): boolean =>
    String(role ?? "").toUpperCase().includes(DC_ROLES.SUPER_HUMAN);

const hasDcDocumentAdminRole = (role?: string | null): boolean =>
    String(role ?? "").toUpperCase().includes(DC_ROLES.DC_DOCUMENT_ADMIN);

const canBypassDocumentAccess = (role?: string | null): boolean =>
    hasSuperHumanRole(role) || hasDcDocumentAdminRole(role);

const canCreateArchiveProject = (role?: string | null): boolean => {
    const normalized = String(role ?? "").toUpperCase();
    return hasSuperHumanRole(normalized)
        || hasDcDocumentAdminRole(normalized)
        || normalized.includes(DC_ROLES.DC_MANAGER)
        || normalized.includes(DC_ROLES.DC_SPECIALIST);
};

const sanitizeFilenamePart = (value: string | null | undefined, fallback: string): string => {
    const normalized = String(value ?? "").trim().replace(/[^a-zA-Z0-9_-]+/g, "_");
    return normalized || fallback;
};

const resolveFileExtension = (file: UploadedDcDocumentFile): string => {
    const rawName = file.originalname ?? "";
    const lastDot = rawName.lastIndexOf(".");
    if (lastDot > 0 && lastDot < rawName.length - 1) {
        const ext = rawName.slice(lastDot).toLowerCase();
        if (/^\.[a-z0-9]{1,10}$/.test(ext)) return ext;
    }
    if (file.mimetype === "application/pdf") return ".pdf";
    if (file.mimetype === "application/msword") return ".doc";
    if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return ".docx";
    if (file.mimetype === "application/vnd.ms-excel") return ".xls";
    if (file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return ".xlsx";
    if (file.mimetype === "image/jpeg") return ".jpg";
    if (file.mimetype === "image/png") return ".png";
    if (file.mimetype === "image/webp") return ".webp";
    return ".bin";
};

const resolveDriveLink = (fileId?: string | null, webViewLink?: string | null): string => {
    if (webViewLink) return webViewLink;
    if (fileId) return `https://drive.google.com/file/d/${fileId}/view`;
    return "";
};

const buildFolderLink = (folderId: string) => `https://drive.google.com/drive/folders/${folderId}`;

const runWithConcurrency = async <T, R>(
    items: T[],
    limit: number,
    handler: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
    const results = new Array<R>(items.length);
    let nextIndex = 0;
    const workerCount = Math.min(Math.max(limit, 1), items.length);
    await Promise.all(Array.from({ length: workerCount }, async () => {
        while (true) {
            const current = nextIndex;
            nextIndex += 1;
            if (current >= items.length) return;
            results[current] = await handler(items[current], current);
        }
    }));
    return results;
};

const ensureDcDocDriveReady = () => {
    const root = env.DC_DOC_DRIVE_ROOT_ID || env.DOC_DRIVE_ROOT_ID;
    if (!root) throw new AppError("DC_DOC_DRIVE_ROOT_ID atau DOC_DRIVE_ROOT_ID belum diset", 500);
    return { gp: GoogleProvider.instance, root };
};

const ensureAccess = async (
    projectId: number,
    actor: { email: string; role: string },
    required: DcMemberAccessLevel
) => {
    if (canBypassDocumentAccess(actor.role)) return;
    const member = await dcDevelopmentRepository.findProjectMember(projectId, actor.email);
    if (!member || accessRank[member.access_level] < accessRank[required]) {
        throw new AppError("Anda tidak terlibat atau tidak memiliki akses ke dokumen DC ini", 403);
    }
};

const uploadFilesToDrive = async (
    input: CreateDcDocumentInput,
    project: { project_code: string; project_name: string },
    files: UploadedDcDocumentFile[]
) => {
    const { gp, root } = ensureDcDocDriveReady();
    const dcRootFolder = await gp.getOrCreateFolder("DC Development", root);
    const projectFolder = await gp.getOrCreateFolder(
        `${sanitizeFilenamePart(project.project_code, "DC")}_${sanitizeFilenamePart(project.project_name, "PROJECT")}`,
        dcRootFolder
    );
    const stageFolder = await gp.getOrCreateFolder(
        sanitizeFilenamePart(input.stage ?? input.entity_type, "PROJECT"),
        projectFolder
    );
    const documentFolder = await gp.getOrCreateFolder(
        sanitizeFilenamePart(input.document_type, "DOKUMEN"),
        stageFolder
    );
    const folderLink = buildFolderLink(documentFolder);
    const safeDoc = sanitizeFilenamePart(input.document_type, "DOKUMEN");
    const safeProject = sanitizeFilenamePart(project.project_code, "DC");
    const timestamp = Date.now();

    return runWithConcurrency(files, MAX_UPLOAD_CONCURRENCY, async (file, index) => {
        const ext = resolveFileExtension(file);
        const filename = `${safeDoc}_${safeProject}_${timestamp}_${index + 1}${ext}`;
        const mimeType = file.mimetype || "application/octet-stream";
        const useResumable = (file.size ?? 0) >= RESUMABLE_THRESHOLD_BYTES;
        const uploaded = useResumable
            ? await gp.uploadFileResumable(documentFolder, filename, mimeType, file.buffer, undefined, undefined, { makePublic: false })
            : await gp.uploadFile(documentFolder, filename, mimeType, file.buffer, undefined, undefined, { makePublic: false });
        const link = resolveDriveLink(uploaded.id ?? null, uploaded.webViewLink ?? null);
        if (!uploaded.id || !link) throw new AppError("Upload dokumen DC ke Google Drive gagal", 500);

        return {
            drive_file_id: uploaded.id,
            drive_folder_id: documentFolder,
            link_dokumen: link,
            link_folder: folderLink,
            file_name: file.originalname || filename,
            mime_type: mimeType,
            size_bytes: file.size ?? null,
            notes: input.notes ?? null,
            uploaded_by_email: input.actor_email,
            uploaded_by_role: input.actor_role
        };
    });
};

export const dcDevelopmentService = {
    listArchiveProjects(filter: DcArchiveProjectListQuery) {
        return dcDevelopmentRepository.listArchiveProjects(filter, canBypassDocumentAccess(filter.actor_role));
    },

    async createArchiveProject(input: CreateDcArchiveProjectInput) {
        if (!canCreateArchiveProject(input.actor_role)) {
            throw new AppError("Hanya Super Human, DC Manager, DC Specialist, atau DC Document Admin yang dapat menambah data arsip DC", 403);
        }

        try {
            return await dcDevelopmentRepository.createArchiveProject(input);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Gagal membuat arsip dokumen DC";
            if (message.includes("duplicate key")) {
                throw new AppError("Kode arsip/project DC sudah terdaftar", 409);
            }
            throw new AppError(message, 400);
        }
    },

    listProjects(filter: DcProjectListQuery) {
        if (hasSuperHumanRole(filter.actor_role)) {
            return dcDevelopmentRepository.listProjects({ ...filter, actor_email: undefined });
        }
        return dcDevelopmentRepository.listProjects(filter);
    },

    createProject(input: CreateDcProjectInput) {
        return dcDevelopmentRepository.createProject(input);
    },

    async getProjectById(id: string) {
        const projectId = Number(id);
        if (!Number.isInteger(projectId) || projectId <= 0) {
            throw new AppError("ID project DC tidak valid", 400);
        }

        const project = await dcDevelopmentRepository.findProjectById(projectId);
        if (!project) throw new AppError("Project DC tidak ditemukan", 404);

        return {
            project,
            stage_sequence: DC_PROJECT_STAGE_SEQUENCE
        };
    },

    async advanceProjectStage(id: string, input: AdvanceDcProjectStageInput) {
        const projectId = Number(id);
        if (!Number.isInteger(projectId) || projectId <= 0) {
            throw new AppError("ID project DC tidak valid", 400);
        }

        try {
            return await dcDevelopmentRepository.advanceProjectStage({
                id: projectId,
                ...input
            });
        } catch (error) {
            throw new AppError(error instanceof Error ? error.message : "Gagal memajukan stage project DC", 400);
        }
    },

    async createTender(projectIdRaw: string, input: CreateDcTenderInput) {
        const projectId = Number(projectIdRaw);
        if (!Number.isInteger(projectId) || projectId <= 0) {
            throw new AppError("ID project DC tidak valid", 400);
        }

        const project = await dcDevelopmentRepository.findProjectById(projectId);
        if (!project) throw new AppError("Project DC tidak ditemukan", 404);

        try {
            return await dcDevelopmentRepository.createTender(projectId, input);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Gagal membuat tender DC";
            if (message.includes("duplicate key")) {
                throw new AppError("Tender untuk tipe tersebut sudah ada pada project ini", 409);
            }
            throw new AppError(message, 400);
        }
    },

    async listTenders(filter: { project_id?: number; tender_type?: string; status?: string }) {
        return dcDevelopmentRepository.listTenders(filter);
    },

    async getTenderById(id: string) {
        const tenderId = Number(id);
        if (!Number.isInteger(tenderId) || tenderId <= 0) {
            throw new AppError("ID tender DC tidak valid", 400);
        }
        const tender = await dcDevelopmentRepository.getTenderById(tenderId);
        if (!tender) throw new AppError("Tender DC tidak ditemukan", 404);
        
        const participants = await dcDevelopmentRepository.listTenderParticipants(tenderId);
        const submissions = await dcDevelopmentRepository.listTenderSubmissions(tenderId);

        return {
            tender,
            participants: participants.map(p => ({
                ...p,
                submissions: submissions.filter(s => s.participant_id === p.id)
            }))
        };
    },

    async inviteTenderParticipant(tenderIdRaw: string, input: any) {
        const tenderId = Number(tenderIdRaw);
        if (!Number.isInteger(tenderId) || tenderId <= 0) {
            throw new AppError("ID tender DC tidak valid", 400);
        }

        const tender = await dcDevelopmentRepository.getTenderById(tenderId);
        if (!tender) throw new AppError("Tender DC tidak ditemukan", 404);
        if (tender.status === 'COMPLETED') throw new AppError("Tender sudah selesai", 400);

        try {
            return await dcDevelopmentRepository.inviteTenderParticipant(tenderId, input.vendor_company_id, input.invited_by_email);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Gagal mengundang vendor";
            if (message.includes("duplicate key")) {
                throw new AppError("Vendor ini sudah diundang ke tender ini", 409);
            }
            throw new AppError(message, 400);
        }
    },

    async submitTenderSubmission(tenderIdRaw: string, input: any) {
        const tenderId = Number(tenderIdRaw);
        if (!Number.isInteger(tenderId) || tenderId <= 0) {
            throw new AppError("ID tender DC tidak valid", 400);
        }

        const tender = await dcDevelopmentRepository.getTenderById(tenderId);
        if (!tender) throw new AppError("Tender DC tidak ditemukan", 404);
        if (tender.status === 'COMPLETED') throw new AppError("Tender sudah selesai", 400);

        // If participant_id is provided directly, use it (for internal user / testing)
        if (input.participant_id) {
            const partResult = await pool.query(
                `SELECT id FROM dc_tender_participant WHERE id = $1 AND tender_id = $2`,
                [input.participant_id, tenderId]
            );
            if (partResult.rows.length === 0) throw new AppError("Participant tidak valid", 400);
            return await dcDevelopmentRepository.submitTenderSubmission(input.participant_id, tender, input);
        }

        // Find participant via vendor user email
        if (!input.submitted_by_email) throw new AppError("Email wajib diisi", 400);

        const vendorResult = await pool.query(
            `SELECT vendor_company_id FROM dc_vendor_user WHERE LOWER(email) = LOWER($1)`,
            [input.submitted_by_email]
        );

        if (vendorResult.rows.length === 0) {
            throw new AppError("User vendor tidak ditemukan", 404);
        }

        const vendorCompanyId = vendorResult.rows[0].vendor_company_id;
        const participantResult = await pool.query(
            `SELECT id FROM dc_tender_participant WHERE tender_id = $1 AND vendor_company_id = $2`,
            [tenderId, vendorCompanyId]
        );

        if (participantResult.rows.length === 0) {
            throw new AppError("Vendor belum diundang ke tender ini", 403);
        }

        const participantId = participantResult.rows[0].id;
        return await dcDevelopmentRepository.submitTenderSubmission(participantId, tender, input);
    },

    async setTenderWinner(tenderIdRaw: string, input: any) {
        const tenderId = Number(tenderIdRaw);
        if (!Number.isInteger(tenderId) || tenderId <= 0) {
            throw new AppError("ID tender DC tidak valid", 400);
        }

        const tender = await dcDevelopmentRepository.getTenderById(tenderId);
        if (!tender) throw new AppError("Tender DC tidak ditemukan", 404);
        if (tender.status === 'COMPLETED') throw new AppError("Tender sudah selesai", 400);

        return await dcDevelopmentRepository.setTenderWinner(tenderId, input.participant_id, input.actor_email, input.actor_role);
    },

    async listProjectTimelines(projectIdRaw: string) {
        const projectId = Number(projectIdRaw);
        if (!Number.isInteger(projectId) || projectId <= 0) {
            throw new AppError("ID project DC tidak valid", 400);
        }
        return await dcDevelopmentRepository.listProjectTimelines(projectId);
    },

    async addProjectTimeline(projectIdRaw: string, input: any) {
        const projectId = Number(projectIdRaw);
        if (!Number.isInteger(projectId) || projectId <= 0) {
            throw new AppError("ID project DC tidak valid", 400);
        }
        const project = await dcDevelopmentRepository.findProjectById(projectId);
        if (!project) throw new AppError("Project DC tidak ditemukan", 404);

        return await dcDevelopmentRepository.addProjectTimeline(projectId, input);
    },

    async updateProjectTimeline(taskIdRaw: string, input: any) {
        const taskId = Number(taskIdRaw);
        if (!Number.isInteger(taskId) || taskId <= 0) {
            throw new AppError("ID task timeline tidak valid", 400);
        }
        return await dcDevelopmentRepository.updateProjectTimeline(taskId, input);
    },

    async listProjectIssues(projectIdRaw: string) {
        const projectId = Number(projectIdRaw);
        if (!Number.isInteger(projectId) || projectId <= 0) {
            throw new AppError("ID project DC tidak valid", 400);
        }
        return await dcDevelopmentRepository.listProjectIssues(projectId);
    },

    async addProjectIssue(projectIdRaw: string, input: any) {
        const projectId = Number(projectIdRaw);
        if (!Number.isInteger(projectId) || projectId <= 0) {
            throw new AppError("ID project DC tidak valid", 400);
        }
        const project = await dcDevelopmentRepository.findProjectById(projectId);
        if (!project) throw new AppError("Project DC tidak ditemukan", 404);

        return await dcDevelopmentRepository.addProjectIssue(projectId, input);
    },

    async updateProjectIssue(issueIdRaw: string, input: any) {
        const issueId = Number(issueIdRaw);
        if (!Number.isInteger(issueId) || issueId <= 0) {
            throw new AppError("ID issue tidak valid", 400);
        }
        return await dcDevelopmentRepository.updateProjectIssue(issueId, input);
    },

    async listProjectBast(projectIdRaw: string) {
        const projectId = Number(projectIdRaw);
        if (!Number.isInteger(projectId) || projectId <= 0) {
            throw new AppError("ID project DC tidak valid", 400);
        }
        return await dcDevelopmentRepository.listProjectBast(projectId);
    },

    async createProjectBast(projectIdRaw: string, input: any) {
        const projectId = Number(projectIdRaw);
        if (!Number.isInteger(projectId) || projectId <= 0) {
            throw new AppError("ID project DC tidak valid", 400);
        }
        const project = await dcDevelopmentRepository.findProjectById(projectId);
        if (!project) throw new AppError("Project DC tidak ditemukan", 404);

        return await dcDevelopmentRepository.createProjectBast(projectId, input);
    },

    async updateProjectBast(bastIdRaw: string, input: any) {
        const bastId = Number(bastIdRaw);
        if (!Number.isInteger(bastId) || bastId <= 0) {
            throw new AppError("ID BAST tidak valid", 400);
        }
        return await dcDevelopmentRepository.updateProjectBast(bastId, input);
    },

    async listParticipantTerms(participantIdRaw: string) {
        const participantId = Number(participantIdRaw);
        if (!Number.isInteger(participantId) || participantId <= 0) {
            throw new AppError("ID participant tidak valid", 400);
        }
        return await dcDevelopmentRepository.listParticipantTerms(participantId);
    },

    async addTermSchedule(participantIdRaw: string, input: any) {
        const participantId = Number(participantIdRaw);
        if (!Number.isInteger(participantId) || participantId <= 0) {
            throw new AppError("ID participant tidak valid", 400);
        }
        // In real app, might want to validate total percentage doesn't exceed 100%
        return await dcDevelopmentRepository.addTermSchedule(participantId, input);
    },

    async submitTermClaim(termIdRaw: string, input: any) {
        const termId = Number(termIdRaw);
        if (!Number.isInteger(termId) || termId <= 0) {
            throw new AppError("ID term schedule tidak valid", 400);
        }
        return await dcDevelopmentRepository.submitTermClaim(termId, input);
    },

    listVendors() {
        return dcDevelopmentRepository.listVendors();
    },

    createVendor(input: CreateDcVendorInput) {
        return dcDevelopmentRepository.createVendor(input);
    },

    async createVendorUser(vendorIdRaw: string, input: CreateDcVendorUserInput) {
        const vendorId = Number(vendorIdRaw);
        if (!Number.isInteger(vendorId) || vendorId <= 0) {
            throw new AppError("ID vendor DC tidak valid", 400);
        }

        try {
            return await dcDevelopmentRepository.createVendorUser(vendorId, input);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Gagal membuat user vendor";
            if (message.includes("duplicate key")) {
                throw new AppError("Email user vendor sudah terdaftar pada vendor ini", 409);
            }
            throw new AppError(message, 400);
        }
    },

    listApprovals(filter: DcApprovalListQuery) {
        return dcDevelopmentRepository.listApprovals(filter);
    },

    listDocuments(filter: DcDocumentListQuery) {
        return dcDevelopmentRepository.listDocuments(filter, canBypassDocumentAccess(filter.actor_role));
    },

    async createDocument(input: CreateDcDocumentInput, files: UploadedDcDocumentFile[]) {
        if (files.length === 0) throw new AppError("Dokumen wajib diupload", 400);
        const project = await dcDevelopmentRepository.findProjectById(input.project_id);
        if (!project) throw new AppError("Project DC tidak ditemukan", 404);

        await ensureAccess(input.project_id, { email: input.actor_email, role: input.actor_role }, DC_MEMBER_ACCESS_LEVEL.UPLOAD);
        try {
            await dcDevelopmentRepository.validateDocumentRelations(input);
        } catch (error) {
            throw new AppError(error instanceof Error ? error.message : "Relasi dokumen DC tidak valid", 409);
        }

        const versions = await uploadFilesToDrive(input, project, files);
        const items: DcDocumentRow[] = [];
        for (const version of versions) {
            const item = await dcDevelopmentRepository.createDocumentWithVersion({
                project_id: input.project_id,
                tender_id: input.tender_id ?? null,
                participant_id: input.participant_id ?? null,
                entity_type: input.entity_type,
                entity_id: input.entity_id ?? null,
                document_type: input.document_type,
                stage: input.stage ?? null,
                created_by_email: input.actor_email
            }, version);
            items.push(item);
        }

        return {
            folder: versions[0] ? {
                id: versions[0].drive_folder_id,
                link: versions[0].link_folder
            } : null,
            items
        };
    },

    async getDocumentDetail(id: string, actor: DcDocumentActorQuery) {
        const documentId = Number(id);
        if (!Number.isInteger(documentId) || documentId <= 0) {
            throw new AppError("ID dokumen DC tidak valid", 400);
        }

        const document = await dcDevelopmentRepository.findDocumentById(documentId);
        if (!document) throw new AppError("Dokumen DC tidak ditemukan", 404);
        if (!document.project_id) throw new AppError("Dokumen DC tidak terhubung ke project", 409);
        await ensureAccess(document.project_id, { email: actor.actor_email, role: actor.actor_role }, DC_MEMBER_ACCESS_LEVEL.VIEW);
        return document;
    },

    async updateDocument(id: string, input: UpdateDcDocumentInput, files: UploadedDcDocumentFile[]) {
        const document = await this.getDocumentDetail(id, {
            actor_email: input.actor_email,
            actor_role: input.actor_role
        });
        if (!document.project_id) throw new AppError("Dokumen DC tidak terhubung ke project", 409);

        const hasMetadataUpdate = typeof input.document_type !== "undefined" || typeof input.stage !== "undefined";
        if (hasMetadataUpdate) {
            await ensureAccess(document.project_id, { email: input.actor_email, role: input.actor_role }, DC_MEMBER_ACCESS_LEVEL.MANAGE);
        }

        let updated = hasMetadataUpdate
            ? await dcDevelopmentRepository.updateDocumentMetadata(document.id, {
                document_type: input.document_type,
                stage: input.stage
            })
            : document;

        if (files.length > 0) {
            await ensureAccess(document.project_id, { email: input.actor_email, role: input.actor_role }, DC_MEMBER_ACCESS_LEVEL.UPLOAD);
            const project = await dcDevelopmentRepository.findProjectById(document.project_id);
            if (!project) throw new AppError("Project DC tidak ditemukan", 404);
            const uploadInput: CreateDcDocumentInput = {
                project_id: document.project_id,
                tender_id: document.tender_id ?? undefined,
                participant_id: document.participant_id ?? undefined,
                entity_type: document.entity_type,
                entity_id: document.entity_id ?? undefined,
                document_type: input.document_type ?? document.document_type,
                stage: input.stage ?? document.stage ?? undefined,
                notes: input.notes,
                actor_email: input.actor_email,
                actor_role: input.actor_role
            };
            const [version] = await uploadFilesToDrive(uploadInput, project, [files[0]]);
            updated = await dcDevelopmentRepository.addDocumentVersion(document.id, version);
        }

        if (!updated) throw new AppError("Dokumen DC tidak ditemukan", 404);
        return updated;
    },

    async deleteDocument(id: string, actor: DcDocumentActorQuery) {
        const document = await this.getDocumentDetail(id, actor);
        if (!document.project_id) throw new AppError("Dokumen DC tidak terhubung ke project", 409);
        await ensureAccess(document.project_id, { email: actor.actor_email, role: actor.actor_role }, DC_MEMBER_ACCESS_LEVEL.MANAGE);
        const deleted = await dcDevelopmentRepository.softDeleteDocument(document.id, {
            email: actor.actor_email,
            role: actor.actor_role
        });
        if (!deleted) throw new AppError("Dokumen DC tidak ditemukan", 404);
        return deleted;
    },

    async getDocumentFile(id: string, actor: DcDocumentActorQuery) {
        const document = await this.getDocumentDetail(id, actor);
        if (!document.drive_file_id) throw new AppError("File dokumen DC tidak ditemukan", 404);
        const gp = GoogleProvider.instance;
        if (!gp.docDrive) throw new AppError("Service Dokumen belum siap", 500);
        const buffer = await gp.getFileBufferById(gp.docDrive, document.drive_file_id);
        return {
            document,
            buffer,
            link: document.link_dokumen
        };
    }
};
