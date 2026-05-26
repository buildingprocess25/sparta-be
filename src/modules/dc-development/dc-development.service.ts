import { AppError } from "../../common/app-error";
import { DC_PROJECT_STAGE_SEQUENCE } from "./dc-development.constants";
import { dcDevelopmentRepository } from "./dc-development.repository";
import type {
    AdvanceDcProjectStageInput,
    CreateDcProjectInput,
    CreateDcTenderInput,
    CreateDcVendorInput,
    CreateDcVendorUserInput,
    DcApprovalListQuery,
    DcDocumentListQuery,
    DcProjectListQuery
} from "./dc-development.schema";

export const dcDevelopmentService = {
    listProjects(filter: DcProjectListQuery) {
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
        return dcDevelopmentRepository.listDocuments(filter);
    },

    getDocumentProxyPlaceholder(id: string, mode: "view" | "download") {
        const documentId = Number(id);
        if (!Number.isInteger(documentId) || documentId <= 0) {
            throw new AppError("ID dokumen DC tidak valid", 400);
        }

        throw new AppError(
            `Proxy ${mode} dokumen DC belum aktif. Metadata dokumen sudah disiapkan; integrasi streaming Google Drive dikerjakan pada tahap file upload.`,
            501
        );
    }
};
