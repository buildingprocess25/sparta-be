import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { before, beforeEach, after, test } from 'node:test';
import type { SubmitSpkInput } from './spk.schema';

// Opt-in local database only. Never fall back to DATABASE_URL or .env.
const raw = process.env.SPK_TEST_DATABASE_URL;
if (!raw) throw new Error('SPK_TEST_DATABASE_URL is required (dedicated localhost spk_group_integration database)');
const url = new URL(raw);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.pathname !== '/spk_group_integration') {
    throw new Error('Refusing non-local or non-dedicated integration database');
}
process.env.DATABASE_URL = raw;
process.env.PGSSLMODE = 'disable';
let pool: typeof import('../../db/pool').pool;
let repo: typeof import('./spk-group.repository').spkGroupRepository;
const pending = 'WAITING_FOR_BM_APPROVAL' as const;
const approved = 'SPK_APPROVED' as const;
const rejected = 'SPK_REJECTED' as const;
const approve = { approver_email: 'manager@example.invalid', tindakan: 'APPROVE' as const };
const reject = { ...approve, tindakan: 'REJECT' as const, alasan_penolakan: 'Fixture revision' };
const opts = { terbilang: (n: number) => String(n), validate: async () => {} };

before(async () => {
    ({ pool } = await import('../../db/pool'));
    ({ spkGroupRepository: repo } = await import('./spk-group.repository'));
    await pool.query(`
        CREATE TABLE IF NOT EXISTS toko (id serial PRIMARY KEY, nomor_ulok text, lingkup_pekerjaan text,
            nama_toko text, kode_toko text, proyek text, cabang text, alamat text, nama_kontraktor text,
            UNIQUE(nomor_ulok,lingkup_pekerjaan));
        CREATE TABLE IF NOT EXISTS rab (id serial PRIMARY KEY,id_toko int REFERENCES toko(id),status text,nama_pt text,
            grand_total text,grand_total_final text,grand_total_non_sbo text,durasi_pekerjaan text,created_at timestamptz DEFAULT now());
        CREATE TABLE IF NOT EXISTS pengajuan_spk (id serial PRIMARY KEY,id_toko int NOT NULL UNIQUE REFERENCES toko(id),
            nomor_ulok text NOT NULL,email_pembuat text NOT NULL,lingkup_pekerjaan text NOT NULL,nama_kontraktor text NOT NULL,
            proyek text NOT NULL,waktu_mulai date NOT NULL,durasi int NOT NULL CHECK(durasi>0),waktu_selesai timestamptz NOT NULL,
            grand_total numeric(18,2) NOT NULL CHECK(grand_total>=0),terbilang text NOT NULL,nomor_spk text NOT NULL,
            par text,spk_manual_1 text,spk_manual_2 text,status text NOT NULL,link_pdf text,approver_email text,
            waktu_persetujuan timestamptz,alasan_penolakan text,created_at timestamptz NOT NULL DEFAULT now(),spk_group_id uuid);
        CREATE UNIQUE INDEX IF NOT EXISTS fixture_group_scope ON pengajuan_spk(spk_group_id,lingkup_pekerjaan) WHERE spk_group_id IS NOT NULL;
        CREATE TABLE IF NOT EXISTS spk_approval_log (id serial PRIMARY KEY,pengajuan_spk_id int NOT NULL REFERENCES pengajuan_spk(id),
            approver_email text NOT NULL,tindakan text NOT NULL CHECK(tindakan IN ('APPROVE','REJECT')),
            alasan_penolakan text,catatan_approval text,waktu_tindakan timestamptz DEFAULT now());
        CREATE TABLE IF NOT EXISTS activity_log (id serial PRIMARY KEY,entity_type text,entity_id int,actor_email text,actor_role text,
            action text,status_before text,status_after text,reason text,metadata jsonb,created_at timestamptz DEFAULT now());
        ALTER TABLE pengajuan_spk ALTER COLUMN status TYPE varchar(50),
            ALTER COLUMN approver_email TYPE varchar(255), ALTER COLUMN link_pdf TYPE varchar(500),
            ALTER COLUMN nomor_ulok TYPE varchar(255), ALTER COLUMN nomor_spk TYPE varchar(255);
        ALTER TABLE spk_approval_log ALTER COLUMN tindakan TYPE varchar(20), ALTER COLUMN approver_email TYPE varchar(255);
    `);
});
beforeEach(async () => {
    await pool.query(`DROP TRIGGER IF EXISTS fixture_fail ON pengajuan_spk;
        DROP FUNCTION IF EXISTS fixture_failure();
        TRUNCATE spk_approval_log,activity_log,pengajuan_spk,rab,toko RESTART IDENTITY CASCADE;`);
});
after(async () => { await pool?.end(); });

