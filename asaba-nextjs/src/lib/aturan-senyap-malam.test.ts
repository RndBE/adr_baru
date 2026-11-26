/**
 * Bunyi alarm dimatikan otomatis pada jam malam.
 * Jalankan: npx tsx src/lib/aturan-senyap-malam.test.ts
 */
import assert from "node:assert/strict";
import {
  dalamJamMalam,
  jamKeMenit,
  menitHari,
  perluBungkamMalam,
  SENYAP_MALAM_BAWAAN,
  teksBungkamMalam,
  tingkatTersenyap,
  validasiSenyapMalam,
  type KejadianBerbunyi,
  type SenyapMalam,
} from "./aturan-senyap-malam";

assert.equal(jamKeMenit("22:00"), 1320);
assert.equal(jamKeMenit("05:30"), 330);
assert.equal(jamKeMenit("24:00"), null);
assert.equal(jamKeMenit("7:00"), null, "harus dua digit");
assert.equal(menitHari(Date.UTC(2026, 10, 26, 22, 47)), 22 * 60 + 47);

// Melewati tengah malam 22:00–05:00.
const jam = (h: number, m = 0) => h * 60 + m;
assert.equal(dalamJamMalam(jam(21, 59), "22:00", "05:00"), false);
assert.equal(dalamJamMalam(jam(22, 0), "22:00", "05:00"), true);
assert.equal(dalamJamMalam(jam(2, 30), "22:00", "05:00"), true);
assert.equal(dalamJamMalam(jam(4, 59), "22:00", "05:00"), true);
assert.equal(dalamJamMalam(jam(5, 0), "22:00", "05:00"), false, "jam selesai sudah di luar");
assert.equal(dalamJamMalam(jam(12, 0), "22:00", "05:00"), false);
// Bawaan sejak 26 Nov 2026: 17:00–08:00.
assert.equal(dalamJamMalam(jam(16, 59), "17:00", "08:00"), false);
assert.equal(dalamJamMalam(jam(17, 0), "17:00", "08:00"), true);
assert.equal(dalamJamMalam(jam(7, 59), "17:00", "08:00"), true);
assert.equal(dalamJamMalam(jam(8, 0), "17:00", "08:00"), false);
assert.equal(dalamJamMalam(jam(12, 0), "17:00", "08:00"), false);
// Tidak melewati tengah malam.
assert.equal(dalamJamMalam(jam(1, 0), "00:00", "04:00"), true);
assert.equal(dalamJamMalam(jam(23, 0), "00:00", "04:00"), false);
assert.equal(dalamJamMalam(jam(10, 0), "10:00", "10:00"), false, "mulai = selesai: tidak pernah");

assert.equal(validasiSenyapMalam({ aktif: true, mulai: "22:00", selesai: "05:00", menit: 10 }), null);
assert.match(validasiSenyapMalam({ aktif: true, mulai: "22.00", selesai: "05:00", menit: 10 }) ?? "", /HH:MM/);
assert.match(validasiSenyapMalam({ aktif: true, mulai: "22:00", selesai: "22:00", menit: 10 }) ?? "", /tidak boleh sama/);
assert.match(validasiSenyapMalam({ aktif: true, mulai: "22:00", selesai: "05:00", menit: 0 }) ?? "", /1–120/);

// ── Kapan dibungkam ──────────────────────────────────────────────────────────
const s: SenyapMalam = { aktif: true, mulai: "22:00", selesai: "05:00", menit: 10 };
const t = (h: number, m: number) => Date.UTC(2026, 10, 26, h, m);
const k: KejadianBerbunyi = {
  aktif: true, tingkatTerakhir: "Awas", dikonfirmasi: false, dibungkam: false, berbunyiSejakMs: t(22, 37),
};
assert.equal(perluBungkamMalam(k, s, t(22, 46)), false, "baru 9 menit");
assert.equal(perluBungkamMalam(k, s, t(22, 47)), true, "10 menit tanpa konfirmasi");
assert.equal(perluBungkamMalam({ ...k, berbunyiSejakMs: t(21, 50) }, s, t(21, 59)), false, "belum jam malam");
assert.equal(perluBungkamMalam({ ...k, berbunyiSejakMs: t(21, 50) }, s, t(22, 0)), true, "berbunyi sejak sore, jam malam mulai");
assert.equal(perluBungkamMalam(k, { ...s, aktif: false }, t(23, 0)), false, "site tidak memakai senyap malam");
assert.equal(perluBungkamMalam({ ...k, dikonfirmasi: true }, s, t(23, 0)), false, "sudah dikonfirmasi");
assert.equal(perluBungkamMalam({ ...k, dibungkam: true }, s, t(23, 0)), false, "sudah dibungkam");
assert.equal(perluBungkamMalam({ ...k, aktif: false }, s, t(23, 0)), false, "sudah pulih");
assert.equal(perluBungkamMalam({ ...k, tingkatTerakhir: "Normal" }, s, t(23, 0)), false);
assert.equal(
  perluBungkamMalam({ ...k, berbunyiSejakMs: Date.UTC(2026, 10, 27, 4, 50) }, s, Date.UTC(2026, 10, 27, 5, 1)),
  false,
  "jam malam sudah lewat saat 10 menitnya tercapai"
);

// ── Tingkat yang tidak dibunyikan ────────────────────────────────────────────
assert.equal(tingkatTersenyap({ tingkatDikonfirmasi: "Siaga", tingkatDibungkam: "Awas" }), "Siaga", "konfirmasi didahulukan");
assert.equal(tingkatTersenyap({ tingkatDikonfirmasi: null, tingkatDibungkam: "Awas" }), "Awas");
assert.equal(tingkatTersenyap({ tingkatDikonfirmasi: null, tingkatDibungkam: null }), null);

// ── Pesan ───────────────────────────────────────────────────────────────────
const teks = teksBungkamMalam({
  namaSite: "Kolam BPP 1-4", tingkat: "Awas", mulai: "2026-11-26 22:37:00", waktu: "2026-11-26 22:47:00", menit: 10, ews: "terkirim",
});
assert.match(teks, /^\*\[Bunyi dimatikan otomatis\] Kolam BPP 1-4\*/);
assert.match(teks, /belum dikonfirmasi selama 10 menit\./);
assert.doesNotMatch(teks, /jam malam/, "rentangnya bisa sore sampai pagi");
assert.match(teks, /MENUNGGU KONFIRMASI/);
assert.doesNotMatch(
  teksBungkamMalam({ namaSite: "X", tingkat: "Awas", mulai: "", waktu: "", menit: 10, ews: "tanpa-ews" }),
  /Sirene dan lampu/
);

assert.deepEqual(SENYAP_MALAM_BAWAAN, { aktif: false, mulai: "17:00", selesai: "08:00", menit: 10 });

console.log("aturan-senyap-malam.test.ts: semua lolos");
