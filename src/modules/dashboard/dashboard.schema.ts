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
