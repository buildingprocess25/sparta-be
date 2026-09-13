import type { RabRow, RabItemRow, TokoJoinRow } from './rab.repository';

export type RabDocumentScope = { rab: RabRow; toko: TokoJoinRow; items: RabItemRow[] };
export function rabAmount(value: unknown): number {
 if (value == null || String(value).trim() === '') return 0;
 const raw = String(value).trim();
 const normalized = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw) ? raw.replace(/\./g,'').replace(',','.') : raw.replace(',','.');
 const n = Number(normalized);
 if (!Number.isFinite(n)) throw new Error('Nilai RAB tidak valid');
 return n;
}
export function sortRabDocumentScopes(scopes: RabDocumentScope[]) {
 return [...scopes].sort((a,b)=>(a.toko.lingkup_pekerjaan?.toUpperCase()==='SIPIL'?0:1)-(b.toko.lingkup_pekerjaan?.toUpperCase()==='SIPIL'?0:1));
}
export function rabDocumentTotals(scope: RabDocumentScope) {
 const has = (v: unknown) => v != null && String(v).trim() !== '';
 const sourceTotal = has(scope.rab.grand_total) ? rabAmount(scope.rab.grand_total) : scope.items.reduce((sum,i)=>sum+rabAmount(i.total_harga),0);
 const basis = has(scope.rab.grand_total_non_sbo) ? rabAmount(scope.rab.grand_total_non_sbo) : sourceTotal;
 const roundedDown = Math.floor(basis/10000)*10000;
 const finalTotal = has(scope.rab.grand_total_final) ? rabAmount(scope.rab.grand_total_final) : roundedDown*(/BATAM|BINTAN/i.test(scope.toko.cabang ?? '')?1:1.11);
 return {sourceTotal, roundedDown, ppn:finalTotal-roundedDown, finalTotal};
}
