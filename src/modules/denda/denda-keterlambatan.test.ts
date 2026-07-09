import assert from "node:assert/strict";
import test from "node:test";
import { calculateDendaFromDates, calculateDendaNominal, DENDA_ACTION_THRESHOLD_DAYS } from "./denda-keterlambatan";

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

test("denda calculation with weekend (Kamis/Jumat SPK)", () => {
    // SPK berakhir Kamis (11 Juni 2026) -> ST Senin (15 Juni 2026) = 0 denda
    const kamisToSenin = calculateDendaFromDates(new Date(2026, 5, 11), new Date(2026, 5, 15));
    assert.equal(kamisToSenin.hari_denda, 0);

    // SPK berakhir Kamis (11 Juni 2026) -> ST Selasa (16 Juni 2026) = 1 hari denda
    const kamisToSelasa = calculateDendaFromDates(new Date(2026, 5, 11), new Date(2026, 5, 16));
    assert.equal(kamisToSelasa.hari_denda, 1);

    // SPK berakhir Jumat (12 Juni 2026) -> ST Senin (15 Juni 2026) = 0 denda
    const jumatToSenin = calculateDendaFromDates(new Date(2026, 5, 12), new Date(2026, 5, 15));
    assert.equal(jumatToSenin.hari_denda, 0);
});

test("denda nominal is capped at 7.5 million before SP or takeover decision", () => {
    assert.equal(calculateDendaNominal(0), 0);
    assert.equal(calculateDendaNominal(5), 5_000_000);
    assert.equal(calculateDendaNominal(6), 5_500_000);
    assert.equal(calculateDendaNominal(10), 7_500_000);
    assert.equal(calculateDendaNominal(DENDA_ACTION_THRESHOLD_DAYS), 7_500_000);
    assert.equal(calculateDendaNominal(30), 7_500_000);
});
