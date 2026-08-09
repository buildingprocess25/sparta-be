const fs = require('fs');
const zlib = require('zlib');
const readline = require('readline');
const path = require('path');

async function run() {
  const gzPath = 'C:\\alfamart\\SPARTA\\database-backup\\2026-08-05T19-00-00-166Z.sql.gz';
  const outKpg = 'C:\\alfamart\\SPARTA\\sparta-be\\backup_kpg.tsv';
  const outDgc = 'C:\\alfamart\\SPARTA\\sparta-be\\backup_dgc.tsv';

  console.log(`Extracting from ${gzPath}...`);
  
  const readStream = fs.createReadStream(gzPath);
  const gunzip = zlib.createGunzip();
  const rl = readline.createInterface({
    input: readStream.pipe(gunzip),
    crlfDelay: Infinity
  });

  const wsKpg = fs.createWriteStream(outKpg);
  const wsDgc = fs.createWriteStream(outDgc);

  let currentBlock = null;
  let countKpg = 0;
  let countDgc = 0;

  for await (const line of rl) {
    if (line.startsWith('COPY public.kategori_pekerjaan_gantt (')) {
      currentBlock = 'kpg';
      console.log('Found block: kategori_pekerjaan_gantt');
      continue;
    } else if (line.startsWith('COPY public.day_gantt_chart (')) {
      currentBlock = 'dgc';
      console.log('Found block: day_gantt_chart');
      continue;
    } else if (line === '\\.') {
      if (currentBlock) {
        console.log(`End of block ${currentBlock}`);
        currentBlock = null;
      }
      continue;
    }

    if (currentBlock === 'kpg') {
      wsKpg.write(line + '\n');
      countKpg++;
    } else if (currentBlock === 'dgc') {
      wsDgc.write(line + '\n');
      countDgc++;
    }
  }

  wsKpg.close();
  wsDgc.close();

  console.log(`Extraction complete.`);
  console.log(`kategori_pekerjaan_gantt rows: ${countKpg}`);
  console.log(`day_gantt_chart rows: ${countDgc}`);
}

run().catch(console.error);
