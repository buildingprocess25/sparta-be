import type { PoolClient } from "pg";
import { pool, withTransaction } from "../../db/pool";
import {
    DC_MEMBER_ACCESS_LEVEL,
    DC_MEMBER_TYPE,
    DC_PROJECT_STAGE_SEQUENCE,
    DC_PROJECT_STATUS,
    DC_TENDER_STATUS,
    type DcMemberAccessLevel,
    type DcProjectStatus
} from "./dc-development.constants";
import type {
    CreateDcProjectInput,
    CreateDcTenderInput,
    CreateDcVendorInput,
    CreateDcVendorUserInput,
    DcApprovalListQuery,
    DcDocumentListQuery,
    DcProjectListQuery
} from "./dc-development.schema";

export type DcProjectRow = {
    id: number;
    project_code: string;
    project_name: string;
    location_name: string | null;
    branch_name: string | null;
    address: string | null;
    area_size: string | null;
    status: DcProjectStatus;
    current_stage: DcProjectStatus;
    created_by_email: string | null;
    created_by_role: string | null;
    created_at: string;
    updated_at: string;
};

export type DcVendorCompanyRow = {
    id: number;
    company_name: string;
    npwp: string | null;
    address: string | null;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    status: string;
    created_by_email: string | null;
    created_at: string;
    updated_at: string;
    service_types?: string[];
};

export type DcTenderRow = {
    id: number;
    project_id: number;
    tender_type: string;
    status: string;
    title: string;
    owner_estimate_amount: string | null;
    oe_tolerance_percent: string;
    winner_participant_id: number | null;
    created_by_email: string | null;
    created_at: string;
    updated_at: string;
};

export type DcProjectMemberRow = {
    id: number;
    project_id: number;
    email: string;
    role: string | null;
    member_type: string;
    access_level: DcMemberAccessLevel;
    source_entity_type: string | null;
    source_entity_id: number | null;
    created_at: string;
    updated_at: string;
};

export type DcDocumentRow = {
    id: number;
    project_id: number | null;
    tender_id: number | null;
    participant_id: number | null;
    entity_type: string;
    entity_id: number | null;
    document_type: string;
    stage: string | null;
    status: string;
    created_by_email: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    current_version_id: number | null;
    version_no: number | null;
    drive_file_id: string | null;
    drive_folder_id: string | null;
    link_dokumen: string | null;
    link_folder: string | null;
    file_name: string | null;
    mime_type: string | null;
    size_bytes: string | null;
    notes: string | null;
    uploaded_by_email: string | null;
    uploaded_by_role: string | null;
    version_created_at: string | null;
    project_code: string | null;
    project_name: string | null;
};

export type DcUploadedDocumentVersion = {
    drive_file_id: string;
    drive_folder_id: string | null;
    link_dokumen: string;
    link_folder: string | null;
    file_name: string;
    mime_type: string | null;
    size_bytes: number | null;
    notes?: string | null;
    uploaded_by_email: string;
    uploaded_by_role: string;
};

const DC_PROJECT_COLUMNS = `
    id, project_code, project_name, location_name, branch_name, address,
    area_size, status, current_stage, created_by_email, created_by_role,
    created_at, updated_at
`;

const DC_DOCUMENT_SELECT = `
    d.id, d.project_id, d.tender_id, d.participant_id, d.entity_type, d.entity_id,
    d.document_type, d.stage, d.status, d.created_by_email, d.created_at, d.updated_at, d.deleted_at,
    v.id AS current_version_id,
    v.version_no,
    v.drive_file_id,
    v.drive_folder_id,
    v.link_dokumen,
    v.link_folder,
    v.file_name,
    v.mime_type,
    v.size_bytes,
    v.notes,
    v.uploaded_by_email,
    v.uploaded_by_role,
    v.created_at AS version_created_at,
    p.project_code,
    p.project_name
`;

