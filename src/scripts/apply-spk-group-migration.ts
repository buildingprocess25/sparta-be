import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pool } from '../db/pool';

async function main() {
    if (!process.argv.includes('--commit')) throw new Error('Pass --commit to apply the reviewed additive SPK migration.');
    const sql = readFileSync(resolve(__dirname, '../../sql/2026-09-10-spk-groups.sql'), 'utf8')
        .replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, '');
    const out = resolve(__dirname, '../../../outputs/spk-group-migration');
    mkdirSync(out, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const client = await pool.connect();
    try {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
        await client.query("SET LOCAL lock_timeout='10s'");
        await client.query("SET LOCAL statement_timeout='90s'");
        await client.query('LOCK TABLE pengajuan_spk IN ACCESS EXCLUSIVE MODE');
        const fingerprint = async () => {
            const result: Record<string, unknown> = {};
            for (const table of ['pengajuan_spk', 'spk_approval_log', 'toko', 'rab']) {
                result[table] = (await client.query(`SELECT count(*)::int AS records,
                    md5(coalesce(string_agg(md5((to_jsonb(t)-'spk_group_id')::text),'' ORDER BY id),'')) AS checksum
                    FROM ${table} t`)).rows[0];
            }
            return result;
        };
        const before = await fingerprint();
        writeFileSync(resolve(out, `${stamp}-before.json`), JSON.stringify(before, null, 2));
        await client.query(sql);
        const after = await fingerprint();
        if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Existing data fingerprint changed; migration rolled back.');
        const metadata = (await client.query(`SELECT column_name,data_type,is_nullable FROM information_schema.columns
            WHERE table_schema='public' AND table_name='pengajuan_spk' AND column_name='spk_group_id'`)).rows;
        const groupCounts = (await client.query('SELECT count(*)::int AS total,count(spk_group_id)::int AS grouped FROM pengajuan_spk')).rows[0];
        await client.query('COMMIT');
        const audit = { applied_at: new Date().toISOString(), before, after, existing_data_unchanged: true, metadata, groupCounts };
        writeFileSync(resolve(out, `${stamp}-applied.json`), JSON.stringify(audit, null, 2));
        console.log(JSON.stringify(audit, null, 2));
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally { client.release(); await pool.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
