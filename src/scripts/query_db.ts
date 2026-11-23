import { Client } from "pg";

const client = new Client({ connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable' });

async function main() {
  try {
    await client.connect();
        const result = await client.query(`
            SELECT id, lingkup_pekerjaan, detail_items 
            FROM "RABProjectPlanning" 
            WHERE ulok = 'Z001-0709-0000' 
            ORDER BY id DESC LIMIT 1;
        `);

        if (result.rows.length === 0) {
            console.log("Tidak ada data RAB untuk ulok ini.");
            return;
        }

        const rab = result.rows[0];
        console.log(`RAB ID: ${rab.id}`);
        console.log(`Lingkup: ${rab.lingkup_pekerjaan}`);

        if (rab.detail_items) {
            const details = typeof rab.detail_items === 'string' ? JSON.parse(rab.detail_items) : rab.detail_items;
            console.log("Detail Items Count:", details.length);
            
            const sipilCount = details.filter((d: any) => d.lingkup_pekerjaan === 'SIPIL').length;
            const meCount = details.filter((d: any) => d.lingkup_pekerjaan === 'ME').length;
            const unknownCount = details.filter((d: any) => !d.lingkup_pekerjaan).length;
            
            console.log(`- SIPIL: ${sipilCount} item`);
            console.log(`- ME: ${meCount} item`);
            console.log(`- UNKNOWN (Terkabung): ${unknownCount} item`);

            console.log("\nSample Items:");
            details.slice(0, 5).forEach((d: any) => {
                console.log(`[${d.lingkup_pekerjaan || 'UNKNOWN'}] ${d.kategori_pekerjaan} - ${d.jenis_pekerjaan}`);
            });
            console.log("\nLast 5 Items:");
            details.slice(-5).forEach((d: any) => {
                console.log(`[${d.lingkup_pekerjaan || 'UNKNOWN'}] ${d.kategori_pekerjaan} - ${d.jenis_pekerjaan}`);
            });
        }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
