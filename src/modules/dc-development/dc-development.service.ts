import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
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

const canCreateArchiveProject = (role?: string | null): boolean => {
    const normalized = String(role ?? "").toUpperCase();
    return hasSuperHumanRole(normalized)
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
    if (hasSuperHumanRole(actor.role)) return;
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
            ? await gp.uploadFileResumable(documentFolder, filename, mimeType, file.buffer)
            : await gp.uploadFile(documentFolder, filename, mimeType, file.buffer);
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
        return dcDevelopmentRepository.listArchiveProjects(filter, hasSuperHumanRole(filter.actor_role));
    },

    async createArchiveProject(input: CreateDcArchiveProjectInput) {
        if (!canCreateArchiveProject(input.actor_role)) {
            throw new AppError("Hanya Super Human, DC Manager, atau DC Specialist yang dapat menambah data arsip DC", 403);
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
        return dcDevelopmentRepository.listDocuments(filter, hasSuperHumanRole(filter.actor_role));
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
