/**
 * Hitung ulang E/N/Z tembakan yang SUDAH tersimpan di `rts`/`temp_rts` dengan
 * parameter koordinat site saat ini (nol set, koordinat dan tinggi alat).
 * Jalankan: npx tsx scripts/perbaiki-azimut-rts.ts [site] [--terapkan]
 *
 * Tanpa `--terapkan` skrip ini TIDAK menulis apa pun — cuma melaporkan berapa
 * baris yang akan berubah dan sejauh apa.
 *
 * Logikanya ada di src/lib/hitung-ulang-koordinat.ts, dipakai juga oleh
 * Prism Config saat nol set dari backsight diterapkan. Duduk perkara rumusnya
 * di src/lib/koreksi-azimut.ts dan src/lib/orientasi-bs.ts.
 */
import { PrismaClient } from "@prisma/client";
import { getSite } from "@/lib/sites";
import { hitungUlangKoordinat } from "@/lib/hitung-ulang-koordinat";

const db = new PrismaClient();

async function main() {
  const arg = process.argv.slice(2);
  const terapkan = arg.includes("--terapkan");
  const slug = arg.find((a) => !a.startsWith("--")) ?? "kolam_bpp";

  const site = await getSite(slug);
  if (!site.koreksiAzimut) {
    console.error(`Site "${slug}" tidak punya parameter koreksi azimut di t_site.`);
    console.error("Isi ha_faktor_derajat dan ha_orientasi_deg lebih dulu (migrasi 015).");
    process.exit(1);
  }
  if (!site.rts) {
    console.error(`Site "${slug}" belum punya koordinat RTS (rts_e/rts_n) di t_site.`);
    process.exit(1);
  }

  const k = {
    faktorDerajat: site.koreksiAzimut.faktorDerajat,
    orientasiDeg: site.koreksiAzimut.orientasiDeg,
    tinggiAlat: site.koreksiAzimut.tinggiAlat,
    stasiunE: site.rts.E,
    stasiunN: site.rts.N,
    stasiunZ: site.rts.Z,
  };

  // Hanya sesi pemasangan alat yang sekarang (t_site.pemasangan_sejak, migrasi 029).
  const [b] = await db.$queryRaw<Array<{ sejak: string | null }>>`
    SELECT DATE_FORMAT(pemasangan_sejak, '%Y-%m-%d %H:%i:%s') AS sejak FROM t_site WHERE slug = ${slug}
  `;
  const sejak = b?.sejak ?? null;

  console.log(`Site        : ${site.nama} (${slug})`);
  console.log(`Sesi        : ${sejak ? `sejak pemasangan ${sejak}` : "semua sesi site"}`);
  console.log(`Stasiun     : E ${k.stasiunE} N ${k.stasiunN} Z ${k.stasiunZ} (+${k.tinggiAlat} m tinggi alat)`);
  console.log(`Azimut      : HA × ${k.faktorDerajat} + ${k.orientasiDeg}°`);
  console.log(`Jarak/Z     : SD × sin/cos(VA × ${k.faktorDerajat})`);
  console.log(`Mode        : ${terapkan ? "TERAPKAN — akan menulis ke basis data" : "uji coba, tidak menulis apa pun"}\n`);

  const lap = await hitungUlangKoordinat(db, slug, k, terapkan, sejak);
  if (lap.sesiDilewati > 0) console.log(`${lap.sesiDilewati} sesi sebelum pemasangan tidak disentuh.\n`);
  for (const t of lap.tabel) {
    console.log(`── ${t.tabel} ──`);
    console.log(`   baris site ini   : ${t.baris}`);
    console.log(`   dihitung ulang   : ${t.berubah}`);
    console.log(`   dilewati         : ${t.dilewati}  (tembakan gagal, sudut kosong, atau sudah benar)`);
    if (t.berubah > 0) {
      console.log(`   pergeseran       : rata-rata ${t.rataGeserM.toFixed(1)} m, terjauh ${t.maksGeserM.toFixed(1)} m`);
      if (t.pinjamSudut > 0) console.log(`   sudut dari saudara: ${t.pinjamSudut} baris salinan tanpa sudut sendiri`);
      console.log(t.contoh.map((c) => `   ${c}`).join("\n"));
    }
    console.log();
  }
  if (terapkan) console.log(`temp_prisma disegarkan: ${lap.tempPrisma} baris`);
  else console.log("Tidak ada yang ditulis. Ulangi dengan --terapkan untuk menerapkannya.");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
