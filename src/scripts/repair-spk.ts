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

        await repairSpk(961, 805216200);
        await repairSpk(962, 33066900);

        console.log("Repair completed.");
    } catch (error) {
        console.error("Error during repair:", error);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

main();
