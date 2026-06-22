import http from 'http';

http.get('http://127.0.0.1:8000/api/final_opname?aksi=terkunci&tipe_opname=OPNAME_FINAL', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const id59 = json.data.find((d: any) => d.id === 59);
    const id60 = json.data.find((d: any) => d.id === 60);
    console.log("ID 59:", id59?.grand_total_opname, "final:", id59?.grand_total_final);
    console.log("ID 60:", id60?.grand_total_opname, "final:", id60?.grand_total_final);
  });
}).on('error', (err) => {
  console.error("HTTP GET ERROR:", err.message);
});
