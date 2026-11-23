/**
 * Kunci pemilihan jadwal running. Jalankan: npx tsx src/lib/jadwal-running.test.ts
 */
import assert from "node:assert/strict";
import { hariIso, jadwalJatuhTempo, menitDariJam, type BarisJadwal } from "@/lib/jadwal-running";

// ── hariIso: Senin 1 … Minggu 7 ─────────────────────────────────────────────
assert.equal(hariIso("2026-11-23"), 1, "23 Nov 2026 Senin");
assert.equal(hariIso("2026-11-28"), 6, "Sabtu");
assert.equal(hariIso("2026-11-29"), 7, "Minggu = 7, bukan 0");
assert.equal(hariIso("bukan tanggal"), null);

// ── menitDariJam ────────────────────────────────────────────────────────────
assert.equal(menitDariJam("15:06"), 906);
assert.equal(menitDariJam("7:05"), 425);
assert.equal(menitDariJam("20:25:00"), 1225);
assert.equal(menitDariJam("24:00"), null);
assert.equal(menitDariJam(""), null);
assert.equal(menitDariJam(null), null);

// ── jadwalJatuhTempo ────────────────────────────────────────────────────────
const b = (id: string, days: number, time: string, status = 1): BarisJadwal => ({ id, nama: id, days, time, status });
const daftar = [
  b("r1", 1, "15:06"),
  b("r2", 1, "15:12"),
  b("r3", 1, "20:00", 0),
  b("r4", 2, "15:06"),
  b("r19", 7, "20:50"),
];

assert.equal(jadwalJatuhTempo(daftar, "2026-11-23 15:05:59"), null, "belum waktunya");
assert.deepEqual(jadwalJatuhTempo(daftar, "2026-11-23 15:06:00"), { baris: daftar[0], sejakDb: "2026-11-23 15:06:00" });
assert.equal(jadwalJatuhTempo(daftar, "2026-11-23 15:08:30")?.baris.id, "r1", "cron telat 2 menit masih jalan");
assert.equal(jadwalJatuhTempo(daftar, "2026-11-23 15:09:00"), null, "lewat jendela 3 menit");
assert.equal(jadwalJatuhTempo(daftar, "2026-11-23 20:00:00"), null, "run nonaktif");
assert.equal(jadwalJatuhTempo(daftar, "2026-11-24 15:06:00")?.baris.id, "r4", "Selasa");
assert.equal(jadwalJatuhTempo(daftar, "2026-11-29 20:51:00")?.baris.id, "r19", "Minggu = 7");
assert.equal(jadwalJatuhTempo(daftar, "2026-11-30 20:51:00"), null, "Senin bukan Minggu");

// Dua jadwal berdekatan: yang paling akhir.
const rapat = [b("a", 1, "10:00"), b("c", 1, "10:01")];
assert.equal(jadwalJatuhTempo(rapat, "2026-11-23 10:01:10")?.baris.id, "c");

// Status / hari datang sebagai string dari basis data lama.
assert.equal(
  jadwalJatuhTempo([{ id: "s", nama: "s", days: "1" as unknown as number, time: "9:30", status: "1" as unknown as number }], "2026-11-23 09:30:05")?.sejakDb,
  "2026-11-23 09:30:00"
);

// Tidak melintasi tengah malam.
assert.equal(jadwalJatuhTempo([b("m", 1, "23:59")], "2026-11-24 00:01:00"), null);
assert.equal(jadwalJatuhTempo(daftar, "rusak"), null);

console.log("jadwal-running: semua lulus");
