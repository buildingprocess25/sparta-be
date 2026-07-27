const { Client } = require('pg');
const c = new Client('postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable');
c.connect().then(() => {
    return c.query("SELECT DISTINCT proyek FROM projek_planning");
}).then(res => {
    console.log(res.rows);
    c.end();
}).catch(e => {
    console.error(e);
    c.end();
});
