import * as XLSX from 'xlsx';
import { rabAmount, rabDocumentTotals, sortRabDocumentScopes, type RabDocumentScope } from './rab-document';
export function buildRabDocumentExcel(input: RabDocumentScope[]): Buffer {
 const scopes=sortRabDocumentScopes(input), first=scopes[0];
 const label=scopes.map(s=>s.toko.lingkup_pekerjaan).join(' + ');
 const identity=[['RENCANA ANGGARAN BIAYA'],['Nomor ULOK',first.toko.nomor_ulok],['Nama Toko',first.toko.nama_toko],['Lingkup Pekerjaan',label],[]];
 const offer:any[][]=[...identity,['PENAWARAN PEKERJAAN'],...scopes.map(s=>['Penawaran pekerjaan '+s.toko.lingkup_pekerjaan,rabDocumentTotals(s).finalTotal])];
 const recap:any[][]=[...identity], items:any[][]=[...identity];
 const totals=(s:RabDocumentScope)=>{const t=rabDocumentTotals(s);return [['TOTAL',t.sourceTotal],['PEMBULATAN',t.roundedDown],['PPN',t.ppn],['GRAND TOTAL '+s.toko.lingkup_pekerjaan,t.finalTotal]];};
 scopes.forEach((s,index)=>{
  const title=`${String.fromCharCode(65+index)}. PEKERJAAN ${s.toko.lingkup_pekerjaan}`;
  recap.push([title],['Kategori','Total Material','Total Upah','Total Harga']);
  items.push([title]);
  const categories=new Map<string,typeof s.items>();
  s.items.forEach(i=>{const key=i.kategori_pekerjaan||'LAIN-LAIN';categories.set(key,[...(categories.get(key)||[]),i]);});
  for(const [category,rows] of categories){
   recap.push([category,...(['total_material','total_upah','total_harga'] as const).map(key=>rows.reduce((sum,r)=>sum+rabAmount(r[key]),0))]);
   items.push([category],['No','Jenis Pekerjaan','Satuan','Volume','Harga Material','Harga Upah','Total Material','Total Upah','Total Harga','Catatan']);
   rows.forEach((r,n)=>items.push([n+1,r.jenis_pekerjaan,r.satuan,rabAmount(r.volume),rabAmount(r.harga_material),rabAmount(r.harga_upah),rabAmount(r.total_material),rabAmount(r.total_upah),rabAmount(r.total_harga),r.catatan||'']));
  }
  recap.push(...totals(s),[]);items.push([]);
 });
 scopes.forEach(s=>items.push(['RINCIAN '+s.toko.lingkup_pekerjaan],...totals(s),[]));
 items.push(['Dibuat oleh',first.rab.email_pembuat],['Mengetahui',first.rab.nama_persetujuan_koordinator||first.rab.pemberi_persetujuan_koordinator||''],['Menyetujui',first.rab.nama_persetujuan_manager||first.rab.pemberi_persetujuan_manager||'']);
 const workbook=XLSX.utils.book_new();
 for(const [name,rows] of [['Penawaran',offer],['Rekapitulasi',recap],['RAB Items',items]] as const){
  const sheet=XLSX.utils.aoa_to_sheet(rows);sheet['!cols']=[{wch:34},{wch:48},...Array.from({length:8},()=>({wch:18}))];
  for(const key of Object.keys(sheet)){if(sheet[key]?.t==='n')sheet[key].z='#,##0.##';}
  XLSX.utils.book_append_sheet(workbook,sheet,name);
 }
 return XLSX.write(workbook,{type:'buffer',bookType:'xlsx'}) as Buffer;
}
