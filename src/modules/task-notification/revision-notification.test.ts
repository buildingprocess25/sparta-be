import {test} from 'node:test';import assert from 'node:assert/strict';import {Client} from 'pg';
import {spkNotificationSql} from './spk-notification.sql';import {rabApprovalNotificationSql} from './rab-approval-notification.sql';
test('SPK approval and rejection respect explicit groups; RAB revision groups latest compatible pair',async()=>{
 const raw=process.env.SPK_TEST_DATABASE_URL;if(!raw)throw Error('Local test URL required');const u=new URL(raw);if(u.hostname!=='127.0.0.1'||u.pathname!=='/spk_group_integration')throw Error('Local only');
 const c=new Client({connectionString:raw,ssl:false});await c.connect();try{
 await c.query(`BEGIN;
 CREATE TEMP TABLE toko(id int,nomor_ulok text,lingkup_pekerjaan text,cabang text,proyek text,nama_toko text) ON COMMIT DROP;
 CREATE TEMP TABLE pengajuan_spk(id int,id_toko int,nomor_ulok text,lingkup_pekerjaan text,spk_group_id uuid,status varchar,alasan_penolakan text,created_at timestamp) ON COMMIT DROP;
 INSERT INTO toko SELECT n,'ULOK','SIPIL','HO','Reguler','Fixture' FROM generate_series(1,4)n;
 INSERT INTO pengajuan_spk SELECT n,n,'ULOK',CASE WHEN n%2=1 THEN 'SIPIL' ELSE 'ME' END,CASE WHEN n<=2 THEN '11111111-1111-4111-8111-111111111111'::uuid ELSE NULL END,'WAITING_FOR_BM_APPROVAL','Revisi uji',now() FROM generate_series(1,4)n;`);
 for(const revision of [false,true]){
 if(revision)await c.query("UPDATE pengajuan_spk SET status='SPK_REJECTED'");
 const rows=(await c.query(spkNotificationSql('',1,revision),[20])).rows;
 assert.equal(rows.length,3);assert.ok(rows.every(r=>Number(r.total_count)===3));
 assert.equal(rows.filter(r=>r.lingkup_pekerjaan==='SIPIL + ME').length,1);
 assert.equal(rows.find(r=>r.lingkup_pekerjaan==='SIPIL + ME').entity_id,1);
 }
 await c.query(`CREATE TEMP TABLE rab(id int,id_toko int,status varchar,nama_pt text,alasan_penolakan text,created_at timestamp) ON COMMIT DROP;
 UPDATE toko SET lingkup_pekerjaan='ME' WHERE id=2;
 INSERT INTO rab VALUES(1,1,'Ditolak oleh Manajer','CV UJI','Catatan',now()),(2,2,'Ditolak oleh Manajer','CV UJI','Catatan',now());`);
 let rows=(await c.query(rabApprovalNotificationSql('','',1,true),[20])).rows;
 assert.equal(rows.length,1);assert.equal(rows[0].lingkup_pekerjaan,'SIPIL + ME');assert.equal(rows[0].action_url,'/rab?revision_id=1');assert.equal(rows[0].description,'Alasan: Catatan');
 await c.query("INSERT INTO rab VALUES(3,1,'Disetujui','CV UJI',NULL,now())");
 rows=(await c.query(rabApprovalNotificationSql('','',1,true),[20])).rows;assert.equal(rows.length,1);assert.equal(rows[0].entity_id,2);assert.equal(rows[0].lingkup_pekerjaan,'ME');
 await c.query('ROLLBACK');
 }finally{await c.end();}
});
