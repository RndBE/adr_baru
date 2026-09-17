/**
 * Pemeriksaan georeferensi jaring base map.
 * Jalankan: npx tsx src/components/visualisasi-3d/basemap.test.ts
 *
 * Yang dijaga di sini cuma satu hal, tapi hal itu menentukan segalanya: piksel
 * mana mendarat di koordinat UTM mana. Ortofoto yang melenceng tidak terlihat
 * seperti kesalahan — ia terlihat seperti prisma yang duduk di tanggul lain,
 * dan pembacanya tidak punya cara tahu mana yang keliru.
 *
 * Dua jebakan yang sudah diperiksa di bawah:
 *
 *   1. Baris 0 citra adalah tepi UTARA, jadi Northing MENURUN seiring nomor
 *      baris. Membalikkannya membuat ortofoto tercermin utara-selatan —
 *      kesalahan yang tetap terlihat "masuk akal" pada foto tambang.
 *   2. Titik jaring duduk di TENGAH selnya, bukan di tepi kotak.
 */
import { bangunJaring, sampelDem, terapkanGeser, ukuranPetak, type PetakCitra, type PetakDem, type KotakUtm } from "./basemap";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(
    `${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`
  );
}
/** Math.min(...array) meledak di atas ~120 rb elemen; jaring nyata jauh di atas itu. */
function rentang(a: number[]) {
  let min = Infinity;
  let max = -Infinity;
  for (const v of a) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

function benar(judul: string, syarat: boolean) {
  if (!syarat) gagal++;
  console.log(`${syarat ? "ok  " : "GAGAL"} ${judul}`);
}

function dekat(judul: string, dapat: number, harus: number, toleransi = 1e-6) {
  const ok = Math.abs(dapat - harus) <= toleransi;
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${dapat}\n      harus ${harus}`}`);
}

/** Kotak bulat supaya angka harapannya bisa dihitung di kepala. */
const KOTAK: KotakUtm = { minE: 1000, maxE: 1400, minN: 5000, maxN: 5200 };

function petak(nx: number, ny: number, warna: (c: number, r: number) => [number, number, number], topeng?: Uint8Array): PetakCitra {
  const rgba = new Uint8ClampedArray(nx * ny * 4);
  for (let r = 0; r < ny; r++) {
    for (let c = 0; c < nx; c++) {
      const [R, G, B] = warna(c, r);
      const p = (r * nx + c) * 4;
      rgba[p] = R;
      rgba[p + 1] = G;
      rgba[p + 2] = B;
      rgba[p + 3] = 255;
    }
  }
  return { nx, ny, rgba, topeng: topeng ?? null };
}

// ── Ukuran petak ────────────────────────────────────────────────────────────
// Sisi terpanjang dapat `kerapatan` sel; sisi pendek mengikuti rasio kotak.
cek("kotak lebar: kerapatan jatuh ke sumbu E", ukuranPetak(KOTAK, 100), { nx: 100, ny: 50 });
cek(
  "kotak tinggi: kerapatan jatuh ke sumbu N",
  ukuranPetak({ minE: 0, maxE: 100, minN: 0, maxN: 400 }, 80),
  { nx: 20, ny: 80 }
);
// Kotak sangat memanjang tidak boleh menghasilkan sisi 0 atau 1 — mesh dengan
// satu baris titik tidak punya satu pun segitiga, dan base map-nya hilang diam-diam.
cek("sisi pendek tidak pernah di bawah 2", ukuranPetak({ minE: 0, maxE: 10000, minN: 0, maxN: 5 }, 10), {
  nx: 10,
  ny: 2,
});

