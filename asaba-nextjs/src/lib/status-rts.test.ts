/**
 * Pemeriksaan rumus status. Jalankan: npx tsx src/lib/status-rts.test.ts
 *
 * Ada karena rumus inilah yang dulu ditulis ulang di dua tempat dan membuat
 * Beranda, Kontrol ADR, dan Prism Config saling membantah untuk perangkat yang
 * sama. Kasus pertama di bawah adalah keadaan nyata yang memicu keluhan itu.
 */
import { hitungStatusRts, BATAS_DATA_SEGAR_MS } from "./status-rts";

const SEKARANG = new Date("2026-09-11T19:30:00+07:00").getTime();
const baru = "2026-09-11 19:27:00";
const basi = "2026-09-11 17:00:00";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`);
}

// Keadaan nyata di produksi 2026-09-11: logger mengirim, instrumen mati.
const a = hitungStatusRts(baru, 0, 0, SEKARANG);
cek("logger kirim + instrumen mati -> logger terhubung", a.loggerTerhubung, true);
cek("logger kirim + instrumen mati -> rts tidak aktif", a.rtsAktif, false);
cek("logger kirim + instrumen mati -> label", a.labelRts, "Tidak aktif");

const b = hitungStatusRts(baru, 1, 0, SEKARANG);
cek("instrumen menyala -> aktif", b.rtsAktif, true);
cek("instrumen menyala -> label", b.labelRts, "Menyala, siap");

const c = hitungStatusRts(baru, 1, 1, SEKARANG);
cek("sedang mengukur -> label", c.labelRts, "Sedang mengukur");

// Data basi: sensor14 lama TIDAK boleh terbaca sebagai instrumen menyala kini.
const d = hitungStatusRts(basi, 1, 1, SEKARANG);
cek("data basi -> logger terputus", d.loggerTerhubung, false);
cek("data basi -> rts tidak aktif walau sensor14=1", d.rtsAktif, false);
cek("data basi -> label", d.labelRts, "Tidak aktif");

// Batas kesegaran. Waktu di DB adalah jam dinding WIB, jadi patokannya ditulis
// sebagai jam dinding juga — SEKARANG pukul 19:30 WIB, batasnya pukul 18:30.
cek("tepat di batas -> masih segar",
  hitungStatusRts("2026-09-11 18:30:00", 1, 0, SEKARANG).loggerTerhubung, true);
cek("semenit lewat batas -> terputus",
  hitungStatusRts("2026-09-11 18:29:00", 1, 0, SEKARANG).loggerTerhubung, false);
cek("batasnya satu jam", BATAS_DATA_SEGAR_MS, 60 * 60 * 1000);

// Kolom kosong bukan "mati yang meyakinkan".
const f = hitungStatusRts(null, "", "", SEKARANG);
cek("tanpa waktu -> terputus", f.loggerTerhubung, false);
cek("sensor kosong -> tidak menyala", f.rtsMenyala, false);

// Sensor datang sebagai string dari satu jalur, angka dari jalur lain.
cek("sensor string \"1\" sama dengan angka 1",
  hitungStatusRts(baru, "1", "0", SEKARANG).labelRts,
  hitungStatusRts(baru, 1, 0, SEKARANG).labelRts);

console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
