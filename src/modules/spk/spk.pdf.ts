import PDFDocument from "pdfkit";
import type { PengajuanSpkRow } from "./spk.repository";

type BuildSpkPdfInput = {
    pengajuan: PengajuanSpkRow;
    tokoNama: string;
    tokoKode: string;
    tokoAlamat: string;
    tokoCabang: string;
};

const rupiahFormat = (value: number): string => {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
};

const formatTanggal = (isoString: string): string => {
    const bulan = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const d = new Date(isoString);
    return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
};

export const buildSpkPdfBuffer = async (input: BuildSpkPdfInput): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: "A4" });
        const chunks: Buffer[] = [];

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const p = input.pengajuan;
        const startFormatted = formatTanggal(p.waktu_mulai);
        const endFormatted = formatTanggal(p.waktu_selesai);
        const today = formatTanggal(new Date().toISOString());
        const totalFormatted = rupiahFormat(Number(p.grand_total));

        // --- Header ---
        doc.fontSize(11).text(`${input.tokoCabang}, ${today}`, { align: "right" });
        doc.moveDown(0.5);
        doc.fontSize(11).text(`Nomor: ${p.nomor_spk}`);
        doc.text(`PAR   : ${p.par || "-"}`);
        doc.moveDown(1);

        // --- Penerima ---
        doc.text("Kepada Yth,");
        doc.font("Helvetica-Bold").text(p.nama_kontraktor);
        doc.font("Helvetica");
        doc.moveDown(0.5);
        doc.text("Up. Bpk/Ibu Pimpinan");
        doc.moveDown(1);

        // --- Judul ---
        doc.fontSize(14).font("Helvetica-Bold").text("Surat Perintah Kerja (SPK)", { align: "center", underline: true });
        doc.font("Helvetica").fontSize(11);
        doc.moveDown(1);

        // --- Isi ---
        doc.text("Dengan hormat,");
        doc.moveDown(0.5);
        doc.text(
            `Sesuai dengan surat penawaran Bapak/Ibu ybs. mengenai pekerjaan ${p.lingkup_pekerjaan} ` +
            `pada toko Alfamart ${input.tokoNama} (${input.tokoKode}), pekerjaan ${p.proyek}, ` +
            `beralamat di ${input.tokoAlamat}, maka dengan ini menunjuk Bapak/Ibu untuk ` +
            `melaksanakan pekerjaan tersebut, dengan ketentuan sebagai berikut:`,
            { align: "justify" }
        );
        doc.moveDown(1);

        // --- Kotak biaya ---
        const boxX = doc.x;
        const boxY = doc.y;
        const boxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

        doc.rect(boxX, boxY, boxWidth, 80).stroke();
        doc.text(`Perincian Biaya:`, boxX + 10, boxY + 10);
        doc.text(`Pekerjaan ${p.lingkup_pekerjaan}`, boxX + 10, boxY + 25);
        doc.font("Helvetica-Bold").text(totalFormatted, boxX + 10, boxY + 25, {
            align: "right",
            width: boxWidth - 20
        });
        doc.font("Helvetica");
        doc.font("Helvetica-Bold").text(`Terbilang : ${p.terbilang}`, boxX + 10, boxY + 45);
        doc.font("Helvetica").text("Harga tersebut sudah termasuk PPN dan PPh.", boxX + 10, boxY + 62);

        doc.y = boxY + 90;
        doc.moveDown(0.5);

        // --- Ketentuan ---
        doc.list([
            "Pelaksanaan pengadaan disesuaikan dengan spesifikasi dalam penawaran tersebut diatas.",
            `Jangka waktu pelaksanaan terhitung dari tanggal ${startFormatted} sampai dengan ${endFormatted} (${p.durasi} Hari Kalender)`
        ]);
        doc.moveDown(1);

        // --- Penutup ---
        doc.text(
            "Demikian Surat Perintah Kerja ini kami sampaikan, atas perhatian dan kerjasamanya kami berharap Bapak " +
            "dapat bekerja dengan baik. Apabila ada pertanyaan sehubungan dengan pekerjaan tersebut, mohon kiranya " +
            "Bapak tidak segan menghubungi PT Sumber Alfaria Trijaya Tbk.",
            { align: "justify" }
        );
        doc.moveDown(1);

        doc.text("Hormat kami,");
        doc.font("Helvetica-Bold").text("PT SUMBER ALFARIA TRIJAYA Tbk");
        doc.font("Helvetica");
        doc.moveDown(2);

        // --- Tanda tangan ---
        const colWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / 2;
        const sigY = doc.y;

        const isBatam = input.tokoCabang.toUpperCase() === "BATAM";
        const initiatorRole = isBatam ? "Branch Building Coordinator" : "Branch Building & Maintenance Manager";

        doc.text("Dibuat oleh,", doc.page.margins.left, sigY, { width: colWidth, align: "center" });
        doc.text("Disetujui oleh,", doc.page.margins.left + colWidth, sigY, { width: colWidth, align: "center" });

        doc.text(initiatorRole, doc.page.margins.left, sigY + 15, { width: colWidth, align: "center" });
        doc.text("Branch Manager", doc.page.margins.left + colWidth, sigY + 15, { width: colWidth, align: "center" });

        const nameY = sigY + 80;
        doc.text(`( ${p.email_pembuat} )`, doc.page.margins.left, nameY, { width: colWidth, align: "center" });
        doc.text(
            p.approver_email ? `( ${p.approver_email} )` : "( _________________ )",
            doc.page.margins.left + colWidth,
            nameY,
            { width: colWidth, align: "center" }
        );

        if (p.waktu_persetujuan) {
            doc.fontSize(9).text(
                `Disetujui pada: ${formatTanggal(p.waktu_persetujuan)}`,
                doc.page.margins.left + colWidth,
                nameY + 15,
                { width: colWidth, align: "center" }
            );
        }

        // --- Footer ---
        const footerY = doc.page.height - doc.page.margins.bottom - 60;
        doc.fontSize(9);
        doc.font("Helvetica-Bold").text("PT SUMBER ALFARIA TRIJAYA, Tbk.", doc.page.margins.left, footerY);
        doc.font("Helvetica").text("ALFA TOWER");
        doc.text("Jl. Jalur Sutera Barat Kav. 9");
        doc.text("Alam Sutera, Tangerang 15143, Indonesia");

        doc.end();
    });
};
