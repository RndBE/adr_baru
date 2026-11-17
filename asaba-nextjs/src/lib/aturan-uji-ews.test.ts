/**
 * Kunci aturan uji EWS. Jalankan: npx tsx src/lib/aturan-uji-ews.test.ts
 */
import assert from "node:assert/strict";
import {
  DURASI_UJI_BAWAAN,
  DURASI_UJI_MAKS,
  DURASI_UJI_MIN,
  perluMatikanUji,
  validasiUji,
} from "@/lib/aturan-uji-ews";

// ── validasiUji ─────────────────────────────────────────────────────────────
assert.equal(validasiUji(null).ok, false);
assert.equal(validasiUji({}).ok, false, "site wajib");
assert.equal(validasiUji({ site: "  ", tingkat: "Awas" }).ok, false, "site kosong");
assert.equal(validasiUji({ site: "x".repeat(51), tingkat: "Awas" }).ok, false, "site terlalu panjang");
assert.equal(validasiUji({ site: "kolam_bpp" }).ok, false, "tingkat wajib");
assert.equal(validasiUji({ site: "kolam_bpp", tingkat: "Bahaya" }).ok, false, "tingkat ngawur");
assert.deepEqual(validasiUji({ site: " kolam_bpp ", tingkat: "Awas", detik: 60 }), {
  ok: true, site: "kolam_bpp", tingkat: "Awas", detik: 60,
});
assert.deepEqual(validasiUji({ site: "kolam_bpp", tingkat: "Waspada" }), {
  ok: true, site: "kolam_bpp", tingkat: "Waspada", detik: DURASI_UJI_BAWAAN,
}, "durasi kosong = bawaan");
assert.deepEqual(validasiUji({ site: "kolam_bpp", tingkat: "Siaga", detik: "30" }), {
  ok: true, site: "kolam_bpp", tingkat: "Siaga", detik: 30,
}, "angka dalam teks diterima");
assert.equal(validasiUji({ site: "kolam_bpp", tingkat: "Awas", detik: DURASI_UJI_MIN - 1 }).ok, false, "terlalu singkat");
assert.equal(validasiUji({ site: "kolam_bpp", tingkat: "Awas", detik: DURASI_UJI_MAKS + 1 }).ok, false, "terlalu lama");
assert.equal(validasiUji({ site: "kolam_bpp", tingkat: "Awas", detik: 12.5 }).ok, false, "bukan bilangan bulat");
assert.equal(validasiUji({ site: "kolam_bpp", tingkat: "Awas", detik: "lama" }).ok, false);
assert.deepEqual(validasiUji({ site: "kolam_bpp", tingkat: "Normal", detik: 9999 }), {
  ok: true, site: "kolam_bpp", tingkat: "Normal", detik: 0,
}, "matikan: durasi diabaikan");

// ── perluMatikanUji ─────────────────────────────────────────────────────────
assert.equal(perluMatikanUji({ tingkatTerkirim: "Awas", levelUji: "Awas", adaKejadianAktif: false }), true);
assert.equal(
  perluMatikanUji({ tingkatTerkirim: "Awas", levelUji: "Awas", adaKejadianAktif: true }),
  false,
  "alarm sungguhan aktif: jangan dibungkam"
);
assert.equal(
  perluMatikanUji({ tingkatTerkirim: "Siaga", levelUji: "Awas", adaKejadianAktif: false }),
  false,
  "perangkat sudah di level lain (uji baru atau siklus menimpanya)"
);
assert.equal(perluMatikanUji({ tingkatTerkirim: "Normal", levelUji: "Awas", adaKejadianAktif: false }), false, "sudah mati");
assert.equal(perluMatikanUji({ tingkatTerkirim: null, levelUji: "Awas", adaKejadianAktif: false }), false, "tak ada catatan");
assert.equal(perluMatikanUji({ tingkatTerkirim: "ngawur", levelUji: "Awas", adaKejadianAktif: false }), false);

console.log("aturan-uji-ews.test.ts: semua lolos");
