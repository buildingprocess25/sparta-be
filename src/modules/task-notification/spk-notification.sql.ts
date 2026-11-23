export function spkNotificationSql(branchWhere:string,limitParameter:number,revision=false){
 return `WITH eligible AS (
 SELECT p.*,t.cabang,t.nama_toko FROM pengajuan_spk p LEFT JOIN toko t ON t.id=p.id_toko
 WHERE p.status='${revision?'SPK_REJECTED':'WAITING_FOR_BM_APPROVAL'}' ${branchWhere}
 ), marked AS (
 SELECT *,spk_group_id IS NOT NULL AND count(*) OVER matching=2
 AND count(*) FILTER(WHERE upper(trim(lingkup_pekerjaan))='SIPIL') OVER matching=1
 AND count(*) FILTER(WHERE upper(trim(lingkup_pekerjaan))='ME') OVER matching=1 AS combined
 FROM eligible WINDOW matching AS(PARTITION BY spk_group_id,nomor_ulok,cabang)
 ), canonical AS (
 SELECT DISTINCT ON(CASE WHEN combined THEN spk_group_id::text ELSE 'row:'||id END) *
 FROM marked ORDER BY CASE WHEN combined THEN spk_group_id::text ELSE 'row:'||id END,
 CASE WHEN upper(trim(lingkup_pekerjaan))='SIPIL' THEN 0 ELSE 1 END,id
 ) SELECT '${revision?'SPK_REJECTED':'SPK'}' AS entity_type,id AS entity_id,id_toko,
 coalesce(nama_toko,nomor_ulok) AS title,nomor_ulok,
 CASE WHEN combined THEN 'SIPIL + ME' ELSE lingkup_pekerjaan END AS lingkup_pekerjaan,cabang,status,
 ${revision?"coalesce('Alasan: '||nullif(alasan_penolakan,''),'SPK perlu diperbaiki/diajukan ulang.')":"'SPK menunggu approval Branch Manager.'"} AS description,
 '${revision?'Revisi SPK':'Buka Approval SPK'}' AS action_label,
 ${revision?"'/spk?spk_id='||id||'&id_toko='||coalesce(id_toko::text,'')":"'/approval?type=SPK&id='||id"} AS action_url,
 count(*) OVER() AS total_count FROM canonical ORDER BY created_at DESC,id DESC LIMIT $${limitParameter}`;
}
