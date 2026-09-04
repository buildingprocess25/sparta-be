const { Client } = require('pg');
const c = new Client('postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/sparta?sslmode=disable');
c.connect().then(async () => {
    // Note: Building's sso.controller.ts (sparta-be port 8000) exposes /api/auth/sso/callback
    await c.query(`UPDATE "AppModule" SET "callbackUrl" = 'http://localhost:8081/api/auth/sso/callback' WHERE id = 'BUILDING'`);
    await c.query(`UPDATE "AppModule" SET "callbackUrl" = 'http://localhost:3001/auth/sso/callback' WHERE id = 'MAINTENANCE'`);
    await c.query(`UPDATE "AppModule" SET "callbackUrl" = 'http://localhost:3002/api/auth/sso/callback' WHERE id = 'ENERGY'`);
    console.log('URLs Updated!');
}).catch(e => console.log(e)).finally(() => c.end());
