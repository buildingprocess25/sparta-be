const { pool } = require('./src/db/pool');
const { pengawasanService } = require('./src/modules/pengawasan/pengawasan.service');

async function main() {
  const items = [
    {
      id: 44926,
      kategori_pekerjaan: "PEKERJAAN SANITARY & ACECORIES",
      jenis_pekerjaan: "INSTALASI AIR BERSIH PVC 1/2\" AW TYPE TERMASUK CLAMP, FITTING ,  DLL",
      status: "selesai",
      opname_data: {
        id_toko: 1267,
        id_rab_item: 143286,
        volume_akhir: 23,
        selisih_volume: 0,
        total_selisih: 0,
        total_harga_opname: 510600,
        desain: "Sesuai",
        kualitas: "Baik",
        spesifikasi: "Sesuai"
      }
    }
  ];

  try {
    const result = await pengawasanService.updateBulk(
      items,
      [], // uploadedDokumentasiFiles
      undefined, // uploadedDokumentasiIndexes
      [], // uploadedFotoOpnameFiles
      undefined, // uploadedFotoOpnameIndexes
      'dimasfadly01@outlook.com'
    );
    console.log("Success:", result);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    pool.end();
  }
}

main();
