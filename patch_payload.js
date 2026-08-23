const fs = require('fs');
const f = 'c:/alfamart/SPARTA/sparta-be/src/modules/pengawasan/pengawasan.service.ts';
let c = fs.readFileSync(f, 'utf8');
c = c.replace(
    /email_pembuat: emailPembuat,\r?\n\s*items: opnamePayloads/,
    'email_pembuat: emailPembuat,\n            grand_total_opname: "0",\n            grand_total_rab: "0",\n            items: opnamePayloads'
);
fs.writeFileSync(f, c);
console.log('Patch success!');
