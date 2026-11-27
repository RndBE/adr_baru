/**
 * Bagian protokol BL1100-v2.9.1: bsSlot, urut/urutTotal.
 * Jalankan: npx tsx src/lib/protokol-bs-slot.test.ts
 */
import assert from "node:assert/strict";
import {
  bacaBalasanRtsConfig,
  bacaBalasanTracking,
  bacaGalatBsSlot,
  nomorSlot,
  validasiBsSlot,
} from "./protokol-rts";

// ── validasi, sama dengan aturan firmware ───────────────────────────────────
assert.equal(validasiBsSlot([9, 10]), null);
assert.equal(validasiBsSlot([]), null, "kosong = mati");
assert.match(validasiBsSlot([1, 2, 3, 4, 5]) ?? "", /Paling banyak 4/);
assert.match(validasiBsSlot([0]) ?? "", /1–50/);
assert.match(validasiBsSlot([51]) ?? "", /1–50/);
assert.match(validasiBsSlot([9.5]) ?? "", /1–50/);
assert.match(validasiBsSlot([9, 9]) ?? "", /ganda/);
assert.match(validasiBsSlot("9,10") ?? "", /daftar/);

assert.equal(nomorSlot("P9"), 9);
assert.equal(nomorSlot("P10"), 10);
assert.equal(nomorSlot(" P50 "), 50);
assert.equal(nomorSlot("P0"), null);
assert.equal(nomorSlot("P51"), null);
assert.equal(nomorSlot("BS1"), null);

// ── get_config ──────────────────────────────────────────────────────────────
assert.deepEqual(bacaBalasanRtsConfig({ jobName: "Demo", bsSlot: [9, 10] }).bsSlot, [9, 10]);
assert.deepEqual(bacaBalasanRtsConfig({ jobName: "Demo", bsSlot: [] }).bsSlot, []);
assert.equal(bacaBalasanRtsConfig({ jobName: "Demo" }).bsSlot, null, "firmware lama tidak melaporkan");

// ── error_bsSlot ────────────────────────────────────────────────────────────
assert.equal(bacaGalatBsSlot({ error_bsSlot: "slot ganda" }), "slot ganda");
assert.equal(bacaGalatBsSlot({ updated: ["bsSlot"] }), null);
assert.equal(bacaGalatBsSlot(null), null);

// ── AutoTracking dengan bsSlot ──────────────────────────────────────────────
const mulai = bacaBalasanTracking({ value: "start", total: 10, retries: 1, urutTotal: 12 });
assert.equal(mulai.urutTotal, 12);
assert.equal(mulai.urut, null);
const t = bacaBalasanTracking({ value: "target", current: 9, total: 10, status: "measure", urut: 11, urutTotal: 12 });
assert.deepEqual([t.ke, t.urut, t.urutTotal, t.nilai], [9, 11, 12, "target"], "slot 9 diulang di kunjungan 11");
const lama = bacaBalasanTracking({ value: "target", current: 3, total: 10, status: "search" });
assert.deepEqual([lama.urut, lama.urutTotal], [null, null], "firmware lama tanpa urut");

console.log("protokol-bs-slot.test.ts: semua lolos");
