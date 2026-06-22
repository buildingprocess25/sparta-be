const http = require('http');

http.get('http://localhost:8000/api/dashboard/history-approval-all?email=mahdi.alatas@sat.co.id', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const tz01 = json.data.find(d => d.nomor_ulok === 'TZ01-2603-TC56-R' && d.tipe === 'OPNAME');
    console.log(JSON.stringify(tz01, null, 2));
  });
});
