import assert from "node:assert/strict";
import test from "node:test";
import {
    bulkCreateOpnameSchema,
    contractorCheckpointOpnameSubmitSchema,
    contractorOpnameRevisionSchema,
    supportOpnameReviewDecisionSchema,
    workflowVersionSchema,
} from "./opname.schema";

const basePayload = {
    id_toko: 1,
    email_pembuat: "tester@example.com",
    tipe_opname: "OPNAME",
    grand_total_opname: "1000",
    grand_total_rab: "1000",
};

test("menerima Tidak Sesuai dan Tidak Baik pada submit opname", () => {
    const parsed = bulkCreateOpnameSchema.parse({
        ...basePayload,
        items: [{
            id_rab_item: 1,
            volume_akhir: 1,
            selisih_volume: 0,
            total_selisih: 0,
            desain: "Tidak Sesuai",
            kualitas: "Tidak Baik",
            spesifikasi: "Tidak Sesuai",
        }],
    });

    assert.equal(parsed.items[0].desain, "Tidak Sesuai");
    assert.equal(parsed.items[0].kualitas, "Tidak Baik");
    assert.equal(parsed.items[0].spesifikasi, "Tidak Sesuai");
});

test("menormalkan kapital dan spasi nilai verifikasi", () => {
    const parsed = bulkCreateOpnameSchema.parse({
        ...basePayload,
        items: [{
            id_rab_item: 1,
            volume_akhir: 1,
            selisih_volume: 0,
            total_selisih: 0,
            desain: " tidak   sesuai ",
            kualitas: "tidak baik",
            spesifikasi: "sesuai",
        }],
    });

    assert.deepEqual(
        [parsed.items[0].desain, parsed.items[0].kualitas, parsed.items[0].spesifikasi],
        ["Tidak Sesuai", "Tidak Baik", "Sesuai"]
    );
});
test("menerima workflow version legacy dan contractor_first", () => {
    assert.equal(workflowVersionSchema.parse("legacy"), "legacy");
    assert.equal(workflowVersionSchema.parse("contractor_first"), "contractor_first");
    assert.throws(() => workflowVersionSchema.parse("kontraktor_first"));
});

test("contractor checkpoint opname requires every item field used by new flow", () => {
    const parsed = contractorCheckpointOpnameSubmitSchema.parse({
        id_toko: 10,
        id_pengawasan_gantt: 20,
        email_pembuat: "kontraktor@example.com",
        items: [{
            id_rab_item: 30,
            volume_akhir: 1,
            selisih_volume: 0,
            total_selisih: 0,
            total_harga_opname: 250000,
            desain: "sesuai",
            kualitas: "baik",
            spesifikasi: "sesuai",
            catatan: "pekerjaan sesuai lapangan",
            foto: "data:image/png;base64,abc",
        }],
    });

    assert.equal(parsed.items[0].desain, "Sesuai");
    assert.equal(parsed.items[0].kualitas, "Baik");
    assert.equal(parsed.items[0].spesifikasi, "Sesuai");
    assert.equal(parsed.items[0].total_harga_opname, 250000);
});

test("contractor checkpoint opname requires exactly one item source", () => {
    assert.throws(
        () => contractorCheckpointOpnameSubmitSchema.parse({
            id_toko: 10,
            id_pengawasan_gantt: 20,
            email_pembuat: "kontraktor@example.com",
            items: [{
                id_rab_item: 30,
                id_instruksi_lapangan_item: 40,
                volume_akhir: 1,
                selisih_volume: 0,
                total_selisih: 0,
                desain: "Sesuai",
                kualitas: "Baik",
                spesifikasi: "Sesuai",
                foto: "data:image/png;base64,abc",
            }],
        }),
        /Isi tepat salah satu/
    );
});

test("contractor checkpoint opname requires foto", () => {
    assert.throws(
        () => contractorCheckpointOpnameSubmitSchema.parse({
            id_toko: 10,
            id_pengawasan_gantt: 20,
            email_pembuat: "kontraktor@example.com",
            items: [{
                id_rab_item: 30,
                volume_akhir: 1,
                selisih_volume: 0,
                total_selisih: 0,
                desain: "Sesuai",
                kualitas: "Baik",
                spesifikasi: "Sesuai",
                foto: "",
            }],
        })
    );
});

test("support rejection requires alasan penolakan", () => {
    assert.throws(
        () => supportOpnameReviewDecisionSchema.parse({ id_opname_item: 1, decision: "ditolak" }),
        /Alasan penolakan wajib diisi/
    );
});

test("support approval does not require alasan penolakan", () => {
    const parsed = supportOpnameReviewDecisionSchema.parse({ id_opname_item: "1", decision: "disetujui" });

    assert.equal(parsed.id_opname_item, 1);
    assert.equal(parsed.decision, "disetujui");
});

test("contractor revision keeps source outside revision payload", () => {
    const parsed = contractorOpnameRevisionSchema.parse({
        id_rab_item: 30,
        volume_akhir: "2",
        selisih_volume: "1",
        total_selisih: "100000",
        total_harga_opname: "200000",
        desain: "tidak sesuai",
        kualitas: "tidak baik",
        spesifikasi: "sesuai",
        catatan: "revisi volume",
        foto: "data:image/png;base64,revision",
    });

    assert.equal("id_rab_item" in parsed, false);
    assert.equal(parsed.volume_akhir, 2);
    assert.equal(parsed.desain, "Tidak Sesuai");
    assert.equal(parsed.kualitas, "Tidak Baik");
    assert.equal(parsed.spesifikasi, "Sesuai");
});
