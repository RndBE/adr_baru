/**
 * Pemeriksaan analisa gabungan beberapa prisma.
 * Jalankan: npx tsx src/components/monitoring/gabungan.test.ts
 *
 * Dua hal yang dijaga di sini, keduanya pernah jadi sumber layar yang
 * menyesatkan di aplikasi ini:
 *
 *   1. Prisma yang gagal ditembak tidak boleh ikut sebagai nol. Di tabel per
 *      prisma itu sudah diperbaiki (derive.test.ts); di sini kesalahan yang
 *      sama akan menarik rata-rata kelompok ke arah diam.
 *
 *   2. Vektor rata-rata sendirian bisa menipu. Dua prisma yang bergeser 30 mm
 *      ke arah berlawanan menghasilkan resultan nol — angka yang terbaca
 *      "tidak ada pergeseran" untuk site yang justru sedang terbelah.
 */
import {
  gabungkanPrisma,
  olahRentang,
  selisihArah,
  seriGabungan,
  TOLERANSI_RUNNING_MS,
} from "./gabungan";
import type { AmbangSite } from "@/lib/ambang";
import type { PrismaRingkas } from "./derive";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`);
}
function dekat(judul: string, dapat: number | null, harus: number, toleransi = 1e-6) {
  const ok = dapat !== null && Math.abs(dapat - harus) <= toleransi;
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${dapat}\n      harus ${harus} (±${toleransi})`}`);
}

/** Prisma dengan pergeseran mendatar dx (timur) / dy (utara), mm. */
function prisma(
  nama: string,
  dxMm: number | null,
  dyMm: number | null,
  ubah: Partial<PrismaRingkas> = {}
): PrismaRingkas {
  const geserMm = dxMm !== null && dyMm !== null ? Math.hypot(dxMm, dyMm) : null;
  return {
    id: nama,
    nama,
    dxMm,
    dyMm,
    dzMm: 0,
    linierMm: geserMm,
    geserMm,
    bearing: null,
    arahTeks: null,
    lajuMmd: null,
    status: null,
    statusLaju: null,
    e: null,
    n: null,
    tertembak: true,
    ...ubah,
  };
}

// ── Satu blok bergerak utuh ─────────────────────────────────────────────────
{
  // Tiga prisma, semuanya 20 mm ke timur.
  const r = gabungkanPrisma([prisma("A", 20, 0), prisma("B", 20, 0), prisma("C", 20, 0)])!;
  cek("blok utuh: ketiganya dipakai", r.dipakai.length, 3);
  dekat("blok utuh: besar resultan = besar tiap prisma", r.vektorRata.besarMm, 20);
  dekat("blok utuh: arah timur", r.vektorRata.bearing, 90);
  dekat("blok utuh: keseragaman penuh", r.keseragaman, 1);
  cek("blok utuh: dibaca seragam", r.pola, "seragam");
  dekat("blok utuh: tidak ada simpangan arah", r.simpangArahDeg, 0);
  // Inti "blok bergerak utuh": tidak ada gerak relatif di dalam kelompok.
  dekat("blok utuh: pergeseran diferensial nol", r.diferensialMm, 0);
  dekat("blok utuh: sebarannya rapat", r.sebaran.sdMm, 0);
}

// ── Site yang terbelah: rata-rata nol, tapi prismanya bergerak jauh ─────────
{
  const r = gabungkanPrisma([prisma("A", 30, 0), prisma("B", -30, 0)])!;
  // Angka yang menipu kalau dibaca sendirian.
  dekat("terbelah: resultan nol", r.vektorRata.besarMm, 0);
  cek("terbelah: arah tidak dikarang", r.vektorRata.bearing, null);
  // Angka-angka yang membongkarnya.
  dekat("terbelah: keseragaman nol", r.keseragaman, 0);
  cek("terbelah: dibaca berpencar", r.pola, "berpencar");
  dekat("terbelah: pergeseran terbesar tetap 30 mm", r.sebaran.maksMm, 30);
  dekat("terbelah: diferensial 60 mm", r.diferensialMm, 60);
  cek("terbelah: simpangan arah tak terhingga → null", r.simpangArahDeg, null);
}

// ── Satu prisma bergerak sendirian ──────────────────────────────────────────
{
  // Pola khas tiang tersenggol: tetangganya diam, satu melompat.
  const r = gabungkanPrisma([prisma("A", 0, 0), prisma("B", 0, 0), prisma("C", 40, 0)])!;
  dekat("sendirian: keseragaman tetap penuh (yang lain nol, tidak melawan)", r.keseragaman, 1);
  // Yang membedakannya dari blok utuh: sebaran dan diferensialnya lebar.
  dekat("sendirian: median nol — kebanyakan prisma diam", r.sebaran.medianMm, 0);
  dekat("sendirian: maks 40 mm", r.sebaran.maksMm, 40);
  dekat("sendirian: diferensial 40 mm", r.diferensialMm, 40);
}

// ── Gagal ditembak tidak boleh ikut sebagai nol ─────────────────────────────
{
  const r = gabungkanPrisma([
    prisma("A", 20, 0),
    prisma("B", 20, 0),
    prisma("GAGAL", null, null, { tertembak: false, geserMm: null, linierMm: null }),
  ])!;
  cek("gagal tembak: tidak masuk hitungan", r.dipakai.length, 2);
  cek("gagal tembak: disebut namanya", r.diabaikan, ["GAGAL"]);
  // Kalau ia ikut sebagai (0,0), resultannya turun jadi 13,33 mm.
  dekat("gagal tembak: tidak menarik rata-rata ke arah diam", r.vektorRata.besarMm, 20);
}

// ── Tidak ada yang bisa dihitung ────────────────────────────────────────────
{
  const r = gabungkanPrisma([prisma("X", null, null, { tertembak: false })]);
  cek("semua gagal: null, bukan angka nol", r, null);
  cek("pilihan kosong: null", gabungkanPrisma([]), null);
}

// ── Seluruh kelompok benar-benar diam ───────────────────────────────────────
{
  const r = gabungkanPrisma([prisma("A", 0, 0), prisma("B", 0, 0)])!;
  cek("diam: keseragaman tidak dikarang", r.keseragaman, null);
  cek("diam: polanya diam", r.pola, "diam");
}

// ── Selisih arah tiap prisma terhadap arah kelompok ─────────────────────────
{
  const r = gabungkanPrisma([prisma("A", 0, 10), prisma("B", 10, 0)])!;
  // Resultan (5,5) → timur laut, 45°.
  dekat("selisih arah: resultan 45°", r.vektorRata.bearing, 45);
  dekat("selisih arah: prisma utara −45°", selisihArah({ dxMm: 0, dyMm: 10 }, r.vektorRata), -45);
  dekat("selisih arah: prisma timur +45°", selisihArah({ dxMm: 10, dyMm: 0 }, r.vektorRata), 45);
  cek(
    "selisih arah: prisma diam tidak punya arah",
    selisihArah({ dxMm: 0, dyMm: 0 }, r.vektorRata),
    null
  );
}

// ── Status kelompok mengikuti yang terburuk ─────────────────────────────────
{
  const r = gabungkanPrisma([
    prisma("A", 1, 0, { status: "Normal", lajuMmd: 2 }),
    prisma("B", 1, 0, { status: "Siaga", lajuMmd: 8 }),
    prisma("C", 1, 0, { status: "Waspada", lajuMmd: null }),
  ])!;
  cek("status kelompok: terburuk", r.status, "Siaga");
  cek("status kelompok: cacahnya", r.hitunganStatus, { Normal: 1, Siaga: 1, Waspada: 1 });
  // Prisma tanpa angka laju tidak boleh dihitung sebagai laju nol.
  dekat("laju rata-rata: hanya dari yang punya angka", r.lajuRataMmd, 5);
  dekat("laju tertinggi", r.lajuMaksMmd, 8);
}

// ── Riwayat harian: pengelompokan per running ───────────────────────────────
{
  // Dua running. Di dalam satu running tiap prisma dibidik pada detik berbeda,
  // jadi stempel waktunya tidak pernah sama persis.
  const s = seriGabungan([
    { id: "A", nama: "A", seri: [{ t: "2026-09-17 08:00:10", mm: 10 }, { t: "2026-09-17 10:00:05", mm: 12 }] },
    { id: "B", nama: "B", seri: [{ t: "2026-09-17 08:02:40", mm: 20 }, { t: "2026-09-17 10:03:00", mm: 24 }] },
  ]);
  cek("riwayat: dua running, bukan empat titik", s.baris.length, 2);
  cek("riwayat: kunci dari indeks, bukan nama", s.prisma.map((p) => p.kunci), ["p0", "p1"]);
  cek("riwayat: kedua prisma masuk baris pertama", [s.baris[0].p0, s.baris[0].p1], [10, 20]);
  cek("riwayat: running lengkap ditandai", s.baris.every((b) => b.lengkap), true);
  dekat("riwayat: rata-rata running pertama", s.baris[0].rata as number, 15);
}

// ── Running yang tidak lengkap dilaporkan ───────────────────────────────────
{
  const s = seriGabungan([
    { id: "A", nama: "A", seri: [{ t: "2026-09-17 08:00:10", mm: 10 }, { t: "2026-09-17 10:00:05", mm: 12 }] },
    { id: "B", nama: "B", seri: [{ t: "2026-09-17 08:02:40", mm: 20 }] },
  ]);
  cek("tidak lengkap: dihitung", s.tidakLengkap, 1);
  cek("tidak lengkap: prisma yang hilang jadi null, bukan nol", s.baris[1].p1, null);
  // Rata-rata running kedua hanya dari prisma yang terbaca — dan karena itulah
  // `lengkap` ikut dikembalikan, supaya lompatannya bisa diterangkan di layar.
  dekat("tidak lengkap: rata-rata dari yang terbaca saja", s.baris[1].rata as number, 12);
  cek("tidak lengkap: barisnya ditandai", s.baris[1].lengkap, false);
}

// ── Prisma yang muncul dua kali menutup kelompok ────────────────────────────
{
  // Jeda hanya 3 menit — di bawah toleransi — tapi prisma A muncul lagi, dan
  // itu hanya mungkin kalau running berikutnya sudah dimulai.
  const s = seriGabungan([
    { id: "A", nama: "A", seri: [{ t: "2026-09-17 08:00:00", mm: 10 }, { t: "2026-09-17 08:03:00", mm: 11 }] },
  ]);
  cek("prisma berulang: dipecah jadi dua running", s.baris.length, 2);
  cek("toleransi tetap batas atas", TOLERANSI_RUNNING_MS, 600000);
}

// ── Bacaan tak terbaca tidak menyelinap ke grafik ───────────────────────────
{
  const s = seriGabungan([
    { id: "A", nama: "A", seri: [{ t: "bukan tanggal", mm: 10 }, { t: "2026-09-17 08:00:00", mm: "x" }] },
  ]);
  cek("stempel/nilai rusak dibuang, bukan jadi titik nol", s.baris.length, 0);
}

// ── Rentang waktu: dua basis membaca data yang sama ─────────────────────────

const AMBANG_R: AmbangSite = {
  geser: { normalMax: 35, waspadaMax: 80, siagaMax: 150 },
  laju: { waspadaMin: 40, siagaMin: 80, awasMin: 120 },
};

// Satu prisma yang sudah 100 mm dari R0 di awal jendela, lalu bergerak 12 mm
// lagi ke timur selama 6 jam. Dua pertanyaan berbeda atas data yang sama.
const RENTANG = [
  {
    id_prisma: "P1",
    nama_prisma: "DF_1",
    acuan_sah: true,
    titik: [
      { t: "2026-09-17 06:00:00", dnMm: 0, deMm: 100, dzMm: 0 },
      { t: "2026-09-17 09:00:00", dnMm: 0, deMm: 106, dzMm: 0 },
      { t: "2026-09-17 12:00:00", dnMm: 0, deMm: 112, dzMm: 0 },
    ],
  },
];

{
  const { ringkas, seri } = olahRentang(RENTANG, "akhir", AMBANG_R);
  dekat("basis akhir: pergeseran dari R0", ringkas[0].geserMm, 112);
  // 112 mm: di atas ambang waspada 80, di bawah awas 150.
  cek("basis akhir: dinilai dengan ambang pergeseran", ringkas[0].status, "Siaga");
  cek("basis akhir: grafik mengukur dari R0", seri[0].seri.map((t) => t.mm), [100, 106, 112]);
}

{
  const { ringkas, seri } = olahRentang(RENTANG, "selama", AMBANG_R);
  dekat("basis selama: gerak dalam jendela saja", ringkas[0].geserMm, 12);
  // Inti pemisahan ini: 12 mm dalam 6 jam TIDAK boleh disebut "Normal" hanya
  // karena di bawah 35 mm — ambang itu untuk pergeseran total dari R0.
  cek("basis selama: TIDAK dinilai dengan ambang pergeseran", ringkas[0].status, null);
  cek("basis selama: grafik mengukur dari awal rentang", seri[0].seri.map((t) => t.mm), [0, 6, 12]);
}

{
  // 12 mm dalam 6 jam = 48 mm/hari → lewat ambang laju Waspada (40).
  const { ringkas } = olahRentang(RENTANG, "akhir", AMBANG_R);
  dekat("laju dari lama rentang sebenarnya, bukan 24 jam", ringkas[0].lajuMmd, 48);
  cek("laju dinilai dengan ambang laju", ringkas[0].statusLaju, "Waspada");
}

{
  // Prisma tanpa bacaan di jendela, dan prisma tanpa acuan R0 yang sah.
  const { ringkas } = olahRentang(
    [
      { id_prisma: "P8", nama_prisma: "BS_1", acuan_sah: false, titik: [] },
      { id_prisma: "P9", nama_prisma: "DF_9", acuan_sah: true, titik: [] },
    ],
    "akhir",
    AMBANG_R
  );
  cek("tanpa acuan: ditandai tidak tertembak", ringkas[0].tertembak, false);
  cek("tanpa bacaan: ditandai tidak tertembak", ringkas[1].tertembak, false);
  // Keduanya tetap terdaftar supaya namanya bisa disebut di layar.
  cek("keduanya tetap terdaftar", ringkas.map((r) => r.nama), ["BS_1", "DF_9"]);
  cek("tidak dikarang jadi nol", [ringkas[0].geserMm, ringkas[1].geserMm], [null, null]);
}


console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
