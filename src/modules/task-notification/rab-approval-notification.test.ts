import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client} from 'pg';
import {rabApprovalNotificationSql} from './rab-approval-notification.sql';
test('RAB notifications group before limit and count, retaining scope and access boundaries',async()=>{
 const raw=process.env.SPK_TEST_DATABASE_URL;
 if(!raw)throw Error('Dedicated local test database required');
 const url=new URL(raw);if(url.hostname!=='127.0.0.1'||url.pathname!=='/spk_group_integration')throw Error('Local test database only');
 const c=new Client({connectionString:raw,ssl:false});await c.connect();
 try{
  await c.query('BEGIN');
  await c.query(`CREATE TEMP TABLE toko(id int,nomor_ulok varchar,lingkup_pekerjaan varchar,cabang varchar,proyek varchar,nama_toko varchar) ON COMMIT DROP;
  CREATE TEMP TABLE rab(id int,id_toko int,status varchar,nama_pt varchar,created_at timestamp) ON COMMIT DROP;
  INSERT INTO toko SELECT n,'ULOK-'||((n+1)/2),CASE WHEN n%2=1 THEN 'SIPIL' ELSE 'ME' END,'HEAD OFFICE','Reguler','Fixture' FROM generate_series(1,50) n;
  INSERT INTO rab SELECT n,n,'Menunggu Persetujuan Manajer','CV FIXTURE','2026-09-13'::timestamp FROM generate_series(1,50) n;`);
  const args=[['Menunggu Persetujuan Manajer'],20];
  let rows=(await c.query(rabApprovalNotificationSql('','',2),args)).rows;
  assert.equal(rows.length,20);assert.ok(rows.every(r=>Number(r.total_count)===25&&r.lingkup_pekerjaan==='SIPIL + ME'&&r.entity_id%2===1));
  await c.query("UPDATE rab SET nama_pt='OTHER' WHERE id=2");
  rows=(await c.query(rabApprovalNotificationSql('','',2),args)).rows;assert.equal(Number(rows[0].total_count),26);
  rows=(await c.query(rabApprovalNotificationSql("AND t.cabang='NO ACCESS'",'',2),args)).rows;assert.equal(rows.length,0);
  rows=(await c.query(rabApprovalNotificationSql('',"AND r.nama_pt='OTHER'",2),args)).rows;
  assert.equal(rows.length,1);assert.equal(rows[0].lingkup_pekerjaan,'ME');assert.equal(rows[0].action_url,'/approval?type=RAB&id=2');
  await c.query('ROLLBACK');
 }finally{await c.end();}
});
