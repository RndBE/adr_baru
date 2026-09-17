/**
 * Pemeriksaan sumbu riwayat prisma: N tetap N, E tetap E.
 * Jalankan: npx tsx src/components/monitoring/prism-history.test.ts
 *
 * Angka di bawah disalin apa adanya dari baris `rts` prisma P2 (DF_2) site
 * kolam_bpp: acuan R0 sesi 144500 tanggal 16 September 2026, dan pembacaan
 * pukul 19:00 tanggal 17 September 2026 — baris yang dilaporkan operator
 * karena halaman detailnya menyebut pergeseran 13.130.028.523,37 mm.
 *
 * Penyebabnya bukan hitungan, melainkan pemasangan sumbu. /api/analisa
 * melayani satu kolom sensor per permintaan, dan sensor8 di tabel `rts`
 * berisi EASTING meski namanya terbaca seperti Northing. Ketika sensor8
 * diserahkan sebagai deret Northing sementara acuan R0 (dari /api/deformasi)
 * sudah memakai pembacaan yang benar, tiap titik dikurangi sumbu seberangnya:
 *
 *     dx = Northing − Easting = 9.748.842 − 464.510 ≈ +9.284.332 m
 *     dy = Easting − Northing               ≈ −9.284.332 m
 *     hipotenusanya ≈ 13.130.028 m
 *
 * Besarannya begitu jauh dari masuk akal sampai tidak terbaca sebagai sumbu
 * tertukar — ia terbaca sebagai alat rusak. Karena itu dikunci di sini.
 */
import { gabungSumbu, type AcuanR0, type BarisAnalisa } from "./prism-history";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`);
}

/** Acuan R0 DF_2 — mentah, apa adanya dari raw_E0/raw_N0/Z0. */
const R0: AcuanR0 = { e: 464509.9836, n: 9748842.1987, z: 36.2432 };

const W = "2026-09-17 19:00:00";
const seri = (nilai: number): BarisAnalisa[] => [{ waktu: W, nilai }];

// Satu pembacaan DF_2 pukul 19:00 — panel atas halaman menyebut
// E +62,30 mm, N +44,20 mm, Z −235,50 mm untuk baris yang sama.
const SENSOR8 = 464510.0459; // Easting
const SENSOR9 = 9748842.2429; // Northing
const SENSOR10 = 36.0077;

// ── Sumbu dipasang benar ────────────────────────────────────────────────────
{
  const { titik } = gabungSumbu(
    { n: seri(SENSOR9), e: seri(SENSOR8), z: seri(SENSOR10) },
    R0
  );
  cek("satu titik terbentuk", titik.length, 1);
  const p = titik[0];
  cek("Northing utuh, bukan Easting", p.n, SENSOR9);
  cek("Easting utuh, bukan Northing", p.e, SENSOR8);
  cek("ΔE ≈ +62,30 mm", Math.round(p.dxMm * 100) / 100, 62.3);
  cek("ΔN ≈ +44,20 mm", Math.round(p.dyMm * 100) / 100, 44.2);
  cek("ΔZ ≈ −235,50 mm", Math.round(p.dzMm * 100) / 100, -235.5);
  // hypot(62,30; 44,20) = 76,4 — sepadan dengan yang dilaporkan
  // Pengukuran Harian dan Analisa Gabungan untuk prisma yang sama.
  cek("pergeseran ≈ 76 mm", Math.round(p.geserMm), 76);
  cek("pergeseran masih di bawah satu meter", p.geserMm < 1000, true);
}

// ── Sumbu tertukar: bentuk persis keluhan operator ──────────────────────────
{
  // Sengaja dipasang terbalik untuk membuktikan bahwa inilah yang dulu
  // terjadi — bukan supaya dipertahankan.
  const { titik } = gabungSumbu(
    { n: seri(SENSOR8), e: seri(SENSOR9), z: seri(SENSOR10) },
    R0
  );
  cek(
    "sumbu tertukar memang menghasilkan 13.130.028.523 mm",
    Math.round(titik[0].geserMm * 100) / 100,
    13130028523.37
  );
}

// ── Baris tembakan gagal dibuang ────────────────────────────────────────────
{
  const { titik } = gabungSumbu({ n: seri(0), e: seri(0), z: seri(0) }, R0);
  cek("ketiga sumbu nol: titik dibuang", titik.length, 0);
}

// ── Sumbu yang tidak lengkap dibuang ────────────────────────────────────────
{
  const { titik } = gabungSumbu(
    { n: seri(SENSOR9), e: [{ waktu: "2026-09-17 18:00:00", nilai: SENSOR8 }], z: seri(SENSOR10) },
    R0
  );
  cek("stempel Easting tidak cocok: titik dibuang", titik.length, 0);
}

// ── Tembakan sebelum R0 dihitung, bukan digambar ────────────────────────────
{
  const r0Ms = Date.parse("2026-09-16T00:00:00Z");
  const { titik, sebelumR0 } = gabungSumbu(
    {
      n: [{ waktu: "2026-09-15 08:00:00", nilai: SENSOR9 }, { waktu: W, nilai: SENSOR9 }],
      e: [{ waktu: "2026-09-15 08:00:00", nilai: SENSOR8 }, { waktu: W, nilai: SENSOR8 }],
      z: [{ waktu: "2026-09-15 08:00:00", nilai: SENSOR10 }, { waktu: W, nilai: SENSOR10 }],
    },
    R0,
    r0Ms
  );
  cek("tembakan pra-R0 tidak masuk grafik", titik.length, 1);
  cek("tapi jumlahnya dilaporkan", sebelumR0, 1);
}

console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
