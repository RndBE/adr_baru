/**
 * Kunci tabel level EWS. Jalankan: npx tsx src/lib/ews.test.ts
 */
import assert from "node:assert/strict";
import { levelEws, payloadEws, perluKirimEws, tingkatSite } from "@/lib/ews";

// Angka level mengikuti keparahan: 1 Waspada, 2 Siaga, 3 Awas, 0 Aman.
// (Dulu terbalik; dikoreksi operator perangkat 2026-11-17.)
assert.equal(levelEws("Waspada"), 1);
assert.equal(levelEws("Siaga"), 2);
assert.equal(levelEws("Awas"), 3);
assert.equal(levelEws("Normal"), 0);

// Bentuk payload persis seperti yang dibaca firmware: tanpa set_<id>.
assert.deepEqual(payloadEws("Awas"), { EWS: { cmd: "CTRL", level: 3 } });
assert.equal(JSON.stringify(payloadEws("Normal")), '{"EWS":{"cmd":"CTRL","level":0}}');
assert.equal(JSON.stringify(payloadEws("Waspada")), '{"EWS":{"cmd":"CTRL","level":1}}');

// Satu prisma Awas cukup; yang lain normal tidak meredamnya.
assert.equal(tingkatSite(["Normal", "Awas", "Normal", "Siaga"]), "Awas");
assert.equal(tingkatSite(["Normal", "Waspada", "Normal"]), "Waspada");
assert.equal(tingkatSite(["Normal", "Normal"]), "Normal");
// Tanpa data = Aman, bukan galat.
assert.equal(tingkatSite([]), "Normal");
assert.equal(tingkatSite([null, undefined]), "Normal");

// ── perluKirimEws: dibandingkan dengan yang terakhir TERKIRIM ──────────────
const awas = { idLoggerEws: "40001", tingkat: "Awas" as const };
assert.equal(perluKirimEws(null, "40001", "Normal"), true, "belum pernah → kirim keadaan awal");
assert.equal(perluKirimEws(awas, "40001", "Awas"), false, "sama → diam, sirene tidak dibunyikan ulang");
assert.equal(perluKirimEws(awas, "40001", "Siaga"), true, "turun → kirim");
assert.equal(perluKirimEws(awas, "40002", "Awas"), true, "logger EWS diganti → kirim ke yang baru");
// Kasus nyangkut di versi lama: R0 diganti menghapus status_prisma, jadi
// "sebelum" dan "sesudah" sama-sama Normal — tapi perangkat masih Awas.
assert.equal(perluKirimEws(awas, "40001", "Normal"), true, "R0 diganti saat Awas → Aman tetap dikirim");
// Terbit gagal tidak menulis status_ews, jadi yang terakhir terkirim masih
// tingkat lama dan siklus berikutnya mengulang.
const waspada = { idLoggerEws: "40001", tingkat: "Waspada" as const };
assert.equal(perluKirimEws(waspada, "40001", "Siaga"), true, "terbit Siaga gagal → diulang");

console.log("ews.test.ts: semua lolos");
