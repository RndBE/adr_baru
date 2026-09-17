/**
 * Pemeriksaan arah panah pergeseran di peta.
 * Jalankan: npx tsx src/components/peta-arah.test.ts
 *
 * Panah yang menunjuk ke arah yang salah tidak terlihat seperti kerusakan —
 * ia terlihat seperti prisma yang bergerak ke arah lain, dan tidak ada di
 * layar yang bisa dipakai pembacanya untuk curiga. Tiga hal yang dikunci:
 *
 *   1. Sudutnya IDENTIK dengan arah8ID(), yang menghasilkan teks arah di popup
 *      dan di tabel. Panah dan tulisan tidak boleh pernah berselisih.
 *   2. Sumbu y layar tumbuh ke bawah, utara ke atas — pembalikan tandanya cuma
 *      di geserPiksel().
 *   3. Pergeseran sekecil apa pun tetap menghasilkan arah. Ini bug yang
 *      sebenarnya: versi lama menghitung arah di ruang piksel yang dibulatkan
 *      Leaflet, jadi pergeseran milimeter selalu jadi vektor nol dan panahnya
 *      tidak pernah tergambar.
 */
import { arahGeser, geserPiksel } from "./peta-arah";
import { arah8ID } from "@/lib/coordinates";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`);
}
function dekat(judul: string, dapat: number, harus: number, toleransi = 1e-9) {
  const ok = Math.abs(dapat - harus) <= toleransi;
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${dapat}\n      harus ${harus}`}`);
}

// ── Mata angin ──────────────────────────────────────────────────────────────
dekat("utara  = 0°",   arahGeser(0, 1)!.sudut, 0);
dekat("timur  = 90°",  arahGeser(1, 0)!.sudut, 90);
dekat("selatan= 180°", arahGeser(0, -1)!.sudut, 180);
dekat("barat  = 270°", arahGeser(-1, 0)!.sudut, 270);
dekat("timur laut = 45°", arahGeser(1, 1)!.sudut, 45);

// ── Sudut panah = bearing teks ──────────────────────────────────────────────
// Kalau salah satunya diubah tanpa yang lain, baris ini gagal.
for (const [de, dn] of [
  [0.0199, 0.045], [0.0643, -0.0757], [-0.0899, -0.3758], [0.0128, 0.0341],
  [-1, 2], [3, -4], [-5, -6],
] as [number, number][]) {
  dekat(
    `sudut panah = bearing arah8ID untuk DE=${de} DN=${dn}`,
    arahGeser(de, dn)!.sudut,
    arah8ID(de, dn).bearing,
    1e-9
  );
}

// ── Pergeseran milimeter tetap punya arah ───────────────────────────────────
// Inilah yang dulu hilang: 36 mm pada zoom 16 = 0,015 piksel.
{
  const a = arahGeser(0.0128, 0.0341);
  cek("pergeseran 36 mm tetap menghasilkan arah", a !== null, true);
  dekat("besarnya dilaporkan dalam mm", a!.mm, Math.hypot(0.0128, 0.0341) * 1000, 1e-9);
  dekat("vektornya satuan", Math.hypot(a!.ux, a!.uy), 1, 1e-12);
}
// Sampai sepersejuta milimeter pun arahnya masih terdefinisi.
cek("1 nanometer masih punya arah", arahGeser(1e-9, 1e-9) !== null, true);

// ── Yang memang bukan arah ──────────────────────────────────────────────────
cek("diam sempurna: tidak ada arah", arahGeser(0, 0), null);
cek("DE null", arahGeser(null, 1), null);
cek("DN null", arahGeser(1, null), null);
cek("NaN", arahGeser(NaN, 1), null);

// ── Sumbu layar ─────────────────────────────────────────────────────────────
{
  // y layar tumbuh KE BAWAH. Pergeseran ke utara harus MENGURANGI y.
  const utara = geserPiksel(100, 100, arahGeser(0, 1)!, 10);
  cek("ke utara: y berkurang (naik di layar)", utara, { x: 100, y: 90 });

  const timur = geserPiksel(100, 100, arahGeser(1, 0)!, 10);
  cek("ke timur: x bertambah", timur, { x: 110, y: 100 });

  const selatan = geserPiksel(100, 100, arahGeser(0, -1)!, 10);
  cek("ke selatan: y bertambah (turun di layar)", selatan, { x: 100, y: 110 });

  // Jarak layar harus persis seperti diminta, berapa pun besar pergeserannya —
  // panah ini menyatakan ARAH, panjangnya tidak mewakili besaran.
  for (const [de, dn] of [[0.0128, 0.0341], [-0.0899, -0.3758], [1000, -2000]] as [number, number][]) {
    const g = geserPiksel(0, 0, arahGeser(de, dn)!, 62);
    dekat(`panjang layar tetap 62 px (DE=${de} DN=${dn})`, Math.hypot(g.x, g.y), 62, 1e-9);
  }
}

console.log(gagal === 0 ? "\nSemua lolos." : `\n${gagal} pemeriksaan gagal.`);
process.exit(gagal === 0 ? 0 : 1);
