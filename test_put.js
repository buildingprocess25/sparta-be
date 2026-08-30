const http = require('http');

const data = JSON.stringify({
  items: [
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
  ]
});

// use multipart/form-data because that's what the API expects!
const FormData = require('form-data');
const form = new FormData();
form.append('items', JSON.stringify([{
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
}]));

form.submit({
  host: 'localhost',
  port: 8080,
  path: '/api/pengawasan/bulk',
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer ' + require('fs').readFileSync('token.json', 'utf8') // I don't have the token, wait.
  }
}, function(err, res) {
  if(err) {
      console.error(err);
      return;
  }
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log(res.statusCode, body));
});
