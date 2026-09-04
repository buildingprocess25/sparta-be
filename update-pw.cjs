const { Client } = require('pg');

async function updatePassword() {
  const newHash = '$argon2id$v=19$m=19456,t=2,p=1$VZDV4g+91lGsO46gYM4cAw$8NZbpO6MsgGbEjKTv4f3Zev2rqnr38nZKpIcd7lV7m4';

  const client = new Client({
    connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/sparta?sslmode=disable',
  });

  try {
    await client.connect();
    
    const res = await client.query(
      'UPDATE "User" SET "passwordHash" = $1, "failedLoginCount" = 0, "status" = \'ACTIVE\' WHERE email = $2 RETURNING email', 
      [newHash, 'wildan.fadillah@nusaputra.ac.id']
    );
    
    if (res.rows.length > 0) {
      console.log('Password successfully updated for:', res.rows[0].email);
    } else {
      console.log('User NOT found in DB.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

updatePassword();
