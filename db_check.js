const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable' });
client.connect().then(() => {
    return client.query(`SELECT check_clause FROM information_schema.check_constraints WHERE constraint_schema = 'public'`);
}).then(r => {
    console.log("Checks:");
    console.log(JSON.stringify(r.rows, null, 2));
    return client.query(`SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name = 'toko'`);
}).then(r => {
    console.log("Toko columns:");
    console.log(JSON.stringify(r.rows, null, 2));
}).catch(console.error).finally(() => client.end());
