import { app } from "./app";
import { env } from "./config/env";
import { GoogleProvider } from "./common/google";

// Refresh Google OAuth tokens sebelum mulai listen
GoogleProvider.initialize()
    .then(() => {
        app.listen(env.PORT, () => {
            console.log(`rab-service running on port ${env.PORT}`);
        });
    })
    .catch((err) => {
        console.error("Fatal: gagal inisialisasi Google credentials:", err);
        process.exit(1);
    });
