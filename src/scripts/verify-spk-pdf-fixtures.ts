import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import type { PengajuanSpkRow } from "../modules/spk/spk.repository";

// Synthetic fixture only. No database, Drive or email modules are invoked.
process.env.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:1/unused";

async function main() {
    const { buildSpkPdfBuffer } = await import("../modules/spk/spk.pdf");
    const output = path.resolve(process.argv[2] ?? "../artifacts/spk-pdf-fixtures");
    await fs.mkdir(output, { recursive: true });
    const legacy: PengajuanSpkRow = {
        id: "fixture-sipil", id_toko: 1, nomor_ulok: "IZ01-FIXTURE-0001",
        email_pembuat: "pembuat@example.invalid", lingkup_pekerjaan: "SIPIL",
        nama_kontraktor: "CV KONTRAKTOR CONTOH", proyek: "Renovasi",
        waktu_mulai: "2026-09-20", durasi: 35, waktu_selesai: "2026-10-24",
        grand_total: 616693800, terbilang: "", nomor_spk: "008/PROPNDEV-IZ01/IX/26",
        par: "0154/PROPNDEV-IZ01-V-2026", spk_manual_1: "IX", spk_manual_2: "26",
        status: "SPK_APPROVED", link_pdf: null, approver_email: "approver@example.invalid",
        waktu_persetujuan: "2026-09-10T07:27:00Z", alasan_penolakan: null,
        created_at: "2026-09-10T07:08:00Z",
    };
    const sipil = { ...legacy, spk_group_id: "11111111-1111-4111-8111-111111111111" };
    const me = { ...sipil, id: "fixture-me", id_toko: 2, lingkup_pekerjaan: "ME", grand_total: 125000000 };
    const fixtures = [
        { name: "legacy", pengajuan: legacy, groupMembers: [sipil, me], combined: false },
        { name: "combined", pengajuan: sipil, groupMembers: [me, sipil], combined: true },
        { name: "invalid-membership", pengajuan: sipil, groupMembers: [sipil, { ...me, spk_group_id: "other" }], combined: false },
        { name: "combined-zero", pengajuan: { ...sipil, grand_total: 0 }, groupMembers: [{ ...sipil, grand_total: 0 }, { ...me, grand_total: 0 }], combined: true },
    ];
    for (const fixture of fixtures) {
        const data = await buildSpkPdfBuffer({ ...fixture,
            tokoNama: "TOKO CONTOH", tokoKode: "T123", tokoCabang: "CILACAP",
            tokoAlamat: "JL. RAYA CONTOH NOMOR 240 KEC. PREMBUN KAB. KEBUMEN",
        });
        await fs.writeFile(path.join(output, `${fixture.name}.pdf`), data);
        const parser = new PDFParse({ data });
        try {
            const result = await parser.getText();
            const text = result.text.replace(/\s+/g, " ");
            assert.equal(result.total, 1, `${fixture.name}: should fit a single page`);
            assert.equal(text.includes("pekerjaan SIPIL dan ME"), fixture.combined);
            assert.equal(text.includes("Pekerjaan ME"), fixture.combined);
            assert.equal(text.includes("Total SIPIL + ME"), fixture.combined);
            assert.equal((text.match(/Dibuat oleh,/g) ?? []).length, 1);
            assert.equal((text.match(/Disetujui oleh,/g) ?? []).length, 1);
            assert.ok(text.includes("Harga tersebut sudah termasuk PPN dan PPh."));
            if (fixture.name === "combined") {
                for (const expected of ["616.693.800", "125.000.000", "741.693.800", "Tujuh Ratus Empat Puluh Satu Juta Enam Ratus Sembilan Puluh Tiga Ribu Delapan Ratus Rupiah"]) assert.ok(text.includes(expected), expected);
            } else if (fixture.name === "combined-zero") {
                assert.ok(text.includes("Nol Rupiah"));
            } else {
                assert.ok(text.includes("616.693.800"));
                assert.ok(!text.includes("741.693.800"));
            }
            await fs.writeFile(path.join(output, `${fixture.name}.txt`), result.text);
            const rendered = await parser.getScreenshot({ desiredWidth: 1000 });
            await fs.writeFile(path.join(output, `${fixture.name}.png`), rendered.pages[0].data);
            console.log(`PASS ${fixture.name}: ${result.total} page, text and totals verified`);
        } finally { await parser.destroy(); }
    }
    console.log(`PDF fixtures: ${output}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
