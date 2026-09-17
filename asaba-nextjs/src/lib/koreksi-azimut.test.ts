/**
 * Pemeriksaan penyusunan ulang koordinat tembakan RTS.
 * Jalankan: npx tsx src/lib/koreksi-azimut.test.ts
 *
 * Angka di bawah bukan karangan, dan sengaja datang dari TIGA sumber yang
 * saling berdiri sendiri:
 *
 *   - HA/VA/SD diambil apa adanya dari sesi acuan R0 `144500` (16 Sep 2026).
 *   - Posisi mendatar sasarannya dari peta survei "Peta Prisma Robotik
 *     BPP 1-4.pdf", yang dinyatakan benar di lapangan.
 *   - Elevasi sasarannya dari kontur "Situasi_BPP_260731.dxf" — survei
 *     topografi yang tidak ada hubungannya dengan peta itu maupun dengan alat.
 *
 * Kalau parameter di t_site diubah tanpa alasan, baris-baris ini yang gagal
 * lebih dulu — dan gagalnya terhadap lapangan, bukan terhadap dirinya sendiri.
 */
import {
  bacaSudut,
  sudutKosong,
  perbaikiTembakan,
  tulisKoordinat,
  type KoreksiAzimut,
} from "./koreksi-azimut";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`);
}
function dekat(judul: string, dapat: number, harus: number, toleransi: number) {
  const ok = Math.abs(dapat - harus) <= toleransi;
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${dapat}\n      harus ${harus} (±${toleransi})`}`);
}
function benar(judul: string, syarat: boolean, ket = "") {
  if (!syarat) gagal++;
  console.log(`${syarat ? "ok  " : "GAGAL"} ${judul}${syarat ? "" : `\n      ${ket}`}`);
}

// ── Pembacaan sudut ─────────────────────────────────────────────────────────
dekat('"289,03,70" = 289,0370 gon', bacaSudut("289,03,70")!, 289.037, 1e-9);
dekat('"100,32,96"', bacaSudut("100,32,96")!, 100.3296, 1e-9);
dekat("desimal biasa tetap terbaca", bacaSudut("123.45")!, 123.45, 1e-9);
cek("kosong", bacaSudut(""), null);
cek("null", bacaSudut(null), null);

// Nol berarti TIDAK DILAPORKAN, bukan sudut nol. Sekitar 3% baris kolam_bpp
// berbentuk begitu — salinan tembakan yang dikirim ulang tanpa sudutnya.
// Membacanya sebagai sudut sungguhan pernah memindahkan DF_7 sejauh 1.297 m.
cek('sudutKosong: "0"', sudutKosong("0"), true);
cek('sudutKosong: "000,00,00"', sudutKosong("000,00,00"), true);
cek("sudutKosong: kosong", sudutKosong(""), true);
cek("sudutKosong: sudut sah", sudutKosong("226,33,41"), false);

// ── Site kolam_bpp ──────────────────────────────────────────────────────────
const K: KoreksiAzimut = {
  faktorDerajat: 0.9, // HA dan VA sama-sama gon
  orientasiDeg: 302.351, // t_site.ha_orientasi_deg
  stasiunE: 464232.796,
  stasiunN: 9749253.947,
  stasiunZ: 38.813,
  tinggiAlat: 0, // rts_z SUDAH elevasi alatnya — lihat catatan di sites.ts
};

/** HA, VA, SD terukur → posisi menurut peta survei, elevasi tanah menurut kontur. */
const lapangan: [string, string, string, number, number, number, number][] = [
  ["DF_1", "289,03,70", "101,78,63", 197.5313, 464154.8, 9749069.7, 33.9],
  ["DF_2", "226,33,41", "100,32,96", 496.363, 464505.9, 9748841.2, 36.6],
  ["DF_3", "275,59,01", "100,54,67", 392.7259, 464163.6, 9748866.5, 35.9],
  ["DF_4", "303,94,74", "100,76,44", 891.9004, 463704.3, 9748535.3, 26.3],
  ["DF_5", "279,36,48", "100,83,70", 966.0381, 463997.2, 9748314.7, 25.2],
  ["DF_7", "323,40,88", "100,80,15", 1147.2527, 463315.3, 9748559.5, 25.0],
];

console.log("\n── Posisi mendatar vs peta survei ──");
for (const [nama, ha, va, sd, Ebenar, Nbenar] of lapangan) {
  const t = perbaikiTembakan(ha, va, sd, K)!;
  const sisa = Math.hypot(t.E - Ebenar, t.N - Nbenar);
  // 15 m: ketidakpastian orientasi (±0,5°) ditambah ketelitian membaca titik
  // di PDF. Koordinat kiriman alat meleset 109–1.824 m.
  benar(`${nama}: ${sisa.toFixed(1)} m dari peta survei`, sisa < 15);
}

console.log("\n── Elevasi vs kontur DXF ──");
for (const [nama, ha, va, sd, , , tanah] of lapangan) {
  const t = perbaikiTembakan(ha, va, sd, K)!;
  const beda = t.Z - tanah;
  // Prisma dipasang di TIANG, jadi harus sedikit DI ATAS tanah — bukan di
  // bawahnya, dan bukan belasan meter di atasnya. Arah simpangan ini yang
  // membedakan hitungan yang benar dari yang kebetulan dekat.
  // ±2 m: kontur berinterval 1 m dan elevasi tanahnya saya interpolasi dari
  // simpul terdekat, jadi permukaan acuannya sendiri tidak lebih teliti dari
  // itu. Yang dijaga di sini bukan ketelitian sentimeter, melainkan bahwa
  // prisma duduk DI PERMUKAAN — bukan 200 m di bawahnya seperti angka kiriman
  // alat, dan bukan 10 m mengambang seperti kalau config_adr.ts_high ikut
  // ditambahkan.
  benar(
    `${nama}: Z ${t.Z.toFixed(1)} m, tanah ${tanah.toFixed(1)} m → ${beda >= 0 ? "+" : ""}${beda.toFixed(1)} m`,
    Math.abs(beda) <= 2,
    "prisma harus duduk di permukaan tanah"
  );
}

// ── Satuan gon, bukan derajat ───────────────────────────────────────────────
console.log("\n── Kalau VA dibaca sebagai derajat (kesalahan aslinya) ──");
{
  const salah: KoreksiAzimut = { ...K, faktorDerajat: 1 };
  const t = perbaikiTembakan("323,40,88", "100,80,15", 1147.2527, salah)!;
  // Elevasi seluruh area ini 11–43 m menurut kontur. VA sebagai derajat
  // menaruh DF_7 di sekitar −176 m — bukan sekadar meleset, tapi mustahil.
  benar(
    `VA sebagai derajat menaruh DF_7 di ${t.Z.toFixed(0)} m — di luar 11–43 m`,
    t.Z < 0,
    "kalau ini tidak lagi di bawah nol, ada yang berubah pada rumusnya"
  );
}

// ── Geometri dasar ──────────────────────────────────────────────────────────
console.log("\n── Geometri ──");
{
  const lurus: KoreksiAzimut = { ...K, orientasiDeg: 0, tinggiAlat: 0 };
  // VA 100 gon = 90° = mendatar: seluruh jarak miring jadi jarak mendatar.
  const a = perbaikiTembakan("0,00,01", "100,00,00", 100, lurus)!;
  dekat("VA 100 gon mendatar: Z sama dengan stasiun", a.Z, K.stasiunZ, 1e-6);
  // HA ~0 → tepat ke UTARA.
  dekat("HA ~0 → utara, E tidak bergerak", a.E, K.stasiunE, 0.02);
  dekat("HA ~0 → utara, N maju sejauh SD", a.N, K.stasiunN + 100, 1e-3);

  // HA 100 gon = 90° → tepat ke TIMUR.
  const b = perbaikiTembakan("100,00,00", "100,00,00", 100, lurus)!;
  dekat("HA 100 gon → timur, E maju sejauh SD", b.E, K.stasiunE + 100, 1e-3);
  dekat("HA 100 gon → timur, N tidak bergerak", b.N, K.stasiunN, 1e-3);

  // VA di bawah 100 gon = di ATAS mendatar.
  const naik = perbaikiTembakan("0,00,01", "50,00,00", 100, lurus)!;
  benar("VA 50 gon (45° ke atas) menaikkan Z", naik.Z > K.stasiunZ);
  dekat("VA 50 gon: beda tinggi = SD·cos45°", naik.Z - K.stasiunZ, 100 * Math.SQRT1_2, 1e-6);

  // Tinggi alat menggeser Z, tidak menyentuh E/N.
  const tinggi = perbaikiTembakan("0,00,01", "100,00,00", 100, { ...lurus, tinggiAlat: 1.5 })!;
  dekat("tinggi alat menaikkan Z sebesar itu", tinggi.Z - a.Z, 1.5, 1e-9);
  dekat("tinggi alat tidak menyentuh E", tinggi.E, a.E, 1e-9);
}

// ── Yang harus dibiarkan apa adanya ─────────────────────────────────────────
console.log("\n── Tembakan yang tidak bisa dihitung ──");
cek("HA tidak dilaporkan", perbaikiTembakan("0", "100,32,96", 496.363, K), null);
cek("VA tidak dilaporkan", perbaikiTembakan("226,33,41", "0", 496.363, K), null);
cek("keduanya kosong", perbaikiTembakan("000,00,00", "000,00,00", 496.363, K), null);
cek("SD nol", perbaikiTembakan("226,33,41", "100,32,96", 0, K), null);
cek("SD negatif", perbaikiTembakan("226,33,41", "100,32,96", -5, K), null);
cek("SD bukan angka", perbaikiTembakan("226,33,41", "100,32,96", "abc", K), null);

cek("format koordinat 4 desimal", tulisKoordinat(464295.82019), "464295.8202");

console.log(gagal === 0 ? "\nSemua lolos." : `\n${gagal} pemeriksaan gagal.`);
process.exit(gagal === 0 ? 0 : 1);
