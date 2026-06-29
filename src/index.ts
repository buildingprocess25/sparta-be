import { app } from "./app";
import { env } from "./config/env";
import { GoogleProvider } from "./common/google";
import { authSessionRepository } from "./modules/auth/auth-session.repository";

const cleanupAuthSessions = async () => {
    const deletedCount = await authSessionRepository.deleteExpiredOlderThan(env.AUTH_SESSION_RETENTION_DAYS);
    if (deletedCount > 0) {
        console.log(`Auth session cleanup: ${deletedCount} session lama dihapus`);
    }
};

// Refresh Google OAuth tokens sebelum mulai listen
GoogleProvider.initialize()
    .then(async () => {
        await authSessionRepository.ensureSchema();
        await cleanupAuthSessions();
    })
    .then(() => {
        app.listen(env.PORT, () => {
            console.log(`rab-service running on port ${env.PORT}`);
        });

        setInterval(() => {
            cleanupAuthSessions().catch((error) => {
                console.warn("Auth session cleanup gagal:", error);
            });
        }, 24 * 60 * 60 * 1000).unref();
    })
    .catch((err) => {
        console.error("Fatal: gagal inisialisasi Google credentials:", err);
        process.exit(1);
    });
