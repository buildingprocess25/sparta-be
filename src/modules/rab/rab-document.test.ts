import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rabAmount,rabDocumentTotals,sortRabDocumentScopes} from './rab-document';
const scope=(name:string):any=>({toko:{lingkup_pekerjaan:name,cabang:'HEAD OFFICE'},rab:{grand_total:'2456600',grand_total_non_sbo:'2456600',grand_total_final:'2719500'},items:[{kategori_pekerjaan:'PEKERJAAN SBO',total_harga:2456600}]});
test('document scopes follow toko identity, including ME SBO categories',()=>{
 const ordered=sortRabDocumentScopes([scope('ME'),scope('SIPIL')]);
 assert.deepEqual(ordered.map(s=>s.toko.lingkup_pekerjaan),['SIPIL','ME']);
 assert.equal(ordered[1].items[0].kategori_pekerjaan,'PEKERJAAN SBO');
});
test('amounts preserve decimals, formatted amounts and stored zero',()=>{
 assert.equal(rabAmount('2.456.600'),2456600);assert.equal(rabAmount('12.50'),12.5);
 const s=scope('ME'); assert.equal(rabDocumentTotals(s).finalTotal,2719500);
 s.rab.grand_total_final='0';assert.equal(rabDocumentTotals(s).finalTotal,0);
});
