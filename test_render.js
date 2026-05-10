// Test 1: JSON
fetch('https://sparta-be.onrender.com/api/projek-planning/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id_toko: 843,
    nomor_ulok: "1M7S",
    email_pembuat: "test@sat.co.id",
    lingkup_pekerjaan: "Sipil",
    jenis_proyek: "Renovasi",
    nama_pengaju: "Test User",
    nama_lokasi: "Test Lokasi",
    jenis_pengajuan: "LAINNYA",
    nama_toko: "Test"
  })
}).then(r => r.text()).then(v => console.log("JSON:", v));

// Test 2: FormData (multipart)
const form = new FormData();
form.append('id_toko', '843');
form.append('nomor_ulok', '1M7S');
form.append('email_pembuat', 'test@sat.co.id');
form.append('lingkup_pekerjaan', 'Sipil');
form.append('jenis_proyek', 'Renovasi');
form.append('nama_pengaju', 'Test User');
form.append('nama_lokasi', 'Test Lokasi');
form.append('jenis_pengajuan', 'LAINNYA');

fetch('https://sparta-be.onrender.com/api/projek-planning/submit', {
  method: 'POST',
  body: form
}).then(r => r.text()).then(v => console.log("FormData:", v));
