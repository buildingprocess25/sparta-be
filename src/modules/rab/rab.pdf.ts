import PDFDocument from "pdfkit";
import type { RabRow, RabItemRow, TokoJoinRow } from "./rab.repository";

type BuildRabPdfInput = {
    rab: RabRow;
    items: RabItemRow[];
    toko: TokoJoinRow;
};

const rupiah = (value: number): string => {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
};

/** PDF detail item (Non-SBO atau semua, tergantung items yang dikirim) */
export const buildRabPdfBuffer = async (input: BuildRabPdfInput): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: "A4" });
        const chunks: Buffer[] = [];

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        doc.fontSize(16).text("RAB - Ringkasan Pengajuan", { align: "center" });
        doc.moveDown(1);

        doc.fontSize(11);
        doc.text(`ID Pengajuan : ${input.rab.id}`);
        doc.text(`Nomor ULOK  : ${input.toko.nomor_ulok}`);
        doc.text(`Nama Toko   : ${input.toko.nama_toko ?? "-"}`);
        doc.text(`Cabang      : ${input.toko.cabang ?? "-"}`);
        doc.text(`Alamat      : ${input.toko.alamat ?? "-"}`);
        doc.text(`Email       : ${input.rab.email_pembuat ?? "-"}`);
        doc.text(`Nama PT     : ${input.rab.nama_pt ?? "-"}`);
        doc.text(`Lingkup     : ${input.toko.lingkup_pekerjaan ?? "-"}`);
        doc.text(`Durasi      : ${input.rab.durasi_pekerjaan ?? "-"}`);
        doc.text(`Status      : ${input.rab.status}`);
        doc.text(`Created At  : ${new Date(input.rab.created_at).toLocaleString("id-ID")}`);

        doc.moveDown();
        doc.fontSize(12).text("Daftar Item Pekerjaan", { underline: true });
        doc.moveDown(0.5);

        let runningTotal = 0;
        for (const [idx, item] of input.items.entries()) {
            runningTotal += item.total_harga;

            doc.fontSize(10).text(
                `${idx + 1}. [${item.kategori_pekerjaan}] ${item.jenis_pekerjaan} | ${item.volume} ${item.satuan}`
            );
            doc.fontSize(9).text(
                `   Material: ${rupiah(item.harga_material)} | Upah: ${rupiah(item.harga_upah)} | Total: ${rupiah(item.total_harga)}`
            );
        }

        doc.moveDown();
        doc.fontSize(11).text(`Total Item: ${rupiah(runningTotal)}`);
        doc.text(`Grand Total Non-SBO: ${rupiah(Number(input.rab.grand_total_non_sbo))}`);
        doc.text(`Grand Total Final  : ${rupiah(Number(input.rab.grand_total_final))}`);

        doc.end();
    });
};

/** PDF Rekapitulasi – ringkasan total per kategori pekerjaan */
export const buildRecapPdfBuffer = async (input: BuildRabPdfInput): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: "A4" });
        const chunks: Buffer[] = [];

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        doc.fontSize(16).text("Rekapitulasi RAB", { align: "center" });
        doc.moveDown(1);

        doc.fontSize(11);
        doc.text(`Nomor ULOK : ${input.toko.nomor_ulok}`);
        doc.text(`Nama Toko  : ${input.toko.nama_toko ?? "-"}`);
        doc.text(`Nama PT    : ${input.rab.nama_pt ?? "-"}`);
        doc.moveDown();

        // Group by kategori
        const grouped = new Map<string, number>();
        for (const item of input.items) {
            const key = item.kategori_pekerjaan;
            grouped.set(key, (grouped.get(key) ?? 0) + item.total_harga);
        }

        let no = 1;
        let grandTotal = 0;
        for (const [kategori, total] of grouped.entries()) {
            grandTotal += total;
            doc.fontSize(10).text(`${no}. ${kategori}: ${rupiah(total)}`);
            no++;
        }

        doc.moveDown();
        doc.fontSize(11).text(`Grand Total: ${rupiah(grandTotal)}`);
        doc.text(`Grand Total Non-SBO: ${rupiah(Number(input.rab.grand_total_non_sbo))}`);
        doc.text(`Grand Total Final  : ${rupiah(Number(input.rab.grand_total_final))}`);

        doc.end();
    });
};