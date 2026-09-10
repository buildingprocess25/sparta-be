import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSpkCandidates, approvedSpkTotal, type SpkCandidateSource } from './spk-group.rules';

const row = (scope: string, extra: Partial<SpkCandidateSource> = {}): SpkCandidateSource => ({
    id_toko: scope === 'SIPIL' ? 1 : 2, nomor_ulok: 'TEST-01', lingkup_pekerjaan: scope,
    cabang: 'CILACAP', nama_toko: 'Toko Uji', kode_toko: 'T123', alamat: 'Alamat',
    proyek: 'Reguler', nama_pt: 'PT UJI', rab_id: 10, grand_total_final: '100', grand_total: '200',
    has_spk: false, latest_spk_id: null, latest_status: null, spk_group_id: null, ...extra,
});
test('both approved and no history become one candidate with separate costs', () => {
    const result = buildSpkCandidates([row('SIPIL'), row('ME', { grand_total_final: '50' })]);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].member_toko_ids, [1, 2]);
    assert.equal(result[0].grand_total_final, 150);
    assert.equal(result[0].lingkup_pekerjaan, 'SIPIL + ME');
});
test('any legacy history including rejection prevents merging', () => {
    for (const status of ['SPK_APPROVED', 'WAITING_FOR_BM_APPROVAL', 'SPK_REJECTED']) {
        const result = buildSpkCandidates([row('SIPIL', { has_spk: true, latest_status: status }), row('ME')]);
        assert.ok(result.every(r => r.member_toko_ids.length === 1));
        assert.ok(result.some(r => r.lingkup_pekerjaan === 'ME'));
    }
});
test('missing approval cannot form group', () => {
    const result = buildSpkCandidates([row('SIPIL'), row('ME', { rab_id: null })]);
    assert.equal(result.length, 1);
    assert.equal(result[0].lingkup_pekerjaan, 'SIPIL');
});
test('contractor conflict blocks group, does not replace contractor', () => {
    const result = buildSpkCandidates([row('SIPIL'), row('ME', { nama_pt: 'CV LAIN' })]);
    assert.match(result[0].blocked_reason || '', /kontraktor/i);
});
test('valid zero approved cost is preserved', () => {
    assert.equal(approvedSpkTotal(row('SIPIL', { grand_total_final: '0' })), 0);
});
test('rejected explicit group stays grouped; different old groups never merge', () => {
    const group = { has_spk: true, latest_status: 'SPK_REJECTED', spk_group_id: 'same-group' };
    assert.equal(buildSpkCandidates([row('SIPIL', group), row('ME', group)])[0].member_toko_ids.length, 2);
    assert.ok(buildSpkCandidates([row('SIPIL', group), row('ME', { ...group, spk_group_id: 'other' })]).every(r => r.blocked_reason));
});
test('different full ULOK and branch never pair', () => {
    const result = buildSpkCandidates([row('SIPIL'), row('ME', { nomor_ulok: 'TEST-01-R' })]);
    assert.equal(result.length, 2);
    const mixed = buildSpkCandidates([row('SIPIL'), row('ME', { cabang: 'BATAM' })]);
    assert.equal(mixed.length, 2);
});

test('combined duration starts with longest RAB and single duration remains unchanged', () => {
    const grouped = buildSpkCandidates([row('SIPIL', { durasi_pekerjaan: '20' }), row('ME', { durasi_pekerjaan: '30' })]);
    assert.equal(grouped[0].durasi_pekerjaan, '30');
    assert.equal(buildSpkCandidates([row('SIPIL', { durasi_pekerjaan: '20' })])[0].durasi_pekerjaan, '20');
});

test('malformed approved cost blocks only its candidate instead of breaking entire list', () => {
    const result = buildSpkCandidates([row('SIPIL', { grand_total_final: 'invalid' }), row('ME', { nomor_ulok: 'OTHER' })]);
    assert.match(result[0].blocked_reason || '', /Nilai RAB/);
    assert.equal(result[1].blocked_reason, undefined);
});
