export const normalizeSpkIdentity = (value: unknown): string => String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

export type SpkCandidateSource = {
    id_toko: number; nomor_ulok: string; lingkup_pekerjaan: string; cabang: string;
    nama_toko: string; kode_toko: string; alamat: string; proyek: string; nama_pt: string;
    rab_id: number | null; grand_total_final: string | number | null; grand_total: string | number | null;
    grand_total_non_sbo?: string | number | null; durasi_pekerjaan?: string | number | null;
    has_spk: boolean; latest_spk_id: string | null; latest_status: string | null; spk_group_id: string | null;
};

export function approvedSpkTotal(row: Pick<SpkCandidateSource, 'grand_total_final' | 'grand_total'>): number {
    const raw = row.grand_total_final == null || String(row.grand_total_final).trim() === ''
        ? row.grand_total : row.grand_total_final;
    const value = String(raw ?? '').trim();
    const parsed = /^\d+(\.\d+)?$/.test(value) ? Number(value) : Number(value.replace(/\./g, '').replace(',', '.'));
    if (!value || !Number.isFinite(parsed) || parsed < 0) throw new Error('Nilai RAB disetujui tidak valid');
    return parsed;
}

function candidate(members: SpkCandidateSource[], blocked_reason?: string) {
    const first = members[0];
    const totals = members.map(member => {
        let total = 0;
        try { total = approvedSpkTotal(member); }
        catch { blocked_reason ??= 'Nilai RAB disetujui belum valid. Periksa RAB sebelum mengajukan SPK.'; }
        return { id_toko: member.id_toko, lingkup_pekerjaan: normalizeSpkIdentity(member.lingkup_pekerjaan), grand_total: total };
    });
    const total = totals.reduce((sum, member) => sum + member.grand_total, 0);
    return {
        ...first, id: first.rab_id, member_toko_ids: members.map(member => member.id_toko),
        lingkup_pekerjaan: members.length === 2 ? 'SIPIL + ME' : normalizeSpkIdentity(first.lingkup_pekerjaan),
        durasi_pekerjaan: members.length === 2 ? String(Math.max(...members.map(m => Number(m.durasi_pekerjaan) || 0))) : first.durasi_pekerjaan,
        group_members: totals, grand_total: total, grand_total_final: total, blocked_reason,
        toko: { id: first.id_toko, nomor_ulok: first.nomor_ulok, nama_toko: first.nama_toko,
            kode_toko: first.kode_toko, alamat: first.alamat, cabang: first.cabang },
    };
}

export function buildSpkCandidates(rows: SpkCandidateSource[]) {
    const buckets = new Map<string, SpkCandidateSource[]>();
    for (const row of rows) {
        const key = [row.nomor_ulok, row.cabang, row.proyek].map(normalizeSpkIdentity).join('|');
        buckets.set(key, [...(buckets.get(key) ?? []), row]);
    }
    const result: ReturnType<typeof candidate>[] = [];
    for (const bucket of buckets.values()) {
        const sipil = bucket.filter(row => normalizeSpkIdentity(row.lingkup_pekerjaan) === 'SIPIL');
        const me = bucket.filter(row => normalizeSpkIdentity(row.lingkup_pekerjaan) === 'ME');
        const members = [sipil[0], me[0]];
        const pair = sipil.length === 1 && me.length === 1 && members.every(row => row.rab_id != null);
        const fresh = pair && members.every(row => !row.has_spk);
        const revision = pair && members.every(row => row.latest_status === 'SPK_REJECTED')
            && !!members[0].spk_group_id && members[0].spk_group_id === members[1].spk_group_id;
        if (fresh || revision) {
            const contractor = normalizeSpkIdentity(members[0].nama_pt);
            const conflict = !contractor || contractor !== normalizeSpkIdentity(members[1].nama_pt);
            result.push(candidate(members, conflict ? 'Kontraktor RAB SIPIL dan ME berbeda atau belum lengkap. Samakan data kontraktor sebelum mengajukan SPK gabungan.' : undefined));
        } else {
            for (const row of bucket) {
                if (row.rab_id == null || (row.has_spk && row.latest_status !== 'SPK_REJECTED')) continue;
                result.push(candidate([row], row.spk_group_id ? 'Anggota SPK gabungan tidak lengkap atau statusnya berbeda. Periksa pengajuan gabungan.' : undefined));
            }
        }
    }
    return result;
}
