import { app } from "./app";
import { env } from "./config/env";
import { GoogleProvider } from "./common/google";
import { authSessionRepository } from "./modules/auth/auth-session.repository";

// Refresh Google OAuth tokens sebelum mulai listen
GoogleProvider.initialize()
    .then(async () => {
        await authSessionRepository.ensureSchema();
    })
    .then(() => {
        app.listen(env.PORT, () => {
            console.log(`rab-service running on port ${env.PORT}`);
        });
    })
    .catch((err) => {
        console.error("Fatal: gagal inisialisasi Google credentials:", err);
        process.exit(1);
    });
