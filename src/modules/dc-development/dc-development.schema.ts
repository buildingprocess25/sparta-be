import { z } from "zod";
import {
    DC_PROJECT_STAGE_SEQUENCE,
    DC_TENDER_TYPE,
    DC_VENDOR_SERVICE_TYPES
} from "./dc-development.constants";

export const dcProjectListQuerySchema = z.object({
    status: z.string().optional(),
    current_stage: z.string().optional(),
    branch_name: z.string().optional(),
    search: z.string().optional(),
    actor_email: z.string().email().optional(),
    actor_role: z.string().trim().optional()
});

export const createDcProjectSchema = z.object({
    project_code: z.string().trim().min(1),
    project_name: z.string().trim().min(1),
    location_name: z.string().trim().optional(),
    branch_name: z.string().trim().optional(),
    address: z.string().trim().optional(),
    area_size: z.coerce.number().nonnegative().optional(),
    created_by_email: z.string().email().optional(),
    created_by_role: z.string().trim().optional()
});

export const advanceDcProjectStageSchema = z.object({
    actor_email: z.string().email(),
    actor_role: z.string().trim().min(1),
    reason: z.string().trim().optional(),
    target_stage: z.enum(DC_PROJECT_STAGE_SEQUENCE).optional(),
    is_intervention: z.coerce.boolean().optional()
});

export const createDcVendorSchema = z.object({
    company_name: z.string().trim().min(1),
    npwp: z.string().trim().optional(),
    address: z.string().trim().optional(),
    contact_name: z.string().trim().optional(),
    contact_email: z.string().email().optional(),
    contact_phone: z.string().trim().optional(),
    service_types: z.array(z.enum(DC_VENDOR_SERVICE_TYPES as [string, ...string[]])).default([]),
    created_by_email: z.string().email().optional()
});

export const createDcVendorUserSchema = z.object({
    email: z.string().email(),
    full_name: z.string().trim().optional(),
    phone: z.string().trim().optional()
});

export const createDcTenderSchema = z.object({
    tender_type: z.nativeEnum(DC_TENDER_TYPE),
    title: z.string().trim().min(1),
    owner_estimate_amount: z.coerce.number().nonnegative().optional(),
    oe_tolerance_percent: z.coerce.number().positive().default(10),
    created_by_email: z.string().email().optional()
});

export const dcApprovalListQuerySchema = z.object({
    status: z.string().optional(),
    required_role: z.string().optional(),
    project_id: z.coerce.number().int().positive().optional()
});

export const dcDocumentListQuerySchema = z.object({
    project_id: z.coerce.number().int().positive().optional(),
    tender_id: z.coerce.number().int().positive().optional(),
    participant_id: z.coerce.number().int().positive().optional(),
    document_type: z.string().optional(),
    entity_type: z.string().optional(),
    stage: z.string().optional(),
    actor_email: z.string().email(),
    actor_role: z.string().trim().min(1)
});

export const createDcDocumentSchema = z.object({
    project_id: z.coerce.number().int().positive(),
    tender_id: z.coerce.number().int().positive().optional(),
    participant_id: z.coerce.number().int().positive().optional(),
    entity_type: z.string().trim().min(1).default("DC_PROJECT"),
    entity_id: z.coerce.number().int().positive().optional(),
    document_type: z.string().trim().min(1),
    stage: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    actor_email: z.string().email(),
    actor_role: z.string().trim().min(1)
});

export const updateDcDocumentSchema = z.object({
    document_type: z.string().trim().min(1).optional(),
    stage: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    actor_email: z.string().email(),
    actor_role: z.string().trim().min(1)
});

export const dcDocumentActorQuerySchema = z.object({
    actor_email: z.string().email(),
    actor_role: z.string().trim().min(1)
});

export type DcProjectListQuery = z.infer<typeof dcProjectListQuerySchema>;
export type CreateDcProjectInput = z.infer<typeof createDcProjectSchema>;
export type AdvanceDcProjectStageInput = z.infer<typeof advanceDcProjectStageSchema>;
export type CreateDcVendorInput = z.infer<typeof createDcVendorSchema>;
export type CreateDcVendorUserInput = z.infer<typeof createDcVendorUserSchema>;
export type CreateDcTenderInput = z.infer<typeof createDcTenderSchema>;
export type DcApprovalListQuery = z.infer<typeof dcApprovalListQuerySchema>;
export type DcDocumentListQuery = z.infer<typeof dcDocumentListQuerySchema>;
export type CreateDcDocumentInput = z.infer<typeof createDcDocumentSchema>;
export type UpdateDcDocumentInput = z.infer<typeof updateDcDocumentSchema>;
export type DcDocumentActorQuery = z.infer<typeof dcDocumentActorQuerySchema>;
