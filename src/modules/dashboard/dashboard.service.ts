import { AppError } from "../../common/app-error";
import type { DashboardQueryInput } from "./dashboard.schema";
import { dashboardRepository } from "./dashboard.repository";

export const dashboardService = {
    async getDashboard(query: DashboardQueryInput) {
        const toko = await dashboardRepository.findTokoByQuery(query);
        if (!toko) {
            throw new AppError("Data toko tidak ditemukan", 404);
        }

        return dashboardRepository.findDashboardByTokoId(toko.id);
    }
};
