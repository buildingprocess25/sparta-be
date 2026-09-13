import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {buildRabPdfBuffer,buildRecapPdfBuffer,generateSphPdf,mergePdfBuffers,buildRabScopeSections} from '../modules/rab/rab.pdf';
import {buildRabDocumentExcel} from '../modules/rab/rab-document.excel';
async function main(){
 const out=resolve('../artifacts/rab-document-fixtures');mkdirSync(out,{recursive:true});
 const base:any={nama_pt:'CV KONTRAKTOR UJI',created_at:'2026-09-10',durasi_pekerjaan:'20',no_sph:1,email_pembuat:'fixture@example.invalid',grand_total:'3413000',grand_total_non_sbo:'3413000',grand_total_final:'3785100'};
 const toko:any={id:1,nomor_ulok:'Z001-UJI-RAB',nama_toko:'TOKO UJI GABUNGAN',cabang:'HEAD OFFICE',proyek:'Reguler',alamat:'Alamat pengujian',lingkup_pekerjaan:'SIPIL'};
 const item=(id:number,category:string,total:number):any=>({id,kategori_pekerjaan:category,jenis_pekerjaan:'Item uji '+category,satuan:'Ls',volume:'1',harga_material:String(total),harga_upah:'0',total_material:total,total_upah:0,total_harga:total});
 const sipil={rab:{...base,id:1},toko,items:[item(1,'PERSIAPAN',3413000)]};
 const me={rab:{...base,id:2,grand_total:'2456600',grand_total_non_sbo:'2456600',grand_total_final:'2719500'},toko:{...toko,id:2,lingkup_pekerjaan:'ME'},items:[item(2,'INSTALASI',2000000),item(3,'PEKERJAAN SBO',456600)]};
 const input={...me,siblingRab:sipil.rab,siblingToko:sipil.toko,siblingItems:sipil.items};
 const sections=buildRabScopeSections(input);assert.deepEqual(sections.map(s=>s.scope),['SIPIL','ME']);assert.equal(sections[1].groups[1].category,'PEKERJAAN SBO');
 const sph=await generateSphPdf(input),recap=await buildRecapPdfBuffer(input),rab=await buildRabPdfBuffer(input);
 for(const [name,buffer] of [['sph',sph],['recap',recap],['rab',rab],['combined',await mergePdfBuffers([sph,recap,rab])],['legacy',await buildRabPdfBuffer(sipil)]] as const)writeFileSync(resolve(out,name+'.pdf'),buffer);
 const excel=buildRabDocumentExcel([me,sipil]);writeFileSync(resolve(out,'combined.xlsx'),excel);
 const workbook=XLSX.read(excel,{type:'buffer'});assert.deepEqual(workbook.SheetNames,['Penawaran','Rekapitulasi','RAB Items']);
 const rows=XLSX.utils.sheet_to_json(workbook.Sheets['RAB Items'],{header:1}) as any[][];
 assert.ok(rows.findIndex(r=>r[0]==='A. PEKERJAAN SIPIL')<rows.findIndex(r=>r[0]==='B. PEKERJAAN ME'));
 assert.ok(rows.some(r=>r[0]==='GRAND TOTAL ME'&&r[1]===2719500));
 console.log('PASS: PDF fixtures, source-scope category grouping, scope totals and Excel readback');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