// ── Penempatan titik ────────────────────────────────────────────────────────
{
  const j = bangunJaring(petak(2, 2, () => [10, 20, 30]), KOTAK, -7);

  cek("semua titik terpakai", j.x.length, 4);
  cek("dua segitiga per sel; 2x2 titik = satu sel", j.i.length, 2);

  // Sel 0 membentang E 1000–1200, jadi tengahnya 1100. Bukan 1000.
  dekat("titik pertama di TENGAH sel, bukan di tepi kotak (E)", j.x[0], 1100);
  // Baris 0 = tepi utara. Sel baris 0 membentang N 5200–5100, tengahnya 5150.
  dekat("baris 0 dekat tepi UTARA", j.y[0], 5150);

  // Titik terakhir: kolom 1, baris 1 → E 1300, N 5050.
  const terakhir = j.x.length - 1;
  dekat("kolom terakhir di sisi timur", j.x[terakhir], 1300);
  dekat("baris terakhir di sisi selatan", j.y[terakhir], 5050);

  // Northing HARUS menurun seiring baris. Ini pemeriksaan anti-cermin.
  const barisAtas = j.y[0];
  const barisBawah = j.y[terakhir];
  cek("Northing menurun seiring nomor baris", barisAtas > barisBawah, true);

  cek("elevasi dipakai apa adanya", [...new Set(j.z)], [-7]);
  cek("warna diambil per titik", j.vertexcolor[0], [10, 20, 30]);
}

// ── Warna mengikuti selnya, bukan urutan pembuatan titik ───────────────────
{
  // Merah di kolom kiri, biru di kolom kanan. Kalau indeksnya tertukar,
  // ortofoto akan tercermin timur-barat — dan itu tidak kentara pada foto.
  const j = bangunJaring(
    petak(2, 2, (c) => (c === 0 ? [255, 0, 0] : [0, 0, 255])),
    KOTAK,
    0
  );
  const barat = j.vertexcolor[j.x.indexOf(Math.min(...j.x))];
  const timur = j.vertexcolor[j.x.indexOf(Math.max(...j.x))];
  cek("sel barat merah", barat, [255, 0, 0]);
  cek("sel timur biru", timur, [0, 0, 255]);
}

// ── Topeng nodata ───────────────────────────────────────────────────────────
{
  // 3x3 dengan pojok kiri-atas kosong. Pojok itu cuma disentuh SATU segitiga —
  // segitiga pertama kuadran kiri-atas — jadi tepat satu yang hilang. Angka 7,
  // bukan 6: tiga segitiga lain di kuadran yang sama tidak menyentuhnya.
  const topeng = new Uint8Array(9).fill(1);
  topeng[0] = 0;
  const penuh = bangunJaring(petak(3, 3, () => [1, 2, 3]), KOTAK, 0);
  const berlubang = bangunJaring(petak(3, 3, () => [1, 2, 3], topeng), KOTAK, 0);

  cek("3x3 penuh = 8 segitiga", penuh.i.length, 8);
  cek("satu sel kosong menghapus segitiga yang menyentuhnya", berlubang.i.length, 7);
  // Titik yang tidak dipakai segitiga mana pun TIDAK ikut dikirim: gl-mesh3d
  // menghitung batas scene dari seluruh titik, jadi titik yatim memperlebar
  // scene ke bingkai penuh ortofoto walaupun bagian itu tidak tergambar.
  cek("titik kosong tidak ikut dikirim", berlubang.x.length, 8);
  cek(
    "indeks segitiga tetap di dalam jangkauan",
    rentang([...berlubang.i, ...berlubang.j, ...berlubang.k]).max < berlubang.x.length,
    true
  );
}

