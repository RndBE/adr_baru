/**
 * Jalankan: npx tsx src/components/monitoring/format.test.ts
 *
 * Menguji `waktuDbWib` saja — pemformat yang menentukan jam apa yang benar-benar
 * masuk ke database. Salah tujuh jam di sini tidak memunculkan galat apa pun;
 * datanya tetap tersimpan, cuma dengan waktu yang keliru, dan itu baru ketahuan
 * setelah dipakai.
 */
import assert from "node:assert";
import { waktuDbWib } from "./format";

// Epoch tetap: hasilnya WAJIB sama di zona proses mana pun. Menjalankan berkas
// ini dengan TZ=UTC dan TZ=Asia/Jakarta harus memberi keluaran identik.
assert.strictEqual(waktuDbWib(new Date("2026-09-12T10:13:00Z")), "2026-09-12 17:13:00");

// Lewat tengah malam UTC: 2026-09-11 20:30 UTC = 2026-09-12 03:30 WIB.
// Tanggalnya ikut maju — inilah yang dulu membuat grafik "hari ini" membuka
// hari kemarin sepanjang pukul 00:00-06:59 WIB.
assert.strictEqual(waktuDbWib(new Date("2026-09-11T20:30:00Z")), "2026-09-12 03:30:00");
assert.strictEqual(waktuDbWib(new Date("2026-09-11T20:30:00Z")).slice(0, 10), "2026-09-12");

// Tahun baru WIB terjadi tujuh jam sebelum tahun baru UTC.
assert.strictEqual(waktuDbWib(new Date("2026-12-31T17:00:00Z")), "2027-01-01 00:00:00");

// Bentuknya harus persis yang diterima kolom DATETIME MySQL: spasi, tanpa "T",
// tanpa milidetik, tanpa akhiran zona.
assert.match(waktuDbWib(new Date()), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

console.log("✅ waktuDbWib lulus");
