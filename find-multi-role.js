const { Client } = require('pg');

async function main() {
    const urlBuilding = `postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable`;
    const clientB = new Client({ connectionString: urlBuilding });
    
    try {
        await clientB.connect();
        // Cari email yang punya lebih dari 1 row dengan JABATAN yang BERBEDA
        const query = `
            SELECT email_sat 
            FROM user_cabang 
            WHERE email_sat IS NOT NULL AND email_sat != ''
            GROUP BY email_sat 
            HAVING COUNT(DISTINCT jabatan) > 1 AND COUNT(DISTINCT cabang) > 1
            LIMIT 5;
        `;
        const res = await clientB.query(query);
        
        if (res.rows.length === 0) {
            console.log("Tidak ada user yang memiliki jabatan berbeda di cabang yang berbeda.");
            // Cari yang cabangnya lebih dari 1 saja (meski jabatan sama)
            const query2 = `
                SELECT email_sat 
                FROM user_cabang 
                WHERE email_sat IS NOT NULL AND email_sat != ''
                GROUP BY email_sat 
                HAVING COUNT(DISTINCT cabang) > 1
                LIMIT 1;
            `;
            const res2 = await clientB.query(query2);
            if (res2.rows.length > 0) {
                console.log("User dengan banyak cabang (jabatan sama):", res2.rows[0].email_sat);
                const details = await clientB.query(`SELECT email_sat, cabang, jabatan FROM user_cabang WHERE email_sat = $1`, [res2.rows[0].email_sat]);
                console.table(details.rows);
            }
        } else {
            console.log("✅ Ditemukan user dengan ROLE BERBEDA di CABANG BERBEDA:");
            const email = res.rows[0].email_sat;
            console.log("Email:", email);
            
            const details = await clientB.query(`SELECT email_sat, cabang, jabatan FROM user_cabang WHERE email_sat = $1`, [email]);
            console.table(details.rows);
        }

    } catch (e) {
        console.log(`❌ Failed:`, e.message);
    } finally {
        await clientB.end();
    }
}

main();
