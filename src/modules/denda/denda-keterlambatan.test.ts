import assert from "node:assert/strict";
import test from "node:test";
import { calculateDendaFromDates } from "./denda-keterlambatan";

test("denda uses the first serah terima date for the shared ULOK result", () => {
    const akhirSpk = new Date(2026, 5, 14);
    const firstSerahTerima = new Date(2026, 5, 18);
    const secondSerahTerima = new Date(2026, 5, 19);

    const firstResult = calculateDendaFromDates(akhirSpk, firstSerahTerima);
    const secondResult = calculateDendaFromDates(akhirSpk, secondSerahTerima);

    assert.deepEqual(firstResult, {
        hari_denda: 3,
        nilai_denda: 3_000_000,
        tanggal_akhir_spk: "2026-06-14",
        tanggal_serah_terima: "2026-06-18"
    });
    assert.equal(secondResult.hari_denda, 4);
    assert.equal(secondResult.nilai_denda, 4_000_000);
});

test("denda remains zero when the first serah terima is within the free period", () => {
    const result = calculateDendaFromDates(
        new Date(2026, 5, 14),
        new Date(2026, 5, 15)
    );

    assert.equal(result.hari_denda, 0);
    assert.equal(result.nilai_denda, 0);
});
