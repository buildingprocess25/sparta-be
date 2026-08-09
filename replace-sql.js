const fs = require('fs');
let kpg = fs.readFileSync('C:/alfamart/SPARTA/sparta-be/kpg.sql', 'utf-8');
kpg = kpg.replace(/public\.kategori_pekerjaan_gantt/g, 'public.temp_kategori_pekerjaan_gantt');
fs.writeFileSync('C:/alfamart/SPARTA/sparta-be/kpg_temp.sql', kpg);

let dgc = fs.readFileSync('C:/alfamart/SPARTA/sparta-be/dgc.sql', 'utf-8');
dgc = dgc.replace(/public\.day_gantt_chart/g, 'public.temp_day_gantt_chart');
fs.writeFileSync('C:/alfamart/SPARTA/sparta-be/dgc_temp.sql', dgc);
