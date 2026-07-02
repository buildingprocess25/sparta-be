import { app } from "./app";
import { env } from "./config/env";
import { GoogleProvider } from "./common/google";
import { authSessionRepository } from "./modules/auth/auth-session.repository";
import { systemMaintenanceService } from "./modules/system-maintenance/system-maintenance.service";
import { systemAccessScheduleService } from "./modules/system-access-schedule/system-access-schedule.service";
import { serahTerimaService } from "./modules/serah-terima/serah-terima.service";

const cleanupAuthSessions = async () => {
    const deletedCount = await authSessionRepository.deleteExpiredOlderThan(env.AUTH_SESSION_RETENTION_DAYS);
    if (deletedCount > 0) {
        console.log(`Auth session cleanup: ${deletedCount} session lama dihapus`);
    }
};

const bootstrap = async () => {
    await GoogleProvider.initialize();
    await authSessionRepository.ensureSchema();
    await systemMaintenanceService.ensureSchema();
    await systemAccessScheduleService.ensureSchema();
    await serahTerimaService.ensureDateCorrectionAuditSchema();
    await cleanupAuthSessions();

    setInterval(() => {
        cleanupAuthSessions().catch((error) => {
            console.warn("Auth session cleanup gagal:", error);
        });
    }, 24 * 60 * 60 * 1000).unref();
};

app.listen(env.PORT, () => {
    console.log(`rab-service running on port ${env.PORT}`);

    bootstrap()
        .then(() => {
            console.log("Startup bootstrap selesai");
        })
        .catch((error) => {
            console.error("Startup bootstrap gagal:", error);
        });
});
