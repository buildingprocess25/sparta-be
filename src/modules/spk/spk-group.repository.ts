import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool, withTransaction } from '../../db/pool';
import { AppError } from '../../common/app-error';
import { normalizeProjectByUlok } from '../../common/project-type';
import { activityLogRepository } from '../activity-log/activity-log.repository';
import { SPK_STATUS, getCabangCode, type SpkStatus } from './spk.constants';
import type { PengajuanSpkRow } from './spk.repository';
import type { SubmitSpkInput, SpkApprovalInput, SpkInterventionInput } from './spk.schema';
import { approvedSpkTotal, buildSpkCandidates, normalizeSpkIdentity, type SpkCandidateSource } from './spk-group.rules';

export const spkGroupRepository = {
    async candidates(client?: PoolClient, nomorUlok?: string, branches?: string[]): Promise<SpkCandidateSource[]> {
        const result = await (client ?? pool).query<SpkCandidateSource>(`
            SELECT t.id AS id_toko,t.nomor_ulok,t.lingkup_pekerjaan,t.cabang,t.nama_toko,
                t.kode_toko,t.alamat,t.proyek,r.id AS rab_id,r.nama_pt,r.grand_total,
                r.grand_total_final,r.grand_total_non_sbo,r.durasi_pekerjaan,
                s.id IS NOT NULL AS has_spk,s.id AS latest_spk_id,s.status AS latest_status,s.spk_group_id
            FROM toko t
            LEFT JOIN LATERAL (SELECT * FROM rab WHERE id_toko=t.id AND status='Disetujui'
                ORDER BY created_at DESC NULLS LAST,id DESC LIMIT 1) r ON true
            LEFT JOIN LATERAL (SELECT p.id,p.status,p.spk_group_id FROM pengajuan_spk p
                WHERE p.id_toko=t.id OR (upper(trim(p.nomor_ulok))=upper(trim(t.nomor_ulok))
                    AND upper(trim(p.lingkup_pekerjaan))=upper(trim(t.lingkup_pekerjaan)))
                ORDER BY p.created_at DESC,p.id DESC LIMIT 1) s ON true
            WHERE ($1::text IS NULL OR upper(trim(t.nomor_ulok))=upper(trim($1)))
                AND upper(trim(t.lingkup_pekerjaan)) IN ('SIPIL','ME')
                AND ($2::text[] IS NULL OR replace(upper(trim(t.cabang)), '_', ' ')=ANY($2))
            ORDER BY t.id`, [nomorUlok ?? null, branches ?? null]);
        return result.rows;
    },

    async members(id: string, client?: PoolClient, lock = false): Promise<PengajuanSpkRow[]> {
        const result = await (client ?? pool).query<PengajuanSpkRow>(`
            SELECT p.* FROM pengajuan_spk p WHERE p.id=$1 OR
                p.spk_group_id=(SELECT spk_group_id FROM pengajuan_spk WHERE id=$1)
            ORDER BY p.id ${lock ? 'FOR UPDATE OF p' : ''}`, [id]);
        const members = result.rows;
        if (!members.length) throw new AppError('Pengajuan SPK tidak ditemukan', 404);
        if (members[0].spk_group_id && (members.length !== 2
            || new Set(members.map(m => normalizeSpkIdentity(m.lingkup_pekerjaan))).size !== 2
            || !members.every(m => ['SIPIL','ME'].includes(normalizeSpkIdentity(m.lingkup_pekerjaan))
                && m.spk_group_id === members[0].spk_group_id
                && normalizeSpkIdentity(m.nomor_ulok) === normalizeSpkIdentity(members[0].nomor_ulok)))) {
            throw new AppError('Anggota SPK gabungan tidak konsisten', 409);
        }
        return members;
    },

    async saveSubmission(payload: SubmitSpkInput, options: {
        terbilang: (value: number) => string;
        validate: (members: SpkCandidateSource[]) => Promise<void>;
    }): Promise<PengajuanSpkRow[]> {
        return withTransaction(async client => {
            // Same lock for single and combined paths, including before a new SPK exists.
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['spk:ulok:' + normalizeSpkIdentity(payload.nomor_ulok)]);
            await client.query('SELECT id FROM toko WHERE upper(trim(nomor_ulok))=upper(trim($1)) ORDER BY id FOR UPDATE', [payload.nomor_ulok]);
            let sources = await this.candidates(client, payload.nomor_ulok);
            const rabIds = sources.flatMap(s => s.rab_id == null ? [] : [s.rab_id]);
            if (rabIds.length) await client.query('SELECT id FROM rab WHERE id=ANY($1::int[]) ORDER BY id FOR SHARE', [rabIds]);
            sources = await this.candidates(client, payload.nomor_ulok);
            const selected = buildSpkCandidates(sources).find(c => c.member_toko_ids.includes(payload.id_toko));
            if (!selected) throw new AppError('SPK sudah ada atau RAB belum disetujui. Muat ulang daftar ULOK.', 409);
            if (selected.blocked_reason) throw new AppError(selected.blocked_reason, 409);
            const requested = payload.member_toko_ids ?? [payload.id_toko];
            if (new Set(requested).size !== requested.length || requested.length !== selected.member_toko_ids.length
                || !requested.every(id => selected.member_toko_ids.includes(id))) {
                throw new AppError('Lingkup SPK berubah. Muat ulang dan pilih pengajuan SIPIL + ME atau lingkup yang tersedia.', 409);
            }
            if (payload.spk_group_id && payload.spk_group_id !== selected.spk_group_id) throw new AppError('Grup SPK tidak cocok', 409);
            const scope = normalizeSpkIdentity(payload.lingkup_pekerjaan);
            if (scope !== selected.lingkup_pekerjaan && !(selected.member_toko_ids.length === 2 && scope === 'GABUNGAN')) {
                throw new AppError('Lingkup SPK tidak cocok dengan toko yang dipilih', 409);
            }
            const members = selected.member_toko_ids.map(id => sources.find(s => s.id_toko === id)!);
            if (normalizeSpkIdentity(payload.nama_kontraktor) !== normalizeSpkIdentity(members[0].nama_pt)) {
                throw new AppError('Kontraktor SPK harus sesuai RAB disetujui', 409);
            }
            await options.validate(members);
            const rabDuration = Number(selected.durasi_pekerjaan);
            if (!Number.isInteger(rabDuration) || rabDuration <= 0) throw new AppError('Durasi RAB tidak valid. Periksa RAB yang disetujui.', 422);
            const existingIds = members.flatMap(m => m.latest_spk_id == null ? [] : [m.latest_spk_id]);
            const existing = existingIds.length ? (await client.query<PengajuanSpkRow>(
                'SELECT * FROM pengajuan_spk WHERE id=ANY($1::int[]) ORDER BY id FOR UPDATE', [existingIds])).rows : [];
            if (existing.length && (existing.length !== members.length || existing.some(p => p.status !== SPK_STATUS.SPK_REJECTED))) {
                throw new AppError('Pengajuan SPK sudah diproses', 409);
            }
            if (existing.some(p => !members.some(m => m.id_toko === p.id_toko))) {
                throw new AppError('Riwayat SPK menggunakan identitas toko berbeda. Periksa data sebelum revisi.', 409);
            }
            const groupId = members.length === 2 ? selected.spk_group_id ?? randomUUID() : null;
            if (existing.some(p => (p.spk_group_id ?? null) !== groupId)) throw new AppError('Keanggotaan revisi SPK tidak cocok', 409);
            const cabangCode = getCabangCode(members[0].cabang);
            // Serialize allocation until commit, shared by all single/combined submissions.
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['spk:number:' + cabangCode]);
            const suffix = `/PROPNDEV-${cabangCode}/${payload.spk_manual_1}/${payload.spk_manual_2}`;
            const numberResult = await client.query<{ next: string }>(`
                SELECT (greatest(
                    coalesce(max(CASE WHEN nomor_spk ~ '^[0-9]+/' AND substring(nomor_spk from position('/' in nomor_spk))=$1
                        THEN split_part(nomor_spk,'/',1)::numeric END),0),
                    count(DISTINCT coalesce(spk_group_id::text,'row:'||p.id::text)) FILTER (
                        WHERE upper(trim(t.cabang))=upper(trim($2))
                        AND date_trunc('month',p.created_at)=date_trunc('month',now()))
                )+1)::text AS next FROM pengajuan_spk p LEFT JOIN toko t ON t.id=p.id_toko`, [suffix, members[0].cabang]);
            const nomorSpk = existing[0]?.nomor_spk ?? `${String(numberResult.rows[0].next).padStart(3, '0')}${suffix}`;
            const result: PengajuanSpkRow[] = [];
            for (const member of members) {
                const total = approvedSpkTotal(member);
                const fields = {
                    id_toko: member.id_toko, nomor_ulok: member.nomor_ulok, email_pembuat: payload.email_pembuat,
                    lingkup_pekerjaan: normalizeSpkIdentity(member.lingkup_pekerjaan), nama_kontraktor: member.nama_pt,
                    proyek: normalizeProjectByUlok(member.nomor_ulok, member.proyek) ?? member.proyek ?? payload.proyek,
                    waktu_mulai: payload.waktu_mulai.slice(0, 10), durasi: rabDuration,
                    grand_total: total, terbilang: `( ${options.terbilang(Math.floor(total))} Rupiah )`,
                    nomor_spk: nomorSpk, par: payload.par, spk_manual_1: payload.spk_manual_1,
                    spk_manual_2: payload.spk_manual_2, status: SPK_STATUS.WAITING_FOR_BM_APPROVAL, spk_group_id: groupId,
                };
                const keys = Object.keys(fields);
                const values: unknown[] = Object.values(fields);
                const old = existing.find(p => p.id_toko === member.id_toko);
                let sql: string;
                if (old) {
                    values.push(old.id);
                    sql = `UPDATE pengajuan_spk SET ${keys.map((key, i) => `${key}=$${i+1}`).join(',')},
                        waktu_selesai=($7::date + ($8::int-1))::timestamp AT TIME ZONE 'Asia/Jakarta',
                        link_pdf=NULL,approver_email=NULL,waktu_persetujuan=NULL,alasan_penolakan=NULL,created_at=now()
                        WHERE id=$${values.length} RETURNING *`;
                } else {
                    sql = `INSERT INTO pengajuan_spk (${keys.join(',')},waktu_selesai,created_at)
                        VALUES (${keys.map((_, i) => `$${i+1}`).join(',')},
                        ($7::date + ($8::int-1))::timestamp AT TIME ZONE 'Asia/Jakarta',now()) RETURNING *`;
                }
                result.push((await client.query<PengajuanSpkRow>(sql, values)).rows[0]);
                await client.query('UPDATE toko SET kode_toko=$1 WHERE id=$2', [payload.kode_toko.trim().toUpperCase(), member.id_toko]);
            }
            return result;
        });
    },

    async transition(id: string, expected: SpkStatus, target: SpkStatus, action: SpkApprovalInput,
        intervention?: SpkInterventionInput): Promise<PengajuanSpkRow[]> {
        return withTransaction(async client => {
            const members = await this.members(id, client, true);
            if (members.some(m => m.status !== expected) || expected === target) throw new AppError('Status SPK sudah berubah. Muat ulang pengajuan.', 409);
            const reason = intervention ? `[INTERVENSI SUPER HUMAN] ${expected} -> ${target}. ${intervention.alasan_intervensi?.trim() ?? ''}` : action.alasan_penolakan ?? null;
            for (const member of members) {
                await client.query(`UPDATE pengajuan_spk SET status=$1::text,
                    approver_email=CASE WHEN $1::text='SPK_APPROVED' THEN $2 ELSE NULL END,
                    waktu_persetujuan=CASE WHEN $1::text='SPK_APPROVED' THEN now() ELSE NULL END,
                    alasan_penolakan=CASE WHEN $1::text='SPK_REJECTED' THEN $3 ELSE NULL END,
                    link_pdf=CASE WHEN spk_group_id IS NOT NULL OR $4 THEN NULL ELSE link_pdf END WHERE id=$5`,
                    [target,action.approver_email,reason,!!intervention,member.id]);
                await client.query(`INSERT INTO spk_approval_log
                    (pengajuan_spk_id,approver_email,tindakan,alasan_penolakan,catatan_approval,waktu_tindakan)
                    VALUES ($1,$2,$3,$4,$5,now())`,
                    [member.id,action.approver_email,action.tindakan,reason,action.catatan_approval?.trim() || null]);
                if (intervention) await activityLogRepository.insert({
                    entity_type: 'SPK',entity_id: Number(member.id),actor_email: intervention.actor_email,
                    actor_role: intervention.actor_role,action: 'INTERVENTION',status_before: expected,
                    status_after: target,reason: intervention.alasan_intervensi?.trim() || null,
                    metadata: { legacy_log_reason: reason, spk_group_id: member.spk_group_id ?? null },
                }, client);
            }
            return members;
        });
    },

    async updatePdfLink(id: string, link: string): Promise<void> {
        await pool.query(`UPDATE pengajuan_spk SET link_pdf=$2 WHERE id=$1 OR
            spk_group_id=(SELECT spk_group_id FROM pengajuan_spk WHERE id=$1)`, [id,link]);
    },
};
