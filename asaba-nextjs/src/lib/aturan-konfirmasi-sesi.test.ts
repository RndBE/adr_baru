/**
 * Konfirmasi beberapa sesi. Jalankan: npx tsx src/lib/aturan-konfirmasi-sesi.test.ts
 */
import assert from "node:assert/strict";
import type { AmbangSite } from "./ambang";
import { keadaanAwal, nilaiPeredam } from "./peredam";
import {
  geserTerkonfirmasi,
  KONFIRMASI_SESI_BAWAAN,
  pemicuKonfirmasi,
  validasiKonfirmasiSesi,
} from "./aturan-konfirmasi-sesi";

assert.equal(KONFIRMASI_SESI_BAWAAN, 2);
assert.equal(validasiKonfirmasiSesi(2), null);
assert.equal(validasiKonfirmasiSesi(1), null);
assert.match(validasiKonfirmasiSesi(0) ?? "", /1–5/);
assert.match(validasiKonfirmasiSesi(6) ?? "", /1–5/);
assert.match(validasiKonfirmasiSesi(1.5) ?? "", /1–5/);

// ── Nilai pemicu ────────────────────────────────────────────────────────────
assert.deepEqual(pemicuKonfirmasi(52, [], 1), { nilaiMm: 52, bolehNaik: true }, "1 sesi = sesi ini sendiri");
assert.deepEqual(pemicuKonfirmasi(52, [27], 1), { nilaiMm: 52, bolehNaik: true }, "1 sesi: riwayat diabaikan");
assert.deepEqual(pemicuKonfirmasi(52, [27], 2), { nilaiMm: 27, bolehNaik: true }, "Waspada lalu Normal = Normal");
assert.deepEqual(pemicuKonfirmasi(27, [52], 2), { nilaiMm: 27, bolehNaik: true });
assert.deepEqual(pemicuKonfirmasi(52, [47], 2), { nilaiMm: 47, bolehNaik: true }, "dua-duanya Waspada");
assert.deepEqual(pemicuKonfirmasi(90, [47], 2), { nilaiMm: 47, bolehNaik: true }, "Waspada lalu Siaga = Waspada dulu");
assert.deepEqual(pemicuKonfirmasi(52, [null], 2), { nilaiMm: 52, bolehNaik: false }, "sesi lalu gagal ditembak");
assert.deepEqual(pemicuKonfirmasi(52, [], 2), { nilaiMm: 52, bolehNaik: false }, "belum ada sesi sejak R0");
assert.deepEqual(pemicuKonfirmasi(52, [47, 5], 2), { nilaiMm: 47, bolehNaik: true }, "hanya N−1 terbaru");
assert.deepEqual(pemicuKonfirmasi(60, [55, 50], 3), { nilaiMm: 50, bolehNaik: true }, "3 sesi: ketiganya");
assert.deepEqual(pemicuKonfirmasi(60, [55, null], 3), { nilaiMm: 55, bolehNaik: false });

// ── Lewat peredam, deret nyata ──────────────────────────────────────────────
const KOLAM: AmbangSite = {
  geser: { normalMax: 35, waspadaMax: 80, siagaMax: 150 },
  laju: { waspadaMin: 35, siagaMin: 80, awasMin: 150 },
};

/** Deret bacaan satu prisma (terlama dulu); null = gagal ditembak. Tingkat yang diakui + yang dikirim. */
function jalankan(bacaan: Array<number | null>, sesi: number) {
  let keadaan = keadaanAwal();
  const riwayat: Array<number | null> = [];
  const tingkat: string[] = [];
  const kirim: Array<{ sesi: number; tingkat: string }> = [];
  bacaan.forEach((mm, i) => {
    if (mm !== null) {
      const p = pemicuKonfirmasi(mm, riwayat, sesi);
      const h = nilaiPeredam({ keadaan, nilaiMm: p.nilaiMm, ambang: KOLAM, sekarangMs: i * 420_000, bolehNaik: p.bolehNaik });
      keadaan = h.keadaan;
      if (h.kirim) kirim.push({ sesi: i, tingkat: h.keadaan.tingkat });
    }
    tingkat.push(keadaan.tingkat);
    // Seperti evaluasi-siklus: sesi yang tidak menembak prisma ini dilewati.
    if (mm !== null) riwayat.unshift(mm);
  });
  return { tingkat, kirim };
}