// ── Kotak nyata BPP 1-4 ─────────────────────────────────────────────────────
{
  // Angka dari header ECW "BPP 1-4.ecw": origin E 462357,8434 N 9749590,2390,
  // 29570 x 16613 sel @ 0,0866 m. Yang diperiksa: ujung jaring benar-benar
  // jatuh di dalam kotak, dan meleset paling jauh setengah sel dari tepinya.
  const bpp: KotakUtm = {
    minE: 462357.8434,
    maxE: 464918.6054,
    minN: 9748151.5532,
    maxN: 9749590.239,
  };
  const { nx, ny } = ukuranPetak(bpp, 520);
  const selE = (bpp.maxE - bpp.minE) / nx;
  const j = bangunJaring(petak(nx, ny, () => [0, 0, 0]), bpp, 0);

  cek("sisi panjang dapat 520 sel", nx, 520);
  cek("sisi pendek mengikuti rasio", ny, Math.round((520 * (bpp.maxN - bpp.minN)) / (bpp.maxE - bpp.minE)));
  dekat("sel ±4,9 m", selE, 4.925, 0.01);
  const x = rentang(j.x);
  dekat("tepi barat jaring setengah sel di dalam kotak", x.min - bpp.minE, selE / 2, 1e-6);
  dekat("tepi timur jaring setengah sel di dalam kotak", bpp.maxE - x.max, selE / 2, 1e-6);
  cek("RTS (E 464232,8) ada di dalam kotak", bpp.minE < 464232.796 && 464232.796 < bpp.maxE, true);
  // Catatan lapangan 17 September 2026: DF_7 memang di luar ortofoto. Diperiksa
  // di sini supaya kalau suatu hari ortofotonya diganti dan kotaknya melebar,
  // baris ini gagal dan catatannya ikut diperbarui, bukan diam-diam basi.
  cek("DF_7 (E 465139,2) masih di LUAR kotak", 465139.1519 > bpp.maxE, true);
}

// ── DEM: pencuplikan relief ─────────────────────────────────────────────────
{
  // 3x3 sel di atas KOTAK (E 1000–1400). Nilainya menanjak per KOLOM: 0, 128,
  // 255 — jadi hasil cuplikan sepanjang E bisa dihitung di kepala.
  const nilai = new Uint8ClampedArray([0, 128, 255, 0, 128, 255, 0, 128, 255]);
  const dem: PetakDem = {
    nx: 3, ny: 3, nilai,
    ada: new Uint8Array(9).fill(1),
    minZ: 10, maxZ: 20, kotak: KOTAK,
  };
  // Tengah sel kolom c / baris r — konvensi yang sama dengan bangunJaring().
  const Ec = (c: number) => 1000 + (400 * (c + 0.5)) / 3;
  const Nr = (r: number) => 5200 - (200 * (r + 0.5)) / 3;

  dekat("tepat di tengah sel tengah: 128 → 15,02 m", sampelDem(dem, Ec(1), Nr(1))!, 10 + (128 / 255) * 10, 1e-9);
  dekat("di tengah kolom kiri: 0 → minZ", sampelDem(dem, Ec(0), Nr(1))!, 10, 1e-9);
  dekat("separuh jalan antar kolom: rata-rata keduanya", sampelDem(dem, (Ec(0) + Ec(1)) / 2, Nr(1))!, 10 + (64 / 255) * 10, 1e-9);

  // Di luar titik tengah sel TERLUAR tidak ada empat tetangga untuk
  // diinterpolasi. Bukan kekurangan: menebak di sana berarti mengarang lereng
  // di tepi survei. Pada pemakaian sungguhan DEM (800x449) jauh lebih rapat
  // daripada jaringnya (520 sel), jadi tepi jaring tetap kebagian.
  cek("di tepi timur kotak: null", sampelDem(dem, KOTAK.maxE, Nr(1)), null);
  cek("di tepi barat kotak: null", sampelDem(dem, KOTAK.minE, Nr(1)), null);
  cek("di tepi utara kotak: null", sampelDem(dem, Ec(1), KOTAK.maxN), null);
  cek("jauh di luar kotak: null", sampelDem(dem, 9999, 9999), null);

  // Satu tetangga nodata menggugurkan seluruh sampel — bukan "pakai yang ada".
  const ada = new Uint8Array(9).fill(1);
  ada[4] = 0;
  cek(
    "satu tetangga nodata → seluruh sampel ditolak",
    sampelDem({ ...dem, ada }, (Ec(0) + Ec(1)) / 2, (Nr(0) + Nr(1)) / 2),
    null
  );
}

