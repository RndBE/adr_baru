/**
 * Acuan baru per prisma sesudah arah bidik diperbarui.
 * Jalankan: npx tsx src/lib/aturan-acuan.test.ts
 */
import assert from "node:assert/strict";
import { acuanTerbaru, catatanAcuanBaru, teksAcuanBaru, teksAcuanPrisma, type AcuanBaru } from "./aturan-acuan";
import { naikSesudahKonfirmasi, tingkatTercakup } from "./aturan-kejadian";

// ── Acuan terbaru per prisma ────────────────────────────────────────────────
const peta = acuanTerbaru([
  { id: 3, idPrisma: "P2", tanda: "lama" },
  { id: 7, idPrisma: "P2", tanda: "baru" },
  { id: 5, idPrisma: "P1", tanda: "satu" },
]);
assert.equal(peta.get("P2")?.tanda, "baru", "id terbesar yang berlaku");
assert.equal(peta.get("P1")?.tanda, "satu");
assert.equal(peta.has("P3"), false, "prisma tanpa acuan baru tetap terhadap R0");

// ── Baris kaki pesan siklus ─────────────────────────────────────────────────
assert.equal(teksAcuanPrisma([]), null);
assert.equal(
  teksAcuanPrisma([
    { idPrisma: "P10", waktuTembakan: "2026-11-23 17:00:00" },
    { idPrisma: "P2", waktuTembakan: "2026-11-23 16:21:00" },
  ]),
  "Acuan baru (arah bidik diperbarui): P2 sejak 23 Nov 16:21, P10 sejak 23 Nov 17:00",
  "urut nomor prisma, bukan urut huruf"
);

// ── Kabar dan catatan ───────────────────────────────────────────────────────
const dasar: AcuanBaru = {
  namaSite: "Kolam BPP",
  idPrisma: "P2",
  oleh: "Andi",
  waktu: "2026-11-23 16:34:57",
  waktuTembakan: "2026-11-23 16:21:00",
  geserDiterimaMm: 239.4,
  dari: "Awas",
  ke: "Normal",
  nilaiMm: 0.3,
  tingkatSite: "Awas",
  masihAlarm: [{ idPrisma: "P1", tingkat: "Awas", nilaiMm: 134.4 }],
};
assert.equal(
  teksAcuanBaru(dasar),
  [
    "*[Acuan baru] Kolam BPP*",
    "Arah bidik P2 diperbarui oleh Andi, 23 Nov 16:34.",
    "Posisi tembakan 23 Nov 16:21 (bergeser 239 mm dari acuan sebelumnya) sekarang jadi acuan P2.",
    "P2: Awas → Normal (0 mm)",
    "Site masih Awas: P1 Awas 134 mm.",
  ].join("\n")
);
assert.match(
  teksAcuanBaru({ ...dasar, tingkatSite: "Normal", masihAlarm: [] }),
  /Semua prisma Normal — alarm selesai\.$/
);
assert.doesNotMatch(teksAcuanBaru({ ...dasar, geserDiterimaMm: null }), /bergeser/, "tanpa acuan lama: tidak menebak");
assert.equal(
  catatanAcuanBaru("P2 digeser untuk uji", dasar),
  "P2 digeser untuk uji\n[23 Nov 16:34] Acuan baru P2: arah bidik diperbarui oleh Andi, pergeseran 239 mm diterima sebagai posisi baru. P2 Awas → Normal."
);

// ── Konfirmasi tidak lagi mencakup prisma yang diberi acuan baru ─────────────
// P2 Awas (16:20) dikonfirmasi 16:21, acuan baru P2 16:34. P2 naik lagi ke Awas
// terhadap acuan baru = pergeseran baru, harus membunyikan alarm.
const jam = (hhmm: string) => Date.UTC(2026, 10, 23, Number(hhmm.slice(0, 2)), Number(hhmm.slice(3)));
const riwayat = [{ idPrisma: "P2", ke: "Awas" as const, waktuMs: jam("16:20") }];
const tanpaAcuan = tingkatTercakup(riwayat);
assert.deepEqual(
  naikSesudahKonfirmasi([{ idPrisma: "P2", tingkat: "Awas" as const }], tanpaAcuan),
  [],
  "tanpa acuan baru: P2 Awas tetap tercakup"
);
const denganAcuan = tingkatTercakup(riwayat, new Map([["P2", jam("16:34")]]));
assert.equal(denganAcuan.get("P2"), undefined, "riwayat sebelum acuan baru gugur");
assert.deepEqual(
  naikSesudahKonfirmasi([{ idPrisma: "P2", tingkat: "Awas" as const }], denganAcuan).map((p) => p.idPrisma),
  ["P2"],
  "P2 naik lagi sesudah acuan baru: alarm menyala"
);
assert.equal(
  tingkatTercakup([{ idPrisma: "P1", ke: "Siaga" as const, waktuMs: jam("16:20") }], new Map([["P2", jam("16:34")]])).get("P1"),
  "Siaga",
  "acuan baru P2 tidak menyentuh P1"
);
assert.equal(
  tingkatTercakup([{ idPrisma: "P2", ke: "Siaga" as const, waktuMs: jam("16:40") }], new Map([["P2", jam("16:34")]])).get("P2"),
  "Siaga",
  "riwayat sesudah acuan baru tetap dihitung"
);

console.log("aturan-acuan.test.ts: semua lolos");
