import assert from "node:assert/strict";
import test from "node:test";
import { calculateOpnameFinalFinancials } from "./opname-final.financial";

test("menghitung RAB + IL + tambah - kurang - denda dengan aturan PPN", () => {
    const result = calculateOpnameFinalFinancials({
        rab: 30_025_500,
        instruksiLapangan: 0,
        kerjaTambah: 0,
        kerjaKurang: -999_000,
        denda: 0,
    });

    assert.equal(result.rab.grand_total, 33_322_200);
    assert.equal(result.kerjaKurang.grand_total, -1_110_000);
    assert.equal(result.totalFinal, 32_212_200);
});

test("area tanpa PPN tidak menambahkan sebelas persen", () => {
    const result = calculateOpnameFinalFinancials({
        rab: 30_025_500,
        instruksiLapangan: 1_000,
        kerjaTambah: 999_000,
        kerjaKurang: -500_000,
        denda: 100_000,
        noPpn: true,
    });

    assert.equal(result.totalFinal, 30_430_000);
});
