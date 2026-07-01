import { pool } from "../db/pool";

type EmptyOpnameHeaderRow = {
    id: number;
    id_toko: number;
    nomor_ulok: string | null;
    nama_toko: string | null;
    cabang: string | null;
    lingkup_pekerjaan: string | null;
    tipe_opname: string;
    aksi: string;
    status_opname_final: string;
    created_at: string;
};

const shouldCommit = process.argv.includes("--commit");

const sql = `
    SELECT
        ofn.id,
        ofn.id_toko,
        t.nomor_ulok,
        t.nama_toko,
        t.cabang,
        t.lingkup_pekerjaan,
        ofn.tipe_opname,
        ofn.aksi,
        ofn.status_opname_final,
        ofn.created_at
    FROM opname_final ofn
    JOIN toko t ON t.id = ofn.id_toko
    WHERE ofn.tipe_opname = 'OPNAME'
      AND COALESCE(ofn.aksi, 'active') = 'active'
      AND COALESCE(ofn.status_opname_final, '') = 'Proses KTK/Approval Kontraktor'
      AND NOT EXISTS (
          SELECT 1
          FROM opname_item oi
          WHERE oi.id_opname_final = ofn.id
      )
    ORDER BY ofn.created_at DESC, ofn.id DESC
`;

async function main() {
    const client = await pool.connect();
    try {
        const result = await client.query<EmptyOpnameHeaderRow>(sql);
        const rows = result.rows;

        console.log(`Empty active OPNAME headers: ${rows.length}`);
        rows.forEach((row) => {
            console.log([
                `#${row.id}`,
                `toko=${row.id_toko}`,
                row.nomor_ulok,
                row.nama_toko,
                row.cabang,
                row.lingkup_pekerjaan,
                row.created_at,
            ].filter(Boolean).join(" | "));
        });

        if (!shouldCommit || rows.length === 0) {
            console.log(shouldCommit ? "Tidak ada data untuk dihapus." : "Preview only. Tambahkan --commit untuk menghapus header kosong ini.");
            return;
        }

        const ids = rows.map((row) => row.id);
        const deleted = await client.query(
            `
            DELETE FROM opname_final
            WHERE id = ANY($1::int[])
              AND tipe_opname = 'OPNAME'
              AND COALESCE(aksi, 'active') = 'active'
              AND COALESCE(status_opname_final, '') = 'Proses KTK/Approval Kontraktor'
              AND NOT EXISTS (
                  SELECT 1
                  FROM opname_item oi
                  WHERE oi.id_opname_final = opname_final.id
              )
            `,
            [ids]
        );

        console.log(`Deleted empty active OPNAME headers: ${deleted.rowCount ?? 0}`);
    } finally {
        client.release();
    }
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
