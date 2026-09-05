const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/sparta?sslmode=disable' });
client.connect()
    .then(() => client.query('SELECT * FROM "User" WHERE email = \'nspakun396@gmail.com\''))
    .then(res => console.table(res.rows))
    .catch(console.error)
    .finally(() => client.end());
