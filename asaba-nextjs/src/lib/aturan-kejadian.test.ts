/**
 * Kunci aturan kejadian alarm. Jalankan: npx tsx src/lib/aturan-kejadian.test.ts
 */
import assert from "node:assert/strict";
import {
  bolehVerifikasi,
  catatTutupModal,
  kejadianUntukModal,
  langkahKejadian,
  perluKonfirmasi,
  prismaPuncak,
  senyapBerlaku,
  statusKejadian,
  teksKonfirmasi,
  teksVerifikasi,
  tersembunyiDariBanner,
  uraiCatatanModal,
  validasiVerifikasi,
  type KejadianRingkas,
} from "@/lib/aturan-kejadian";
import { tingkatUntukEws } from "@/lib/ews";

// ── langkahKejadian ─────────────────────────────────────────────────────────
assert.deepEqual(langkahKejadian(null, "Normal", null), { jenis: "diam" });
assert.deepEqual(langkahKejadian(null, "Siaga", 90), { jenis: "buka" });
const siaga90 = { tingkatPuncak: "Siaga" as const, nilaiPuncakMm: 90 };
assert.deepEqual(langkahKejadian(siaga90, "Normal", 10), { jenis: "pulih" });
assert.deepEqual(langkahKejadian(siaga90, "Awas", 160), { jenis: "perbarui", gantiPuncak: true });
assert.deepEqual(langkahKejadian(siaga90, "Siaga", 95), { jenis: "perbarui", gantiPuncak: true }, "sama tingkat, lebih besar");
assert.deepEqual(langkahKejadian(siaga90, "Siaga", 85), { jenis: "perbarui", gantiPuncak: false });
assert.deepEqual(langkahKejadian(siaga90, "Waspada", 60), { jenis: "perbarui", gantiPuncak: false }, "turun tidak mengganti puncak");

// ── prismaPuncak ────────────────────────────────────────────────────────────
assert.equal(prismaPuncak([]), null);
assert.equal(
  prismaPuncak([
    { idPrisma: "P1", tingkat: "Siaga", nilaiMm: 90 },
    { idPrisma: "P2", tingkat: "Awas", nilaiMm: 160 },
    { idPrisma: "P3", tingkat: "Awas", nilaiMm: 170 },
    { idPrisma: "P4", tingkat: "Normal", nilaiMm: 400 },
  ])?.idPrisma,
  "P3"
);
assert.equal(
  prismaPuncak([
    { idPrisma: "P1", tingkat: "Siaga", nilaiMm: null },
    { idPrisma: "P2", tingkat: "Siaga", nilaiMm: 85 },
  ])?.idPrisma,
  "P2",
  "tak terbaca kalah dari yang terbaca"
);

// ── Senyap: hanya sampai tingkat yang dikonfirmasi ──────────────────────────
assert.equal(senyapBerlaku("Siaga", null), false, "belum dikonfirmasi");
assert.equal(senyapBerlaku("Siaga", "Siaga"), true);
assert.equal(senyapBerlaku("Waspada", "Siaga"), true, "turun tetap senyap");
assert.equal(senyapBerlaku("Awas", "Siaga"), false, "naik melewati konfirmasi = bunyi lagi");
assert.equal(senyapBerlaku("Normal", "Awas"), false);

// Perintah ke perangkat: level 0 selama senyap, tingkat asli bila naik.
assert.equal(tingkatUntukEws("Siaga", "Siaga"), "Normal");
assert.equal(tingkatUntukEws("Awas", "Siaga"), "Awas");
assert.equal(tingkatUntukEws("Awas", null), "Awas");
assert.equal(tingkatUntukEws("Normal", null), "Normal");

assert.equal(perluKonfirmasi({ aktif: true, tingkatTerakhir: "Siaga", tingkatDikonfirmasi: null }), true);
assert.equal(perluKonfirmasi({ aktif: true, tingkatTerakhir: "Siaga", tingkatDikonfirmasi: "Siaga" }), false);
assert.equal(perluKonfirmasi({ aktif: true, tingkatTerakhir: "Awas", tingkatDikonfirmasi: "Siaga" }), true);
assert.equal(perluKonfirmasi({ aktif: false, tingkatTerakhir: "Normal", tingkatDikonfirmasi: null }), false);

assert.equal(bolehVerifikasi({ aktif: true, dikonfirmasi: false }), false, "sirene masih bunyi");
assert.equal(bolehVerifikasi({ aktif: true, dikonfirmasi: true }), true);
assert.equal(bolehVerifikasi({ aktif: false, dikonfirmasi: false }), true, "pulih sendiri");

