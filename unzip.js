const fs = require('fs');
const zlib = require('zlib');
const readStream = fs.createReadStream('C:\\alfamart\\SPARTA\\database-backup\\2026-08-05T19-00-00-166Z.sql.gz');
const writeStream = fs.createWriteStream('C:\\alfamart\\SPARTA\\sparta-be\\backup.dump');
const gunzip = zlib.createGunzip();

console.log('Decompressing...');
readStream.pipe(gunzip).pipe(writeStream);

writeStream.on('finish', () => {
    console.log('Decompression finished.');
});
