/**
 * Membaca kiriman ADR (firmware BL1100-v2.9.1). Jalankan: npx tsx src/lib/kiriman-adr.test.ts
 */
import assert from "node:assert/strict";
import { bacaSudut } from "./koreksi-azimut";
import { jenisKiriman, pilihSudut, sudutDesimal } from "./kiriman-adr";

// ── Jenis kiriman ───────────────────────────────────────────────────────────
assert.equal(jenisKiriman("0", "0"), "bukan-tembakan", "laporan menit v2.9.1");
assert.equal(jenisKiriman("0", "197.5544"), "bukan-tembakan", "ID 0 tetap bukan tembakan");
assert.equal(jenisKiriman("", ""), "bukan-tembakan");
assert.equal(jenisKiriman(undefined, undefined), "bukan-tembakan");
assert.equal(jenisKiriman(" 0 ", "0"), "bukan-tembakan");
assert.equal(jenisKiriman("P4", "0"), "gagal", "SD 0 = target gagal");
assert.equal(jenisKiriman("P4", ""), "gagal");
assert.equal(jenisKiriman("P4", "abc"), "gagal");
assert.equal(jenisKiriman("P4", "1147.2528"), "tembakan");
assert.equal(jenisKiriman("P10", 30.0286), "tembakan");

// ── Sudut desimal ───────────────────────────────────────────────────────────
assert.equal(sudutDesimal("89.9822"), 89.9822);
assert.equal(sudutDesimal(89.9822), 89.9822);
assert.equal(sudutDesimal("0"), null, "nol = tidak terisi");
assert.equal(sudutDesimal(""), null);
assert.equal(sudutDesimal(undefined), null);
assert.equal(sudutDesimal("400"), null, "di luar lingkaran gon");
assert.equal(sudutDesimal("089,98,22"), null, "teks DDD,xx,yy bukan desimal");

// Teks dan desimal dari spesifikasi firmware: "089,98,22" = 89.9822.
assert.equal(bacaSudut("089,98,22"), 89.9822);

const a = pilihSudut("089,98,22", "89.9822", bacaSudut);
assert.deepEqual(a, { nilai: 89.9822, dari: "desimal", beda: null }, "cocok");
const b = pilihSudut("089,98,22", undefined, bacaSudut);
assert.deepEqual(b, { nilai: "089,98,22", dari: "teks", beda: null }, "firmware lama");
const c = pilihSudut("089,98,22", "0", bacaSudut);
assert.equal(c.dari, "teks", "desimal nol jatuh ke teks");
const d = pilihSudut("089,98,22", "89.9900", bacaSudut);
assert.equal(d.dari, "desimal");
assert.ok(d.beda !== null && Math.abs(d.beda + 0.0078) < 1e-9, "beda dicatat, desimal tetap dipakai");
const e = pilihSudut("000,00,00", "124.2819", bacaSudut);
assert.deepEqual(e, { nilai: 124.2819, dari: "desimal", beda: null }, "teks kosong tidak dihitung beda");

console.log("kiriman-adr.test.ts: semua lolos");