async function seed(ulok = 'Z001-TEST-0001', scopes = ['SIPIL','ME']) {
    const ids: number[] = [];
    for (const scope of scopes) {
        const row = await pool.query(`INSERT INTO toko(nomor_ulok,lingkup_pekerjaan,nama_toko,kode_toko,proyek,cabang,alamat)
            VALUES($1,$2,'SYNTHETIC','OLD1','Reguler','HEAD OFFICE','Synthetic address') RETURNING id`, [ulok,scope]);
        const id = row.rows[0].id;
        ids.push(id);
        await pool.query(`INSERT INTO rab(id_toko,status,nama_pt,grand_total,grand_total_final,durasi_pekerjaan) VALUES($1,'Disetujui','CV FIXTURE','999999',$2,'30')`,[id, scope==='SIPIL' ? '100' : '200']);
    }
    return { id_toko: ids[0], member_toko_ids: ids, nomor_ulok: ulok, kode_toko:'NEW1',
        email_pembuat:'builder@example.invalid',lingkup_pekerjaan:scopes.length===2?'SIPIL + ME':scopes[0],
        nama_kontraktor:'CV FIXTURE',proyek:'Reguler',waktu_mulai:'2026-10-01',durasi:30,
        grand_total:999999,par:'PAR-FIXTURE',spk_manual_1:'IX',spk_manual_2:'26' } satisfies SubmitSpkInput;
}
async function all() { return (await pool.query('SELECT * FROM pengajuan_spk ORDER BY id')).rows; }
async function failSecond(event: 'INSERT'|'UPDATE') {
    await pool.query(`CREATE FUNCTION fixture_failure() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.lingkup_pekerjaan='ME' THEN RAISE EXCEPTION 'forced second member failure'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER fixture_fail BEFORE ${event} ON pengajuan_spk FOR EACH ROW EXECUTE FUNCTION fixture_failure();`);
}

