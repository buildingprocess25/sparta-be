import { pool } from '../db/pool';
import { spkGroupRepository } from '../modules/spk/spk-group.repository';
import { buildSpkCandidates } from '../modules/spk/spk-group.rules';

async function main() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN READ ONLY');
        const sources = await spkGroupRepository.candidates(client);
        const candidates = buildSpkCandidates(sources);
        for (const candidate of candidates) {
            if (candidate.member_toko_ids.length !== 2 || candidate.spk_group_id) continue;
            const members = sources.filter(s => candidate.member_toko_ids.includes(s.id_toko));
            if (members.length !== 2 || members.some(s => s.has_spk || !s.rab_id)) {
                throw new Error('Unexpected legacy member in new combined candidate');
            }
        }
        console.log(JSON.stringify({
            candidates: candidates.length,
            combined: candidates.filter(c => c.member_toko_ids.length === 2).length,
            blocked: candidates.filter(c => c.blocked_reason).length,
            examples: candidates.filter(c => c.nomor_ulok.startsWith('Z001') && c.member_toko_ids.length === 2).slice(-6).map(c => ({
                nomor_ulok: c.nomor_ulok, lingkup: c.lingkup_pekerjaan, blocked_reason: c.blocked_reason ?? null,
            })),
        }, null, 2));
        await client.query('ROLLBACK');
    } finally { client.release(); await pool.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
