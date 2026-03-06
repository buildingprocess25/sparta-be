import PDFDocument from "pdfkit";
import type { DetailItemRow, PengajuanRabRow } from "./rab.repository";

type BuildRabPdfInput = {
    pengajuan: PengajuanRabRow;
    detailItems: DetailItemRow[];
    tokoNama: string;
    tokoAlamat: string;
    tokoCabang: string;
};

const rupiah = (value: number): string => {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
};

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
        doc.text(`ID Pengajuan : ${input.pengajuan.id}`);
        doc.text(`Nomor ULOK  : ${input.pengajuan.nomor_ulok}`);
        doc.text(`Nama Toko   : ${input.tokoNama}`);
        doc.text(`Cabang      : ${input.tokoCabang}`);
        doc.text(`Alamat      : ${input.tokoAlamat}`);
        doc.text(`Email       : ${input.pengajuan.email_pembuat}`);
        doc.text(`Nama PT     : ${input.pengajuan.nama_pt}`);
        doc.text(`Lingkup     : ${input.pengajuan.lingkup_pekerjaan}`);
        doc.text(`Durasi      : ${input.pengajuan.durasi_pekerjaan}`);
        doc.text(`Status      : ${input.pengajuan.status}`);
        doc.text(`Created At  : ${new Date(input.pengajuan.created_at).toLocaleString("id-ID")}`);

        doc.moveDown();
        doc.fontSize(12).text("Daftar Item Pekerjaan", { underline: true });
        doc.moveDown(0.5);

        let runningTotal = 0;
        for (const [idx, item] of input.detailItems.entries()) {
            const totalItem = Number(item.volume) * (Number(item.harga_material) + Number(item.harga_upah));
            runningTotal += totalItem;

            doc.fontSize(10).text(
                `${idx + 1}. [${item.kategori_pekerjaan}] ${item.jenis_pekerjaan} | ${item.volume} ${item.satuan}`
            );
            doc.fontSize(9).text(
                `   Material: ${rupiah(Number(item.harga_material))} | Upah: ${rupiah(Number(item.harga_upah))} | Total: ${rupiah(totalItem)}`
            );
        }

        doc.moveDown();
        doc.fontSize(11).text(`Total Item (semua): ${rupiah(runningTotal)}`);
        doc.text(`Grand Total Non-SBO: ${rupiah(Number(input.pengajuan.grand_total_nonsbo))}`);
        doc.text(`Grand Total Final  : ${rupiah(Number(input.pengajuan.grand_total_final))}`);

        doc.end();
    });
};