// P4, uji lapangan Kolam BPP 27 Nov 2026 (tembakan sah 130829 … 140545, R0 125815).
const P4 = [46.9, 37.9, 27.1, 52.3, 32.4, 52.3];
// Di sini (ambang 35 mm tanpa toleransi alat) 1 sesi: tiap loncatan jadi pesan.
assert.equal(jalankan(P4, 1).kirim.length, 3, "1 sesi: loncatan jadi pesan");
// 2 sesi: hanya 46,9 → 37,9 (dua-duanya Waspada) yang memicu; 52,3 → 32,4 → 52,3 tidak.
assert.deepEqual(jalankan(P4, 2).kirim, [
  { sesi: 1, tingkat: "Waspada" },
  { sesi: 2, tingkat: "Normal" },
]);
assert.deepEqual(jalankan(P4, 2).tingkat, ["Normal", "Waspada", "Normal", "Normal", "Normal", "Normal"]);
// Bolak-balik murni: tidak pernah memicu.
assert.deepEqual(jalankan([46.9, 27.1, 52.3, 32.4, 52.3], 2).kirim, []);

// Contoh dari lapangan: Waspada lalu Waspada baru memicu.
assert.deepEqual(jalankan([10, 46, 52], 2).kirim, [{ sesi: 2, tingkat: "Waspada" }]);
// Waspada lalu Normal: tidak memicu.
assert.deepEqual(jalankan([10, 46, 20], 2).kirim, []);
// Sesi pertama sesudah R0 tidak pernah memicu sendirian.
assert.deepEqual(jalankan([46, 52], 2).kirim, [{ sesi: 1, tingkat: "Waspada" }]);
// Waspada, lalu Siaga dua kali.
assert.deepEqual(jalankan([46, 52, 90, 95], 2).kirim, [
  { sesi: 1, tingkat: "Waspada" },
  { sesi: 3, tingkat: "Siaga" },
]);
// Gagal ditembak di tengah: sesi itu dilewati, 46 dan 52 tetap saling memastikan.
assert.deepEqual(jalankan([10, 46, null, 52, 55], 2).kirim, [{ sesi: 3, tingkat: "Waspada" }]);
// Gagal ditembak lalu Normal: tidak memicu.
assert.deepEqual(jalankan([10, 46, null, 12], 2).kirim, []);
// Sudah Waspada, satu sesi Normal langsung menurunkan (pulih dikirim).
assert.deepEqual(jalankan([46, 52, 10], 2).kirim, [
  { sesi: 1, tingkat: "Waspada" },
  { sesi: 2, tingkat: "Normal" },
]);
// Loncatan tunggal 161 mm: tidak memicu.
assert.deepEqual(jalankan([12, 15, 161, 14, 13], 2).kirim, []);

// ── Bergeser lagi sesudah konfirmasi ────────────────────────────────────────
assert.equal(geserTerkonfirmasi(40, [], 1), 40, "1 sesi = sesi ini sendiri");
assert.equal(geserTerkonfirmasi(40, [38], 2), 38);
assert.equal(geserTerkonfirmasi(40, [5], 2), 5, "sesi sebelumnya belum bergeser");
assert.equal(geserTerkonfirmasi(40, [null], 2), null, "sesi sebelumnya tak ada jarak");
assert.equal(geserTerkonfirmasi(40, [], 2), null, "belum ada sesi sebelumnya");
assert.equal(geserTerkonfirmasi(null, [40], 2), null);

console.log("aturan-konfirmasi-sesi.test.ts: semua lolos");