// ── statusKejadian ──────────────────────────────────────────────────────────
const dasar: KejadianRingkas = {
  id: 1, site: "kolam_bpp", namaSite: "Kolam BPP", mulai: "2026-11-16 13:20:00",
  tingkatPuncak: "Siaga", tingkatTerakhir: "Siaga", prismaPuncak: "P2", nilaiPuncakMm: 90,
  pulih: null, dikonfirmasi: null, dikonfirmasiOleh: null, tingkatDikonfirmasi: null,
  diverifikasi: null, diverifikasiOleh: null, hasil: null, penyebab: null, catatan: null,
};
assert.equal(statusKejadian(dasar), "perlu-konfirmasi");
const senyap = { ...dasar, dikonfirmasi: "2026-11-16 13:25:00", dikonfirmasiOleh: "Andi", tingkatDikonfirmasi: "Siaga" as const };
assert.equal(statusKejadian(senyap), "disenyapkan");
assert.equal(statusKejadian({ ...senyap, tingkatTerakhir: "Awas" }), "perlu-konfirmasi");
assert.equal(statusKejadian({ ...dasar, pulih: "2026-11-16 14:00:00", tingkatTerakhir: "Normal" }), "perlu-verifikasi");
assert.equal(statusKejadian({ ...senyap, diverifikasi: "2026-11-16 14:10:00", hasil: "palsu" }), "selesai");

// ── tersembunyiDariBanner ───────────────────────────────────────────────────
const terverifikasi = { ...senyap, diverifikasi: "2026-11-16 14:10:00", hasil: "benar" as const };
assert.equal(tersembunyiDariBanner(dasar), false, "belum dikonfirmasi tetap tampil");
assert.equal(tersembunyiDariBanner(senyap), false, "dikonfirmasi tapi belum diverifikasi tetap tampil");
assert.equal(tersembunyiDariBanner(terverifikasi), true, "aktif + terverifikasi pindah ke lencana");
assert.equal(
  tersembunyiDariBanner({ ...terverifikasi, tingkatTerakhir: "Awas" }),
  false,
  "naik melewati yang dikonfirmasi: banner muncul lagi"
);
assert.equal(
  tersembunyiDariBanner({ ...terverifikasi, pulih: "2026-11-16 15:00:00", tingkatTerakhir: "Normal" }),
  false,
  "sudah pulih: bukan urusan banner aktif"
);

// ── validasiVerifikasi ──────────────────────────────────────────────────────
assert.equal(validasiVerifikasi({}).ok, false);
assert.equal(validasiVerifikasi({ hasil: "palsu", catatan: "prisma tertutup daun" }).ok, false, "palsu wajib penyebab");
assert.equal(validasiVerifikasi({ hasil: "palsu", penyebab: "ngarang", catatan: "prisma tertutup daun" }).ok, false);
assert.equal(validasiVerifikasi({ hasil: "benar", catatan: "ok" }).ok, false, "catatan terlalu pendek");
assert.deepEqual(validasiVerifikasi({ hasil: "benar", penyebab: "Lainnya", catatan: "  retak baru di tanggul  " }), {
  ok: true, hasil: "benar", penyebab: null, catatan: "retak baru di tanggul",
});
assert.deepEqual(
  validasiVerifikasi({ hasil: "palsu", penyebab: "Prisma terhalang atau kotor", catatan: "tertutup daun" }),
  { ok: true, hasil: "palsu", penyebab: "Prisma terhalang atau kotor", catatan: "tertutup daun" }
);

// ── Modal alarm otomatis ────────────────────────────────────────────────────
const MENIT = 60_000;
const t0 = Date.parse("2026-11-16T15:20:00Z");
const siagaAktif: KejadianRingkas = { ...dasar, id: 7, tingkatTerakhir: "Siaga", tingkatPuncak: "Siaga" };
const awasAktif: KejadianRingkas = { ...dasar, id: 8, site: "lain", tingkatTerakhir: "Awas", tingkatPuncak: "Awas", mulai: "2026-11-16 15:30:00" };

