import { pool } from "../db/pool";

const isNoPpnArea = (toko: any): boolean => {
    const normalizeNoPpnText = (value?: string | null): string => String(value ?? "").trim().toUpperCase();
    const identity = [toko.cabang, toko.nama_toko, toko.alamat].map(normalizeNoPpnText);
    return identity.some(value => value === "BATAM" || value === "BINTAN" || /\bBATAM\b|\bBINTAN\b/.test(value));
};

const buildFinancialSummary = (total: number, direction: "down" | "up", noPpn = false) => {
    const pembulatan = direction === "down"
        ? (total < 0 ? -1 : 1) * Math.floor(Math.abs(total) / 10000) * 10000
        : (total === 0 ? 0 : (total < 0 ? -1 : 1) * Math.ceil(Math.abs(total) / 10000) * 10000);
    const ppn = noPpn ? 0 : Math.round(pembulatan * 0.11);
    return { grand_total: pembulatan + ppn };
};

async function run() {
    const res = await pool.query(`SELECT ofn.id, ofn.nilai_denda, t.cabang, t.nama_toko, t.alamat FROM opname_final ofn JOIN toko t ON t.id = ofn.id_toko`);
    for (const row of res.rows) {
        const id = row.id;
        const noPpn = isNoPpnArea(row);
        const items = await pool.query(`
            SELECT oi.id_rab_item, oi.total_selisih,
                   ri.total_harga as rab_item_total_harga,
                   ili.total_harga as il_item_total_harga
            FROM opname_item oi
            LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
            LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
            WHERE oi.id_opname_final = $1
        `, [id]);
        
        let rabTotal = 0;
        let ilTotal = 0;
        let tambahTotal = 0;
        let kurangTotal = 0;
        for (const item of items.rows) {
            if (item.id_rab_item) rabTotal += Number(item.rab_item_total_harga || 0);
            else ilTotal += Number(item.il_item_total_harga || 0);
            const selisih = Number(item.total_selisih || 0);
            if (selisih > 0) tambahTotal += selisih;
            else kurangTotal += selisih;
        }
        const rabSummary = buildFinancialSummary(rabTotal, 'down', noPpn);
        const ilSummary = buildFinancialSummary(ilTotal, 'up', noPpn);
        const tambahSummary = buildFinancialSummary(tambahTotal, 'up', noPpn);
        const kurangSummary = buildFinancialSummary(kurangTotal, 'up', noPpn);
        const nilaiDenda = Number(row.nilai_denda || 0);
        const finalTotal = rabSummary.grand_total + ilSummary.grand_total + tambahSummary.grand_total - Math.abs(kurangSummary.grand_total) - nilaiDenda;
        await pool.query('UPDATE opname_final SET grand_total_final = $1 WHERE id = $2', [finalTotal, id]);
    }
    console.log('OK');
    process.exit(0);
}
run().catch(console.error);