const insertActivityLog = async (
    client: PoolClient,
    input: {
        project_id?: number | null;
        entity_type: string;
        entity_id?: number | null;
        actor_email?: string | null;
        actor_role?: string | null;
        action: string;
        status_before?: string | null;
        status_after?: string | null;
        reason?: string | null;
        metadata?: Record<string, unknown> | null;
    }
) => {
    await client.query(
        `INSERT INTO dc_activity_log (
            project_id, entity_type, entity_id, actor_email, actor_role,
            action, status_before, status_after, reason, metadata, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb, timezone('Asia/Jakarta', now()))`,
        [
            input.project_id ?? null,
            input.entity_type,
            input.entity_id ?? null,
            input.actor_email ?? null,
            input.actor_role ?? null,
            input.action,
            input.status_before ?? null,
            input.status_after ?? null,
            input.reason ?? null,
            input.metadata ? JSON.stringify(input.metadata) : null
        ]
    );
};

export const dcDevelopmentRepository = {
    async listProjects(filter: DcProjectListQuery): Promise<DcProjectRow[]> {
        const conditions: string[] = [];
        const values: unknown[] = [];
        const joins: string[] = [];

        if (filter.status) {
            values.push(filter.status);
            conditions.push(`status = $${values.length}`);
        }
        if (filter.current_stage) {
            values.push(filter.current_stage);
            conditions.push(`current_stage = $${values.length}`);
        }
        if (filter.branch_name) {
            values.push(filter.branch_name);
            conditions.push(`branch_name = $${values.length}`);
        }
        if (filter.search) {
            values.push(`%${filter.search}%`);
            conditions.push(`(project_code ILIKE $${values.length} OR project_name ILIKE $${values.length} OR COALESCE(location_name, '') ILIKE $${values.length})`);
        }
        if (filter.actor_email) {
            values.push(filter.actor_email);
            joins.push(`JOIN dc_project_member m ON m.project_id = dc_project.id AND LOWER(m.email) = LOWER($${values.length})`);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        const result = await pool.query<DcProjectRow>(
            `SELECT ${DC_PROJECT_COLUMNS}
             FROM dc_project
             ${joins.join("\n")}
             ${whereClause}
             ORDER BY updated_at DESC, id DESC`,
            values
        );

        return result.rows;
    },

    async createProject(input: CreateDcProjectInput): Promise<DcProjectRow> {
        return withTransaction(async (client) => {
            const result = await client.query<DcProjectRow>(
                `INSERT INTO dc_project (
                    project_code, project_name, location_name, branch_name, address,
                    area_size, status, current_stage, created_by_email, created_by_role,
                    created_at, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, timezone('Asia/Jakarta', now()), timezone('Asia/Jakarta', now()))
                RETURNING ${DC_PROJECT_COLUMNS}`,
                [
                    input.project_code,
                    input.project_name,
                    input.location_name ?? null,
                    input.branch_name ?? null,
                    input.address ?? null,
                    input.area_size ?? null,
                    DC_PROJECT_STATUS.PROJECT_CREATED,
                    DC_PROJECT_STATUS.PROJECT_CREATED,
                    input.created_by_email ?? null,
                    input.created_by_role ?? null
                ]
            );

            const project = result.rows[0];
            if (input.created_by_email) {
                await this.upsertProjectMember(client, {
                    project_id: project.id,
                    email: input.created_by_email,
                    role: input.created_by_role ?? null,
                    member_type: DC_MEMBER_TYPE.INTERNAL,
                    access_level: DC_MEMBER_ACCESS_LEVEL.MANAGE,
                    source_entity_type: "DC_PROJECT",
                    source_entity_id: project.id
                });
            }

            await insertActivityLog(client, {
                project_id: project.id,
                entity_type: "DC_PROJECT",
                entity_id: project.id,
                actor_email: input.created_by_email,
                actor_role: input.created_by_role,
                action: "CREATE_PROJECT",
                status_after: project.status
            });

            return project;
        });
    },

    async findProjectById(id: number): Promise<DcProjectRow | null> {
        const result = await pool.query<DcProjectRow>(
            `SELECT ${DC_PROJECT_COLUMNS}
             FROM dc_project
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        return result.rows[0] ?? null;
    },

    async advanceProjectStage(input: {
        id: number;
        actor_email: string;
        actor_role: string;
        reason?: string;
        target_stage?: DcProjectStatus;
        is_intervention?: boolean;
    }): Promise<DcProjectRow> {
        return withTransaction(async (client) => {
            const currentRes = await client.query<DcProjectRow>(
                `SELECT ${DC_PROJECT_COLUMNS}
                 FROM dc_project
                 WHERE id = $1
                 FOR UPDATE`,
                [input.id]
            );

            const current = currentRes.rows[0];
            if (!current) throw new Error(`DC project dengan id ${input.id} tidak ditemukan`);

            const currentIndex = DC_PROJECT_STAGE_SEQUENCE.indexOf(current.current_stage);
            const nextStage = input.target_stage ?? DC_PROJECT_STAGE_SEQUENCE[currentIndex + 1];
            if (!nextStage) return current;

            const targetIndex = DC_PROJECT_STAGE_SEQUENCE.indexOf(nextStage);
            const isNextStage = targetIndex === currentIndex + 1;
            if (!isNextStage && !input.is_intervention) {
                throw new Error("Perubahan stage tidak berurutan wajib memakai intervensi");
            }
            if (!isNextStage && input.is_intervention && !input.reason?.trim()) {
                throw new Error("Alasan intervensi wajib diisi");
            }

            const updatedRes = await client.query<DcProjectRow>(
                `UPDATE dc_project
                 SET current_stage = $1,
                     status = $1,
                     updated_at = timezone('Asia/Jakarta', now())
                 WHERE id = $2
                 RETURNING ${DC_PROJECT_COLUMNS}`,
                [nextStage, input.id]
            );
            const updated = updatedRes.rows[0];

            await insertActivityLog(client, {
                project_id: input.id,
                entity_type: "DC_PROJECT",
                entity_id: input.id,
                actor_email: input.actor_email,
                actor_role: input.actor_role,
                action: input.is_intervention ? "INTERVENE_STAGE" : "ADVANCE_STAGE",
                status_before: current.current_stage,
                status_after: updated.current_stage,
                reason: input.reason ?? null,
                metadata: { target_stage: input.target_stage ?? null }
            });

            return updated;
        });
    },

    async createTender(projectId: number, input: CreateDcTenderInput): Promise<DcTenderRow> {
        return withTransaction(async (client) => {
            const result = await client.query<DcTenderRow>(
                `INSERT INTO dc_tender (
                    project_id, tender_type, status, title, owner_estimate_amount,
                    oe_tolerance_percent, created_by_email, created_at, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7, timezone('Asia/Jakarta', now()), timezone('Asia/Jakarta', now()))
                RETURNING id, project_id, tender_type, status, title, owner_estimate_amount,
                    oe_tolerance_percent, winner_participant_id, created_by_email, created_at, updated_at`,
                [
                    projectId,
                    input.tender_type,
                    DC_TENDER_STATUS.DRAFT,
                    input.title,
                    input.owner_estimate_amount ?? null,
                    input.oe_tolerance_percent,
                    input.created_by_email ?? null
                ]
            );

            const tender = result.rows[0];
            await insertActivityLog(client, {
                project_id: projectId,
                entity_type: "DC_TENDER",
                entity_id: tender.id,
                actor_email: input.created_by_email,
                action: "CREATE_TENDER",
                status_after: tender.status,
                metadata: { tender_type: tender.tender_type }
            });

            return tender;
        });
    },

    async listVendors(): Promise<DcVendorCompanyRow[]> {
        const result = await pool.query<DcVendorCompanyRow & { service_types: string[] | null }>(
            `SELECT v.id, v.company_name, v.npwp, v.address, v.contact_name, v.contact_email,
                v.contact_phone, v.status, v.created_by_email, v.created_at, v.updated_at,
                COALESCE(array_agg(s.service_type) FILTER (WHERE s.service_type IS NOT NULL), '{}') AS service_types
             FROM dc_vendor_company v
             LEFT JOIN dc_vendor_service s ON s.vendor_company_id = v.id
             GROUP BY v.id
             ORDER BY v.company_name ASC`
        );

        return result.rows;
    },

    async createVendor(input: CreateDcVendorInput): Promise<DcVendorCompanyRow> {
        return withTransaction(async (client) => {
            const result = await client.query<DcVendorCompanyRow>(
                `INSERT INTO dc_vendor_company (
                    company_name, npwp, address, contact_name, contact_email, contact_phone,
                    status, created_by_email, created_at, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE',$7, timezone('Asia/Jakarta', now()), timezone('Asia/Jakarta', now()))
                RETURNING id, company_name, npwp, address, contact_name, contact_email,
                    contact_phone, status, created_by_email, created_at, updated_at`,
                [
                    input.company_name,
                    input.npwp ?? null,
                    input.address ?? null,
                    input.contact_name ?? null,
                    input.contact_email ?? null,
                    input.contact_phone ?? null,
                    input.created_by_email ?? null
                ]
            );

            const vendor = result.rows[0];
            for (const serviceType of input.service_types) {
                await client.query(
                    `INSERT INTO dc_vendor_service (vendor_company_id, service_type)
                     VALUES ($1,$2)
                     ON CONFLICT (vendor_company_id, service_type) DO NOTHING`,
                    [vendor.id, serviceType]
                );
            }

            await insertActivityLog(client, {
                entity_type: "DC_VENDOR_COMPANY",
                entity_id: vendor.id,
                actor_email: input.created_by_email,
                action: "CREATE_VENDOR",
                status_after: vendor.status,
                metadata: { service_types: input.service_types }
            });

            return { ...vendor, service_types: input.service_types };
        });
    },

    async createVendorUser(vendorId: number, input: CreateDcVendorUserInput): Promise<unknown> {
        const result = await pool.query(
            `INSERT INTO dc_vendor_user (vendor_company_id, email, full_name, phone, status, created_at)
             VALUES ($1,$2,$3,$4,'ACTIVE', timezone('Asia/Jakarta', now()))
             RETURNING id, vendor_company_id, email, full_name, phone, status, created_at`,
            [vendorId, input.email, input.full_name ?? null, input.phone ?? null]
        );

        return result.rows[0];
    },

    async listApprovals(filter: DcApprovalListQuery): Promise<unknown[]> {
        const conditions: string[] = [];
        const values: unknown[] = [];
        if (filter.status) {
            values.push(filter.status);
            conditions.push(`a.status = $${values.length}`);
        }
        if (filter.required_role) {
            values.push(filter.required_role);
            conditions.push(`a.required_role = $${values.length}`);
        }
        if (filter.project_id) {
            values.push(filter.project_id);
            conditions.push(`a.project_id = $${values.length}`);
        }
        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        const result = await pool.query(
            `SELECT a.*, p.project_code, p.project_name, p.current_stage
             FROM dc_approval a
             LEFT JOIN dc_project p ON p.id = a.project_id
             ${whereClause}
             ORDER BY a.created_at DESC, a.id DESC`,
            values
        );

        return result.rows;
    },

    async listDocuments(filter: DcDocumentListQuery, bypassAccess = false): Promise<DcDocumentRow[]> {
        const conditions: string[] = [];
        const values: unknown[] = [];
        const joins: string[] = [];
        if (!bypassAccess) {
            values.push(filter.actor_email);
            joins.push(`JOIN dc_project_member m ON m.project_id = d.project_id`);
            conditions.push(`LOWER(m.email) = LOWER($${values.length})`);
        }
        conditions.push(`d.status <> 'DELETED'`);
        if (filter.project_id) {
            values.push(filter.project_id);
            conditions.push(`d.project_id = $${values.length}`);
        }
        if (filter.tender_id) {
            values.push(filter.tender_id);
            conditions.push(`d.tender_id = $${values.length}`);
        }
        if (filter.participant_id) {
            values.push(filter.participant_id);
            conditions.push(`d.participant_id = $${values.length}`);
        }
        if (filter.document_type) {
            values.push(filter.document_type);
            conditions.push(`d.document_type = $${values.length}`);
        }
        if (filter.entity_type) {
            values.push(filter.entity_type);
            conditions.push(`d.entity_type = $${values.length}`);
        }
        if (filter.stage) {
            values.push(filter.stage);
            conditions.push(`d.stage = $${values.length}`);
        }
        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        const result = await pool.query<DcDocumentRow>(
            `SELECT ${DC_DOCUMENT_SELECT}
             FROM dc_document d
             ${joins.join("\n")}
             LEFT JOIN dc_document_version v ON v.document_id = d.id AND v.is_current = true
             LEFT JOIN dc_project p ON p.id = d.project_id
             ${whereClause}
             ORDER BY d.created_at DESC, d.id DESC`,
            values
        );

        return result.rows;
    },

    async upsertProjectMember(
        client: PoolClient,
        input: {
            project_id: number;
            email: string;
            role?: string | null;
            member_type: string;
            access_level: DcMemberAccessLevel;
            source_entity_type?: string | null;
            source_entity_id?: number | null;
        }
    ): Promise<void> {
        const updated = await client.query(
            `UPDATE dc_project_member
             SET role = $3,
                 member_type = $4,
                 access_level = $5,
                 updated_at = timezone('Asia/Jakarta', now())
             WHERE project_id = $1
               AND LOWER(email) = LOWER($2)
               AND COALESCE(source_entity_type, '') = COALESCE($6, '')
               AND COALESCE(source_entity_id, 0) = COALESCE($7, 0)`,
            [
                input.project_id,
                input.email,
                input.role ?? null,
                input.member_type,
                input.access_level,
                input.source_entity_type ?? null,
                input.source_entity_id ?? null
            ]
        );

        if ((updated.rowCount ?? 0) > 0) return;

        await client.query(
            `INSERT INTO dc_project_member (
                project_id, email, role, member_type, access_level,
                source_entity_type, source_entity_id, created_at, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7, timezone('Asia/Jakarta', now()), timezone('Asia/Jakarta', now()))
            ON CONFLICT DO NOTHING`,
            [
                input.project_id,
                input.email,
                input.role ?? null,
                input.member_type,
                input.access_level,
                input.source_entity_type ?? null,
                input.source_entity_id ?? null
            ]
        );
    },

    async findProjectMember(projectId: number, email: string): Promise<DcProjectMemberRow | null> {
        const result = await pool.query<DcProjectMemberRow>(
            `SELECT id, project_id, email, role, member_type, access_level,
                    source_entity_type, source_entity_id, created_at, updated_at
             FROM dc_project_member
             WHERE project_id = $1
               AND LOWER(email) = LOWER($2)
             ORDER BY
                CASE access_level
                    WHEN 'MANAGE' THEN 3
                    WHEN 'UPLOAD' THEN 2
                    ELSE 1
                END DESC,
                id DESC
             LIMIT 1`,
            [projectId, email]
        );
        return result.rows[0] ?? null;
    },

    async validateDocumentRelations(input: {
        project_id: number;
        tender_id?: number;
        participant_id?: number;
    }): Promise<void> {
        if (input.tender_id) {
            const tender = await pool.query(
                `SELECT id FROM dc_tender WHERE id = $1 AND project_id = $2`,
                [input.tender_id, input.project_id]
            );
            if ((tender.rowCount ?? 0) === 0) {
                throw new Error("Tender tidak terhubung dengan project DC yang dipilih");
            }
        }

        if (input.participant_id) {
            const participant = await pool.query(
                `SELECT tp.id
                 FROM dc_tender_participant tp
                 JOIN dc_tender t ON t.id = tp.tender_id
                 WHERE tp.id = $1
                   AND t.project_id = $2
                   AND ($3::int IS NULL OR tp.tender_id = $3::int)`,
                [input.participant_id, input.project_id, input.tender_id ?? null]
            );
            if ((participant.rowCount ?? 0) === 0) {
                throw new Error("Participant tidak terhubung dengan project/tender DC yang dipilih");
            }
        }
    },

    async createDocumentWithVersion(
        input: {
            project_id: number;
            tender_id?: number | null;
            participant_id?: number | null;
            entity_type: string;
            entity_id?: number | null;
            document_type: string;
            stage?: string | null;
            created_by_email: string;
        },
        version: DcUploadedDocumentVersion
    ): Promise<DcDocumentRow> {
        return withTransaction(async (client) => {
            const documentResult = await client.query<{ id: number }>(
                `INSERT INTO dc_document (
                    project_id, tender_id, participant_id, entity_type, entity_id,
                    document_type, stage, status, created_by_email, created_at, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,'ACTIVE',$8, timezone('Asia/Jakarta', now()), timezone('Asia/Jakarta', now()))
                RETURNING id`,
                [
                    input.project_id,
                    input.tender_id ?? null,
                    input.participant_id ?? null,
                    input.entity_type,
                    input.entity_id ?? null,
                    input.document_type,
                    input.stage ?? null,
                    input.created_by_email
                ]
            );

            const documentId = documentResult.rows[0].id;
            await client.query(
                `INSERT INTO dc_document_version (
                    document_id, version_no, drive_file_id, drive_folder_id, link_dokumen, link_folder,
                    file_name, mime_type, size_bytes, notes, uploaded_by_email, uploaded_by_role,
                    is_current, created_at
                ) VALUES ($1,1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true, timezone('Asia/Jakarta', now()))`,
                [
                    documentId,
                    version.drive_file_id,
                    version.drive_folder_id,
                    version.link_dokumen,
                    version.link_folder,
                    version.file_name,
                    version.mime_type,
                    version.size_bytes,
                    version.notes ?? null,
                    version.uploaded_by_email,
                    version.uploaded_by_role
                ]
            );

            await insertActivityLog(client, {
                project_id: input.project_id,
                entity_type: "DC_DOCUMENT",
                entity_id: documentId,
                actor_email: input.created_by_email,
                actor_role: version.uploaded_by_role,
                action: "CREATE_DOCUMENT",
                status_after: "ACTIVE",
                metadata: { document_type: input.document_type, file_name: version.file_name }
            });

            const created = await client.query<DcDocumentRow>(
                `SELECT ${DC_DOCUMENT_SELECT}
                 FROM dc_document d
                 LEFT JOIN dc_document_version v ON v.document_id = d.id AND v.is_current = true
                 LEFT JOIN dc_project p ON p.id = d.project_id
                 WHERE d.id = $1`,
                [documentId]
            );
            return created.rows[0];
        });
    },

    async findDocumentById(id: number): Promise<DcDocumentRow | null> {
        const result = await pool.query<DcDocumentRow>(
            `SELECT ${DC_DOCUMENT_SELECT}
             FROM dc_document d
             LEFT JOIN dc_document_version v ON v.document_id = d.id AND v.is_current = true
             LEFT JOIN dc_project p ON p.id = d.project_id
             WHERE d.id = $1
               AND d.status <> 'DELETED'`,
            [id]
        );
        return result.rows[0] ?? null;
    },

    async updateDocumentMetadata(
        id: number,
        input: { document_type?: string; stage?: string | null }
    ): Promise<DcDocumentRow | null> {
        const fields: string[] = [];
        const values: Array<string | number | null> = [];

        if (typeof input.document_type !== "undefined") {
            values.push(input.document_type);
            fields.push(`document_type = $${values.length}`);
        }
        if (typeof input.stage !== "undefined") {
            values.push(input.stage ?? null);
            fields.push(`stage = $${values.length}`);
        }

        if (fields.length > 0) {
            values.push(id);
            await pool.query(
                `UPDATE dc_document
                 SET ${fields.join(", ")}, updated_at = timezone('Asia/Jakarta', now())
                 WHERE id = $${values.length}`,
                values
            );
        }

        return this.findDocumentById(id);
    },

    async addDocumentVersion(id: number, version: DcUploadedDocumentVersion): Promise<DcDocumentRow | null> {
        return withTransaction(async (client) => {
            const current = await client.query<{ project_id: number | null; document_type: string }>(
                `SELECT project_id, document_type FROM dc_document WHERE id = $1 AND status <> 'DELETED' FOR UPDATE`,
                [id]
            );
            if ((current.rowCount ?? 0) === 0) return null;

            const versionNoResult = await client.query<{ version_no: number }>(
                `SELECT COALESCE(MAX(version_no), 0) + 1 AS version_no
                 FROM dc_document_version
                 WHERE document_id = $1`,
                [id]
            );
            const versionNo = versionNoResult.rows[0].version_no;

            await client.query(
                `UPDATE dc_document_version SET is_current = false WHERE document_id = $1`,
                [id]
            );

            await client.query(
                `INSERT INTO dc_document_version (
                    document_id, version_no, drive_file_id, drive_folder_id, link_dokumen, link_folder,
                    file_name, mime_type, size_bytes, notes, uploaded_by_email, uploaded_by_role,
                    is_current, created_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true, timezone('Asia/Jakarta', now()))`,
                [
                    id,
                    versionNo,
                    version.drive_file_id,
                    version.drive_folder_id,
                    version.link_dokumen,
                    version.link_folder,
                    version.file_name,
                    version.mime_type,
                    version.size_bytes,
                    version.notes ?? null,
                    version.uploaded_by_email,
                    version.uploaded_by_role
                ]
            );

            await client.query(
                `UPDATE dc_document SET updated_at = timezone('Asia/Jakarta', now()) WHERE id = $1`,
                [id]
            );

            await insertActivityLog(client, {
                project_id: current.rows[0].project_id,
                entity_type: "DC_DOCUMENT",
                entity_id: id,
                actor_email: version.uploaded_by_email,
                actor_role: version.uploaded_by_role,
                action: "UPLOAD_DOCUMENT_VERSION",
                status_after: `VERSION_${versionNo}`,
                metadata: { file_name: version.file_name, document_type: current.rows[0].document_type }
            });

            const updated = await client.query<DcDocumentRow>(
                `SELECT ${DC_DOCUMENT_SELECT}
                 FROM dc_document d
                 LEFT JOIN dc_document_version v ON v.document_id = d.id AND v.is_current = true
                 LEFT JOIN dc_project p ON p.id = d.project_id
                 WHERE d.id = $1`,
                [id]
            );
            return updated.rows[0] ?? null;
        });
    },

    async softDeleteDocument(id: number, actor: { email: string; role: string }): Promise<DcDocumentRow | null> {
        return withTransaction(async (client) => {
            const result = await client.query<DcDocumentRow>(
                `UPDATE dc_document
                 SET status = 'DELETED',
                     deleted_at = timezone('Asia/Jakarta', now()),
                     updated_at = timezone('Asia/Jakarta', now())
                 WHERE id = $1
                   AND status <> 'DELETED'
                 RETURNING id, project_id, tender_id, participant_id, entity_type, entity_id,
                    document_type, stage, status, created_by_email, created_at, updated_at, deleted_at,
                    NULL::int AS current_version_id,
                    NULL::int AS version_no,
                    NULL::varchar AS drive_file_id,
                    NULL::varchar AS drive_folder_id,
                    NULL::text AS link_dokumen,
                    NULL::text AS link_folder,
                    NULL::varchar AS file_name,
                    NULL::varchar AS mime_type,
                    NULL::bigint AS size_bytes,
                    NULL::text AS notes,
                    NULL::varchar AS uploaded_by_email,
                    NULL::varchar AS uploaded_by_role,
                    NULL::timestamp AS version_created_at,
                    NULL::varchar AS project_code,
                    NULL::varchar AS project_name`,
                [id]
            );
            const deleted = result.rows[0] ?? null;
            if (deleted) {
                await insertActivityLog(client, {
                    project_id: deleted.project_id,
                    entity_type: "DC_DOCUMENT",
                    entity_id: id,
                    actor_email: actor.email,
                    actor_role: actor.role,
                    action: "DELETE_DOCUMENT",
                    status_before: "ACTIVE",
                    status_after: "DELETED",
                    metadata: { document_type: deleted.document_type }
                });
            }
            return deleted;
        });
    }
};
