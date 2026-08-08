import { z } from "zod";

export const dashboardQuerySchema = z.object({
    search: z.string().trim().min(1).optional(),
    id: z.coerce.number().positive().optional()
}).refine((data) => data.search || data.id, {
    message: "Harus memberikan minimal search atau id",
    path: ["search", "id"]
});

export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;

export const dashboardAllQuerySchema = z.object({
    search: z.string().trim().min(1).optional()
});

export type DashboardAllQueryInput = z.infer<typeof dashboardAllQuerySchema>;

export const dashboardExportQuerySchema = z.object({
    format: z.enum(["xlsx", "csv", "pdf"]).default("xlsx"),
    search: z.string().trim().min(1).optional(),
    cabang: z.string().trim().optional(),
    toko_ids: z.string().trim().optional(),
    months: z.string().trim().optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    period_mode: z.enum(["months", "ytd", "all"]).default("all"),
    data_types: z.string().trim().optional(),
    job_types: z.string().trim().optional(),
    cabangs: z.string().trim().optional(),
    spk_status: z.enum(["all", "with_spk", "without_spk"]).default("all"),
    actor_role: z.string().trim().min(1),
    actor_cabang: z.string().trim().min(1),
    cabang_array: z.array(z.string()).optional()
});

export type DashboardExportQueryInput = z.infer<typeof dashboardExportQuerySchema>;

const dashboardScopeSchema = {
    actor_role: z.string().trim().min(1),
    actor_cabang: z.string().trim().min(1),
    actor_company: z.string().trim().optional(),
    cabang: z.string().trim().optional(),
    search: z.string().trim().optional(),
    cabang_array: z.array(z.string()).optional(),
};

export const dashboardSummaryQuerySchema = z.object({
    ...dashboardScopeSchema,
});

export type DashboardSummaryQueryInput = z.infer<typeof dashboardSummaryQuerySchema>;

export const dashboardProjectsQuerySchema = z.object({
    ...dashboardScopeSchema,
    stage: z.string().trim().optional(),
    attention: z.coerce.boolean().optional(),
    sort: z.enum(["priority", "name", "latest"]).default("priority"),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(5).max(100).default(20),
});

export type DashboardProjectsQueryInput = z.infer<typeof dashboardProjectsQuerySchema>;

