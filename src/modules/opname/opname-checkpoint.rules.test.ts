import assert from "node:assert/strict";
import test from "node:test";
import {
    allowedStatusesForContractorFirst,
    subtractOneCalendarDay,
    workItemKey,
} from "./opname-checkpoint.rules";

test("subtractOneCalendarDay uses calendar H-1 without working day adjustment", () => {
    assert.equal(subtractOneCalendarDay("2026-08-27"), "2026-08-26");
    assert.equal(subtractOneCalendarDay("2026-03-01"), "2026-02-28");
    assert.equal(subtractOneCalendarDay("2028-03-01"), "2028-02-29");
});

test("subtractOneCalendarDay accepts date-time strings by using the date portion", () => {
    assert.equal(subtractOneCalendarDay("2026-08-27T17:00:00.000Z"), "2026-08-26");
});

test("subtractOneCalendarDay rejects non YYYY-MM-DD date portions", () => {
    assert.throws(() => subtractOneCalendarDay("27/08/2026"), /YYYY-MM-DD/);
});

test("workItemKey normalizes RAB and IL sources", () => {
    assert.equal(workItemKey({ id_rab_item: 12 }), "rab:12");
    assert.equal(workItemKey({ id_instruksi_lapangan_item: 34 }), "il:34");
});

test("workItemKey requires exactly one source", () => {
    assert.throws(() => workItemKey({}), /exactly one/);
    assert.throws(() => workItemKey({ id_rab_item: 12, id_instruksi_lapangan_item: 34 }), /exactly one/);
});

test("allowedStatusesForContractorFirst blocks selesai when contractor has not submitted opname", () => {
    assert.deepEqual(
        allowedStatusesForContractorFirst({ hasOpnameSubmission: false, hasFutureHit: true }),
        ["progress"]
    );
    assert.deepEqual(
        allowedStatusesForContractorFirst({ hasOpnameSubmission: false, hasFutureHit: false }),
        ["terlambat"]
    );
});

test("allowedStatusesForContractorFirst allows only selesai when support approves opname", () => {
    assert.deepEqual(
        allowedStatusesForContractorFirst({
            hasOpnameSubmission: true,
            decision: "disetujui",
            hasFutureHit: true,
        }),
        ["selesai"]
    );
    assert.deepEqual(
        allowedStatusesForContractorFirst({
            hasOpnameSubmission: true,
            decision: "disetujui",
            hasFutureHit: false,
        }),
        ["selesai"]
    );
});

test("allowedStatusesForContractorFirst preserves progress or terlambat branch when support rejects opname", () => {
    assert.deepEqual(
        allowedStatusesForContractorFirst({
            hasOpnameSubmission: true,
            decision: "ditolak",
            hasFutureHit: true,
        }),
        ["selesai", "progress"]
    );
    assert.deepEqual(
        allowedStatusesForContractorFirst({
            hasOpnameSubmission: true,
            decision: "ditolak",
            hasFutureHit: false,
        }),
        ["selesai", "terlambat"]
    );
});