assert.equal(kejadianUntukModal([siagaAktif], {}, t0)?.id, 7, "belum pernah ditutup → muncul");
assert.equal(
  kejadianUntukModal([{ ...dasar, id: 9, tingkatTerakhir: "Waspada" }], {}, t0),
  null,
  "Waspada tidak memunculkan modal"
);
assert.equal(kejadianUntukModal([{ ...siagaAktif, pulih: "2026-11-16 15:40:00" }], {}, t0), null, "sudah pulih");
assert.equal(
  kejadianUntukModal([{ ...siagaAktif, dikonfirmasi: "2026-11-16 15:25:00", tingkatDikonfirmasi: "Siaga" }], {}, t0),
  null,
  "sudah dikonfirmasi"
);
assert.equal(
  kejadianUntukModal([{ ...awasAktif, dikonfirmasi: "2026-11-16 15:25:00", tingkatDikonfirmasi: "Siaga" }], {}, t0)?.id,
  8,
  "Awas melewati konfirmasi Siaga → muncul lagi"
);
assert.equal(kejadianUntukModal([siagaAktif, awasAktif], {}, t0)?.id, 8, "yang terburuk dulu");

// Ditutup lalu: diam sampai jeda habis, kecuali tingkat naik.
const ditutup = { "7": { tingkat: "Siaga" as const, ms: t0 } };
assert.equal(kejadianUntukModal([siagaAktif], ditutup, t0 + MENIT), null, "belum 2 menit");
assert.equal(kejadianUntukModal([siagaAktif], ditutup, t0 + 2 * MENIT)?.id, 7, "pengingat setelah 2 menit");
assert.equal(
  kejadianUntukModal([{ ...siagaAktif, tingkatTerakhir: "Awas" }], ditutup, t0 + MENIT)?.id,
  7,
  "naik ke Awas → langsung muncul walau baru ditutup"
);
assert.equal(
  kejadianUntukModal([{ ...siagaAktif, tingkatTerakhir: "Siaga" }], { "7": { tingkat: "Awas", ms: t0 } }, t0 + MENIT),
  null,
  "turun tidak memunculkan modal"
);
assert.equal(kejadianUntukModal([siagaAktif], ditutup, t0 - 2 * MENIT)?.id, 7, "jam peramban mundur → mengingatkan");
assert.equal(kejadianUntukModal([siagaAktif], ditutup, t0 - 10_000), null, "selisih jam beberapa detik = basi biasa, bukan mundur");

// Catatan: aman terhadap isi rusak, dan tidak menumpuk.
assert.deepEqual(uraiCatatanModal(null), {});
assert.deepEqual(uraiCatatanModal("bukan json"), {});
assert.deepEqual(uraiCatatanModal("[1,2]"), {});
assert.deepEqual(uraiCatatanModal('{"7":{"tingkat":"Siaga","ms":5},"8":{"tingkat":"Ngawur","ms":1},"9":{"ms":1}}'), {
  "7": { tingkat: "Siaga", ms: 5 },
});
const catat = catatTutupModal({ "7": { tingkat: "Siaga", ms: 1 }, "99": { tingkat: "Awas", ms: 2 } }, [siagaAktif, awasAktif], awasAktif, t0);
assert.deepEqual(catat, { "7": { tingkat: "Siaga", ms: 1 }, "8": { tingkat: "Awas", ms: t0 } }, "id yang sudah tak aktif dibuang");

// ── Pesan ───────────────────────────────────────────────────────────────────
const konf = teksKonfirmasi({
  namaSite: "Kolam BPP", tingkat: "Siaga", mulai: "2026-11-16 13:20:00",
  oleh: "Andi", waktu: "2026-11-16 13:25:41", ews: "terkirim",
});
assert.match(konf, /^\*\[Dikonfirmasi\] Kolam BPP\*/);
assert.match(konf, /Alarm Siaga sejak 16 Nov 13:20 dikonfirmasi oleh Andi pukul 16 Nov 13:25/);
assert.match(konf, /level 0/);
assert.doesNotMatch(
  teksKonfirmasi({ namaSite: "X", tingkat: "Siaga", mulai: "", oleh: "A", waktu: "", ews: "tanpa-ews" }),
  /[Ss]irene dan lampu/,
  "site tanpa EWS tidak menyebut sirene dimatikan"
);
const ver = teksVerifikasi({
  namaSite: "Kolam BPP", tingkatPuncak: "Awas", mulai: "2026-11-16 13:20:00", hasil: "palsu",
  penyebab: "Prisma terhalang atau kotor", catatan: "tertutup daun", oleh: "Budi", waktu: "2026-11-16 15:02:00",
});
assert.match(ver, /PALSU — Prisma terhalang atau kotor/);
assert.match(ver, /Catatan: tertutup daun/);

console.log("aturan-kejadian.test.ts: semua lolos");
