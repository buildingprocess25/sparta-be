import { pool } from "../db/pool";

async function run() {
    // Check structure of berkas_serah_terima
    const r1 = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'berkas_serah_terima' ORDER BY ordinal_position`);
    console.log("berkas_serah_terima columns:", r1.rows.map((r: any) => r.column_name));
    
    // Check opname_item columns
    const r2 = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'opname_item' ORDER BY ordinal_position`);
    console.log("opname_item columns:", r2.rows.map((r: any) => r.column_name));
    
    // Check opname_final columns
    const r3 = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'opname_final' ORDER BY ordinal_position`);
    console.log("opname_final columns:", r3.rows.map((r: any) => r.column_name));
    
    // Check pengawasan_gantt columns  
    const r4 = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'pengawasan_gantt' ORDER BY ordinal_position`);
    console.log("pengawasan_gantt columns:", r4.rows.map((r: any) => r.column_name));
    
    // Check pengawasan columns
    const r5 = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'pengawasan' ORDER BY ordinal_position`);
    console.log("pengawasan columns:", r5.rows.map((r: any) => r.column_name));

    // Check if berkas_serah_terima has actual data for gantt_id 191
    const r6 = await pool.query(`SELECT id, gantt_id FROM berkas_serah_terima WHERE gantt_id = $1 LIMIT 5`, [191]);
    console.log("berkas_serah_terima for gantt 191:", r6.rows);

    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
