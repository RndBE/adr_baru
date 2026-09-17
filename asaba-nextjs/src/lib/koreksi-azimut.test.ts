/**
 * Pemeriksaan perbaikan azimut koordinat RTS.
 * Jalankan: npx tsx src/lib/koreksi-azimut.test.ts
 *
 * Enam kasus di bawah bukan karangan: HA dan koordinat yang direkam diambil apa
 * adanya dari sesi acuan R0 `144500` (16 September 2026), dan koordinat
 * sasarannya dibaca dari "Peta Prisma Robotik BPP 1-4.pdf" — peta survei yang
 * dinyatakan benar di lapangan. Kalau angka orientasi di t_site diubah tanpa
 * alasan, baris-baris ini yang gagal lebih dulu.
 */
import { bacaSudut, perbaikiKoordinat, jarakGeser, tulisKoordinat, type KoreksiAzimut } from "./koreksi-azimut";

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

// ── Pembacaan sudut ─────────────────────────────────────────────────────────
dekat("\"289,03,70\" = 289,0370 gon", bacaSudut("289,03,70")!, 289.037, 1e-9);
dekat("\"100,32,96\"", bacaSudut("100,32,96")!, 100.3296, 1e-9);
cek("tembakan gagal \"000,00,00\" terbaca nol, bukan NaN", bacaSudut("000,00,00"), 0);
cek("kosong", bacaSudut(""), null);
cek("null", bacaSudut(null), null);
dekat("desimal biasa tetap terbaca", bacaSudut("123.45")!, 123.45, 1e-9);

// ── Site kolam_bpp ──────────────────────────────────────────────────────────
const K: KoreksiAzimut = {
  faktorDerajat: 0.9,        // HA dalam gon
  orientasiDeg: 302.352,     // dari t_site
  stasiunE: 464232.796,
  stasiunN: 9749253.947,
};

/** HA mentah, E/N yang DIREKAM alat, lalu E/N sebenarnya menurut peta survei. */
const lapangan: [string, string, number, number, number, number][] = [
  ["DF_1", "289,03,70", 464295.8202, 9749071.5416, 464154.8, 9749069.7],
  ["DF_2", "226,33,41", 463897.2439, 9748899.6720, 464505.9, 9748841.2],
  ["DF_3", "275,59,01", 464272.9401, 9748870.4219, 464163.6, 9748866.5],
  ["DF_4", "303,94,74", 464729.2067, 9748533.7744, 463704.3, 9748535.3],
  ["DF_5", "279,36,48", 464390.8057, 9748320.2425, 463997.2, 9748314.7],
  ["DF_7", "323,40,88", 465139.1519, 9748587.7131, 463315.3, 9748559.5],
];

console.log("\n── Koordinat hasil koreksi vs peta survei ──");
for (const [nama, ha, Erec, Nrec, Ebenar, Nbenar] of lapangan) {
  const baru = perbaikiKoordinat(Erec, Nrec, ha, K)!;
  const sisa = Math.hypot(baru.E - Ebenar, baru.N - Nbenar);
  const dulu = Math.hypot(Erec - Ebenar, Nrec - Nbenar);
  // Toleransi 30 m: ketidakpastian orientasi (±0,5°) ditambah ketelitian
  // membaca titik di PDF. Sebelum koreksi selisihnya 109–1.824 m.
  const ok = sisa < 30 && sisa < dulu / 4;
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${nama}: sisa ${sisa.toFixed(1)} m (sebelum koreksi ${dulu.toFixed(1)} m)`);
}

// ── Jarak dan elevasi TIDAK boleh berubah ───────────────────────────────────
console.log("\n── Jarak dari stasiun harus kekal ──");
for (const [nama, ha, Erec, Nrec] of lapangan) {
  const baru = perbaikiKoordinat(Erec, Nrec, ha, K)!;
  const jd = Math.hypot(Erec - K.stasiunE, Nrec - K.stasiunN);
  const jb = Math.hypot(baru.E - K.stasiunE, baru.N - K.stasiunN);
  dekat(`${nama} jarak tetap`, jb, jd, 1e-6);
}

// ── Tembakan yang tidak boleh disentuh ──────────────────────────────────────
console.log("\n── Yang harus dibiarkan apa adanya ──");
cek("koordinat nol (tembakan gagal)", perbaikiKoordinat(0, 0, "226,33,41", K), null);
cek("E nol saja", perbaikiKoordinat(0, 9748899.672, "226,33,41", K), null);
cek("HA tidak terbaca", perbaikiKoordinat(463897.2439, 9748899.672, "", K), null);
cek("NaN", perbaikiKoordinat(NaN, 9748899.672, "226,33,41", K), null);
cek("prisma tepat di atas alat", perbaikiKoordinat(K.stasiunE, K.stasiunN, "226,33,41", K), null);
cek("jarakGeser ikut null kalau tidak bisa dikoreksi", jarakGeser(0, 0, "226,33,41", K), null);

// ── Sifat matematis ─────────────────────────────────────────────────────────
console.log("\n── Sifat ──");
{
  // Koreksi dengan orientasi yang membalik kesalahan harus mengembalikan titik
  // ke tempatnya semula: bukti tidak ada pergeseran tersembunyi.
  const identitas: KoreksiAzimut = { ...K, faktorDerajat: 0, orientasiDeg: 0 };
  const p = perbaikiKoordinat(464232.796, 9749254.947, "226,33,41", identitas)!;
  dekat("orientasi 0° menaruh titik tepat di UTARA stasiun (E)", p.E, K.stasiunE, 1e-6);
  dekat("orientasi 0° menaruh titik tepat di UTARA stasiun (N)", p.N, K.stasiunN + 1, 1e-6);

  const q = perbaikiKoordinat(464232.796, 9749254.947, "100", { ...K, faktorDerajat: 0.9, orientasiDeg: 0 })!;
  dekat("HA 100 gon = 90° → tepat di TIMUR stasiun (E)", q.E, K.stasiunE + 1, 1e-6);
  dekat("HA 100 gon = 90° → tepat di TIMUR stasiun (N)", q.N, K.stasiunN, 1e-6);
}
cek("format koordinat 4 desimal", tulisKoordinat(464295.82019), "464295.8202");

console.log(gagal === 0 ? "\nSemua lolos." : `\n${gagal} pemeriksaan gagal.`);
process.exit(gagal === 0 ? 0 : 1);
