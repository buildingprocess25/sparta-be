 const { Client } = require('pg');
const c = new Client('postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/sparta?sslmode=disable');
c.connect().then(async () => {
    // 3 Modules
    const res3 = await c.query(`
        SELECT u.email, b.name as branch, string_agg(a."moduleId"::text, ', ') as modules
        FROM "User" u
        JOIN "Branch" b on u."branchId" = b.id
        JOIN "UserModuleAccess" a on u.id = a."userId"
        GROUP BY u.id, u.email, b.name
        
        LIMIT 1;
    `);
    
    // 2 Modules
    const res2 = await c.query(`
        SELECT u.email, b.name as branch, string_agg(a."moduleId"::text, ', ') as modules
        FROM "User" u
        JOIN "Branch" b on u."branchId" = b.id
        JOIN "UserModuleAccess" a on u.id = a."userId"
        GROUP BY u.id, u.email, b.name
        
        LIMIT 1;
    `);
    
    // 1 Module
    const res1 = await c.query(`
        SELECT u.email, b.name as branch, string_agg(a."moduleId"::text, ', ') as modules
        FROM "User" u
        JOIN "Branch" b on u."branchId" = b.id
        JOIN "UserModuleAccess" a on u.id = a."userId"
        GROUP BY u.id, u.email, b.name
        
        LIMIT 1;
    `);

    console.log("3 Modules:", res3.rows[0]);
    console.log("2 Modules:", res2.rows[0]);
    console.log("1 Module:", res1.rows[0]);

}).catch(e => console.log(e)).finally(() => c.end());
