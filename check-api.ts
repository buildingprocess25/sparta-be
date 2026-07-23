import fetch from 'node-fetch';

async function run() {
   const res = await fetch('http://localhost:3000/api/dashboard/all?search=UZ01-2602-0010');
   const data = await res.json();
   console.log(JSON.stringify(data.data[0]?.berkas_serah_terima, null, 2));
}
run();
