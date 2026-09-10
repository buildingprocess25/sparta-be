import { pool } from '../db/pool';

async function main() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN READ ONLY');
        for (const sql of [
            `SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('toko','rab','pengajuan_spk','spk_approval_log') ORDER BY table_name,ordinal_position`,
            `SELECT conrelid::regclass::text AS table_name, conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid IN ('public.toko'::regclass,'public.pengajuan_spk'::regclass,'public.spk_approval_log'::regclass)`,
            `SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='pengajuan_spk'`,
        ]) console.log(JSON.stringify((await client.query(sql)).rows));
        await client.query('ROLLBACK');
    } finally { client.release(); await pool.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