test('combined submit uses authoritative per-scope amounts, shared fields and zero cost', async () => {
    const p = await seed();
    await pool.query("UPDATE rab SET grand_total_final='0' WHERE id_toko=$1",[p.id_toko]);
    const rows = await repo.saveSubmission(p,opts);
    assert.equal(rows.length,2); assert.ok(rows[0].spk_group_id);
    assert.equal(rows[0].spk_group_id,rows[1].spk_group_id); assert.equal(rows[0].nomor_spk,rows[1].nomor_spk);
    assert.deepEqual(rows.map(r=>Number(r.grand_total)),[0,200]);
    assert.equal(rows[0].waktu_mulai,'2026-10-01'); assert.equal(rows[0].waktu_selesai.slice(0,10),'2026-10-30');
    assert.deepEqual((await pool.query('SELECT kode_toko FROM toko ORDER BY id')).rows.map(r=>r.kode_toko),['NEW1','NEW1']);
});
test('failure inserting second member rolls back first member and both toko codes', async () => {
    const p=await seed(); await failSecond('INSERT');
    await assert.rejects(repo.saveSubmission(p,opts),/forced second member/);
    assert.equal((await all()).length,0);
    assert.deepEqual((await pool.query('SELECT kode_toko FROM toko ORDER BY id')).rows.map(r=>r.kode_toko),['OLD1','OLD1']);
});
test('repeat and concurrent submit produce exactly one group', async () => {
    const p=await seed();
    const results=await Promise.allSettled([repo.saveSubmission(p,opts),repo.saveSubmission(p,opts)]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal((await all()).length,2);
    await assert.rejects(repo.saveSubmission(p,opts));
    assert.equal((await all()).length,2);
});
test('stale single input cannot split a fresh eligible pair', async () => {
    const p=await seed();
    await assert.rejects(repo.saveSubmission({...p,member_toko_ids:undefined,lingkup_pekerjaan:'SIPIL'},opts));
    assert.equal((await all()).length,0);
});
test('legacy remains single when a new opposite scope is added and approved', async () => {
    const p=await seed('Z001-TEST-0001',['SIPIL']);
    const [old]=await repo.saveSubmission(p,opts);
    assert.equal(old.spk_group_id,null);
    await pool.query("UPDATE pengajuan_spk SET link_pdf='legacy.pdf' WHERE id=$1",[old.id]);
    const me=await seed('Z001-TEST-0001',['ME']);
    const [fresh]=await repo.saveSubmission(me,opts);
    assert.equal(fresh.spk_group_id,null);
    await repo.transition(fresh.id,pending,approved,approve);
    const unchanged=(await repo.members(old.id))[0];
    assert.equal(unchanged.status,pending); assert.equal(unchanged.link_pdf,'legacy.pdf');
    assert.equal((await repo.members(old.id)).length,1);
});
test('approval through either member is atomic, creates two logs, repeat conflicts', async () => {
    const rows=await repo.saveSubmission(await seed(),opts);
    await repo.transition(rows[1].id,pending,approved,approve);
    assert.ok((await all()).every(r=>r.status===approved && r.approver_email===approve.approver_email));
    assert.equal((await pool.query('SELECT * FROM spk_approval_log')).rowCount,2);
    await assert.rejects(repo.transition(rows[0].id,pending,approved,approve));
    assert.equal((await pool.query('SELECT * FROM spk_approval_log')).rowCount,2);
});
test('failure updating second member rolls back first approval and log', async () => {
    const rows=await repo.saveSubmission(await seed(),opts); await failSecond('UPDATE');
    await assert.rejects(repo.transition(rows[0].id,pending,approved,approve),/forced second member/);
    assert.ok((await all()).every(r=>r.status===pending));
    assert.equal((await pool.query('SELECT * FROM spk_approval_log')).rowCount,0);
});
test('reject then resubmit retains exact group, IDs and SPK number', async () => {
    const p=await seed(); const before=await repo.saveSubmission(p,opts);
    await repo.transition(before[1].id,pending,rejected,reject);
    assert.ok((await all()).every(r=>r.status===rejected));
    const after=await repo.saveSubmission({...p,spk_group_id:before[0].spk_group_id},opts);
    assert.deepEqual(after.map(r=>r.id),before.map(r=>r.id));
    assert.equal(after[0].spk_group_id,before[0].spk_group_id); assert.equal(after[0].nomor_spk,before[0].nomor_spk);
    assert.ok(after.every(r=>r.status===pending && !r.approver_email && !r.alasan_penolakan));
});
test('number allocation skips historic maximum and serializes distinct simultaneous groups', async () => {
    const old=await repo.saveSubmission(await seed('Z001-TEST-0000',['SIPIL']),opts);
    await pool.query("UPDATE pengajuan_spk SET nomor_spk='999/PROPNDEV-Z001/IX/26' WHERE id=$1",[old[0].id]);
    const a=await seed('Z001-TEST-0001'); const b=await seed('Z001-TEST-0002');
    const groups=await Promise.all([repo.saveSubmission(a,opts),repo.saveSubmission(b,opts)]);
    assert.deepEqual(groups.map(g=>g[0].nomor_spk).sort(),['1000/PROPNDEV-Z001/IX/26','1001/PROPNDEV-Z001/IX/26']);
});
test('inconsistent group statuses conflict without touching any status or log', async () => {
    const rows=await repo.saveSubmission(await seed(),opts);
    await pool.query('UPDATE pengajuan_spk SET status=$1 WHERE id=$2',[approved,rows[1].id]);
    const snapshot=await all();
    await assert.rejects(repo.transition(rows[0].id,pending,rejected,reject));
    assert.deepEqual(await all(),snapshot); assert.equal((await pool.query('SELECT * FROM spk_approval_log')).rowCount,0);
});

test('intervention applies to both members with two audit records', async () => {
    const rows=await repo.saveSubmission(await seed(),opts);
    await repo.transition(rows[1].id,pending,approved,approve,{
        actor_email: approve.approver_email, actor_role:'BUILDING & MAINTENANCE SUPER HUMAN',
        target_status:approved, alasan_intervensi:'Synthetic verification',
    });
    assert.ok((await all()).every(r=>r.status===approved));
    assert.equal((await pool.query('SELECT * FROM activity_log')).rowCount,2);
});
test('group PDF link updates only explicit members; legacy URL stays unchanged', async () => {
    const [old]=await repo.saveSubmission(await seed('Z001-TEST-OLD',['SIPIL']),opts);
    await repo.updatePdfLink(old.id,'legacy.pdf');
    const rows=await repo.saveSubmission(await seed(),opts);
    await repo.updatePdfLink(rows[1].id,'combined.pdf');
    assert.ok((await repo.members(rows[0].id)).every(r=>r.link_pdf==='combined.pdf'));
    assert.equal((await repo.members(old.id))[0].link_pdf,'legacy.pdf');
});

test('actual additive migration is repeatable and does not backfill legacy groups', async () => {
    const [old]=await repo.saveSubmission(await seed('Z001-TEST-MIG',['SIPIL']),opts);
    const snapshot=await all();
    const migration=readFileSync(resolve(__dirname,'../../../sql/2026-09-10-spk-groups.sql'),'utf8');
    await pool.query(migration); await pool.query(migration);
    assert.deepEqual(await all(),snapshot);
    assert.equal((await repo.members(old.id))[0].spk_group_id,null);
});
test('candidate SQL filters branch before returning rows', async () => {
    await seed();
    assert.equal((await repo.candidates(undefined,undefined,['CILACAP'])).length,0);
    assert.equal((await repo.candidates(undefined,undefined,['HEAD OFFICE'])).length,2);
});


test('duration always follows approved RAB even when submission is tampered', async () => {
    const p = await seed();
    await pool.query("UPDATE rab SET durasi_pekerjaan='40' WHERE id_toko=$1", [p.member_toko_ids[1]]);
    const rows = await repo.saveSubmission({...p, durasi: 1}, opts);
    assert.deepEqual(rows.map(row => row.durasi), [40, 40]);
});