// ── DEM: jaring ikut bentuk tanah ───────────────────────────────────────────
{
  // DEM sengaja LEBIH RAPAT daripada citranya, seperti pemakaian sungguhan
  // (DEM 800x449 di bawah jaring 520 sel). Dengan begitu tepi jaring pun masih
  // punya empat tetangga untuk diinterpolasi.
  const demRata = (n: number, ada?: Uint8Array): PetakDem => ({
    nx: 16, ny: 16,
    nilai: new Uint8ClampedArray(256).fill(n),
    ada: ada ?? new Uint8Array(256).fill(1),
    minZ: 0, maxZ: 100, kotak: KOTAK,
  });
  const citra = petak(4, 4, () => [9, 9, 9]);

  const j = bangunJaring(citra, KOTAK, 0, demRata(128));
  cek("DEM rata: seluruh titik pada satu tinggi", [...new Set(j.z.map((v) => Math.round(v)))], [50]);
  cek("semua sel terpakai", j.x.length, 16);

  // `z` jadi PERGESERAN saat relief aktif, bukan tinggi mutlak — supaya kontrol
  // yang sama di panel tetap berguna menaikkan seluruh lantai.
  const naik = bangunJaring(citra, KOTAK, 7, demRata(128));
  cek("z menggeser seluruh lantai", [...new Set(naik.z.map((v) => Math.round(v)))], [57]);

  // Sel tanpa data tinggi tidak boleh ikut digambar: menambalnya dengan tinggi
  // karangan berarti melukis lereng yang tidak pernah disurvei.
  const bolong = new Uint8Array(256).fill(1);
  for (let i = 0; i < 16 * 5; i++) bolong[i] = 0; // lima baris teratas DEM kosong
  const potong = bangunJaring(citra, KOTAK, 0, demRata(128, bolong));
  benar("baris tanpa data tinggi menghilangkan titiknya", potong.x.length < 16);
  benar("segitiganya ikut berkurang", potong.i.length < j.i.length);
  benar("sisanya tetap tergambar", potong.i.length > 0);
}

// ── Menggeser lantai tidak boleh meratakannya ───────────────────────────────
{
  // Bug nyata, 17 September 2026: halaman menggeser lantai dengan
  // `jaring.z.fill(z)`. Benar selama lantainya bidang datar, tapi begitu relief
  // masuk baris itu meratakan seluruh bentuk tanah tiap kali digambar —
  // jaringnya benar, yang tergambar rata. Pemeriksaan ini yang menahannya.
  const miring: PetakDem = {
    nx: 16, ny: 16,
    // Menanjak per kolom. Bentuk inilah yang harus bertahan sesudah digeser.
    nilai: new Uint8ClampedArray(Array.from({ length: 256 }, (_, n) => (n % 16) * 17)),
    ada: new Uint8Array(256).fill(1),
    minZ: 0, maxZ: 255, kotak: KOTAK,
  };
  const jar = bangunJaring(petak(4, 4, () => [1, 2, 3]), KOTAK, 0, miring);
  const zAwal = [...jar.z];

  benar("relief benar-benar bervariasi", new Set(zAwal.map((v) => Math.round(v))).size > 1);
  cek("pergeseran awal nol", jar.geser, 0);

  terapkanGeser(jar, 12);
  cek("geser tercatat", jar.geser, 12);
  cek(
    "setiap titik naik persis 12 m — bentuknya utuh",
    jar.z.map((v, n) => Math.round((v - zAwal[n]) * 1e6) / 1e6),
    zAwal.map(() => 12)
  );

  // Dipanggil ulang dengan angka sama tidak boleh menggeser dua kali.
  const sebelum = [...jar.z];
  terapkanGeser(jar, 12);
  cek("pemanggilan ulang dengan angka sama: tidak bergerak", jar.z, sebelum);

  terapkanGeser(jar, 0);
  cek(
    "kembali ke nol mengembalikan tinggi semula",
    jar.z.map((v) => Math.round(v * 1e6) / 1e6),
    zAwal.map((v) => Math.round(v * 1e6) / 1e6)
  );
}

console.log(gagal === 0 ? "\nSemua lolos." : `\n${gagal} pemeriksaan gagal.`);
process.exit(gagal === 0 ? 0 : 1);
