/**
 * Nol set dari koordinat survei BS. Jalankan: npx tsx src/lib/orientasi-bs.test.ts
 *
 * Angka uji: Kolam BPP, pemasangan RTS 27 Nov 2026, bacaan BS sesi R0 094022
 * (rata-rata dua tembakan), koordinat survei dari tim lapangan.
 */
import assert from "node:assert/strict";
import {
  cekOrientasiBs,
  pesanCekBs,
  nolSetDariBs,
  rataNolSet,
  selisihSudut,
  validasiNolSet,
  validasiTinggiAlat,
} from "./orientasi-bs";

const STA = { E: 464232.796, N: 9749253.947, H: 38.813 };
const BS01 = { E: 464253.194, N: 9749275.788, H: 38.718 };
const BS02 = { E: 464215.063, N: 9749253.895, H: 38.136 };
// slot 9 ("BS2") dan slot 10 ("BS1")
const P9 = { ha: 164.24605, va: 107.80235, sd: 17.9194 };
const P10 = { ha: 312.36725, va: 103.3406, sd: 30.0271 };
const GON = 0.9;

const dekat = (a: number, b: number, tol: number, pesan: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${pesan}: ${a} vs ${b}`);

// ── Pasangan benar: slot 9 = BS02, slot 10 = BS01 ──────────────────────────
const a = nolSetDariBs(STA, BS02, P9, GON)!;
const b = nolSetDariBs(STA, BS01, P10, GON)!;
dekat(a.z, 135.567, 0.001, "Z dari BS02");
dekat(b.z, 135.459, 0.001, "Z dari BS01");
dekat(a.bedaJarakMm, 52, 2, "jarak BS02");
dekat(b.bedaJarakMm, 101, 2, "jarak BS01");
dekat(a.hiMinHt, 1.514, 0.002, "hi-ht BS02");
dekat(b.hiMinHt, 1.48, 0.002, "hi-ht BS01");

const m = rataNolSet([a.z, b.z], GON)!;
dekat(m.z, 135.513, 0.001, "Zm");
dekat(m.sebaranMili, 54, 1, "sebaran");
// Angka lapangan 135,488 berselisih 25 mgon dari hitungan sesi R0 ini.
dekat(selisihSudut(m.z, 135.488, 400) * 1000, 25, 1, "selisih dengan angka lapangan");

// ── Pasangan tertukar langsung ketahuan dari jaraknya ───────────────────────
const salah = nolSetDariBs(STA, BS01, P9, GON)!;
assert.ok(Math.abs(salah.bedaJarakMm) > 10_000, "tertukar = meleset > 10 m");

// ── Rata-rata sirkular melintasi nol ────────────────────────────────────────
dekat(rataNolSet([399.9, 0.1], GON)!.z, 0, 1e-9, "melintasi 400/0");
dekat(rataNolSet([359.9, 0.1], 1)!.z % 360, 0, 1e-9, "derajat");
assert.equal(rataNolSet([], GON), null);
dekat(selisihSudut(0.1, 399.9, 400), 0.2, 1e-9, "selisih bungkus");

// ── Masukan rusak ───────────────────────────────────────────────────────────
assert.equal(nolSetDariBs(STA, BS01, { ha: 1, va: 100, sd: 0 }, GON), null, "SD 0");
assert.equal(nolSetDariBs(STA, { E: NaN, N: 1, H: 1 }, P9, GON), null, "koordinat kosong");
assert.equal(nolSetDariBs(STA, STA, P9, GON), null, "BS di titik alat");

// ── Cek BS per siklus ───────────────────────────────────────────────────────
const acuanBs = new Map([["P9", 164.24605], ["P10", 312.36725]]);
// Hanyut semalam 27-28 Nov: −5,0 dan −5,9 mgon -> nol set +5,4, di bawah ambang.
const semalam = cekOrientasiBs(acuanBs, new Map([["P9", 164.24105], ["P10", 312.36135]]), GON);
dekat(semalam.dZMili!, 5.45, 0.01, "hanyut semalam");
assert.equal(semalam.lewat, false);
assert.equal(pesanCekBs(semalam, "gon"), null);

// Alat berputar 20 mgon: kedua BS bergeser sama.
const putar = cekOrientasiBs(acuanBs, new Map([["P9", 164.22605], ["P10", 312.34725]]), GON);
assert.equal(putar.lewat, true);
assert.equal(putar.sepakat, true);
assert.match(pesanCekBs(putar, "gon", (id) => (id === "P9" ? "BS2" : "BS1")) ?? "", /alat kemungkinan berputar/i);
assert.match(pesanCekBs(putar, "gon") ?? "", /\+20,0 mgon/);

// Satu BS saja yang bergeser.
const satu = cekOrientasiBs(acuanBs, new Map([["P9", 164.27605], ["P10", 312.36725]]), GON);
assert.equal(satu.lewat, true);
assert.equal(satu.sepakat, false);
assert.match(pesanCekBs(satu, "gon") ?? "", /Backsight P9 bergeser.*backsight lain tidak/);

// Melintasi 0/400, BS hilang, tidak ada BS.
const lintas = cekOrientasiBs(new Map([["P9", 399.999]]), new Map([["P9", 0.001]]), GON);
dekat(lintas.dZMili!, -2, 1e-6, "melintasi nol");
assert.equal(lintas.sepakat, null);
const hilang = cekOrientasiBs(acuanBs, new Map([["P9", 164.24605]]), GON);
assert.equal(hilang.perBs.length, 1);
assert.equal(cekOrientasiBs(acuanBs, new Map(), GON).dZMili, null);

// ── Validasi ────────────────────────────────────────────────────────────────
assert.equal(validasiNolSet("135.488", GON), null);
assert.match(validasiNolSet("400", GON) ?? "", /di bawah 400/);
assert.match(validasiNolSet("", GON) ?? "", /angka/);
assert.equal(validasiNolSet(359, 1), null);
assert.equal(validasiTinggiAlat("1.5"), null);
assert.match(validasiTinggiAlat("12") ?? "", /0–5/);

console.log("orientasi-bs.test.ts: semua lolos");
