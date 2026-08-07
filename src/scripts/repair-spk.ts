import { pool } from "../db/pool";
import { spkRepository } from "../modules/spk/spk.repository";
import { tokoRepository } from "../modules/toko/toko.repository";
import { buildSpkPdfBuffer } from "../modules/spk/spk.pdf";
import { GoogleProvider } from "../common/google";
import { env } from "../config/env";

async function uploadPdfToDrive(buffer: Buffer, filename: string): Promise<string> {
    const gp = GoogleProvider.instance;
    const drive = gp.spartaDrive;
    if (!drive) throw new Error("Google Drive (Sparta) belum terkonfigurasi");

    const result = await gp.uploadFile(
        env.PDF_STORAGE_FOLDER_ID,
        filename,
        "application/pdf",
        buffer,
        2,
        drive,
    );

    return result.webViewLink ?? `https://drive.google.com/file/d/${result.id}/view`;
}

async function regenerateSpkPdfAndUpload(
    pengajuanSpkId: string
): Promise<string | null> {
    const data = await spkRepository.findById(pengajuanSpkId);
    if (!data) return null;

    const toko = await tokoRepository.findById(data.pengajuan.id_toko);
    if (!toko) return null;

    const pdfBuffer = await buildSpkPdfBuffer({
        pengajuan: data.pengajuan,
        tokoNama: toko.nama_toko,
        tokoKode: toko.kode_toko,
        tokoAlamat: toko.alamat,
        tokoCabang: toko.cabang
    });

    const proyek = data.pengajuan.proyek ?? "N/A";
    const nomorUlok = data.pengajuan.nomor_ulok ?? "UNKNOWN";
    const filename = `SPK_${proyek}_${nomorUlok}.pdf`;

    return uploadPdfToDrive(pdfBuffer, filename);
}

async function repairSpk(spkId: number, correctTotal: number) {
    console.log(`[REPAIR] Starting repair for SPK ${spkId}`);
    
    // Update DB
    await pool.query(
        `UPDATE pengajuan_spk SET grand_total = $1 WHERE id = $2`,
        [correctTotal, spkId]
    );
    console.log(`[REPAIR] Updated grand_total to ${correctTotal} for SPK ${spkId}`);

    // Regenerate and upload
    const finalLink = await regenerateSpkPdfAndUpload(spkId.toString());
    
    // Update link
    if (finalLink) {
        await pool.query(
            `UPDATE pengajuan_spk SET link_pdf = $1 WHERE id = $2`,
            [finalLink, spkId]
        );
        console.log(`[REPAIR] Regenerated PDF for SPK ${spkId}, link: ${finalLink}`);
    } else {
        console.error(`[REPAIR] Failed to regenerate PDF for SPK ${spkId}`);
    }
}

async function main() {
    try {
        console.log("Initializing Google Provider...");
        await GoogleProvider.initialize();

        const targets = [
            { id: 966, total: 30358500 },
            { id: 965, total: 777133200 },
            { id: 151, total: 30303000 },
            { id: 150, total: 916138500 },
            { id: 964, total: 35042700 },
            { id: 963, total: 250804500 },
            { id: 960, total: 258285900 },
            { id: 959, total: 43223400 },
            { id: 958, total: 889010100 },
            { id: 957, total: 34987200 },
            { id: 956, total: 434254200 },
        ];

        for (const target of targets) {
            await repairSpk(target.id, target.total);
        }

        console.log("Mass repair completed.");
    } catch (error) {
        console.error("Error during mass repair:", error);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

main();
