/**
 * Perbaiki azimut koordinat tembakan yang SUDAH tersimpan di `rts`/`temp_rts`.
 * Jalankan: npx tsx scripts/perbaiki-azimut-rts.ts [site] [--terapkan]
 *
 * Tanpa `--terapkan` skrip ini TIDAK menulis apa pun — cuma melaporkan berapa
 * baris yang akan berubah dan sejauh apa. Itu bawaannya dengan sengaja:
 * skrip yang menyentuh seluruh riwayat pengukuran tidak boleh bisa dijalankan
 * tanpa melihat dampaknya lebih dulu.
 *
 * Duduk perkaranya ada di src/lib/koreksi-azimut.ts. Ringkasnya: HA yang
 * dikirim logger dipakai dengan satuan dan tanda yang salah, jadi setiap
 * prisma tercatat di sisi yang salah dari alat.
 *
 * ── Aman dijalankan berulang ────────────────────────────────────────────────
 *
 * Koreksinya MENGHITUNG ULANG azimut dari HA mentah, bukan memutar koordinat
 * yang ada. HA tidak ikut berubah, dan jarak dari stasiun kekal, jadi
 * menjalankan skrip ini dua kali menghasilkan angka yang sama persis. Tidak
 * ada risiko koreksi tertumpuk dua kali.
 *
 * ── Yang tidak disentuh ─────────────────────────────────────────────────────
 *
 * Elevasi (sensor10), sudut mentah (sensor5/6), dan jarak miring (sensor7)
 * dibiarkan apa adanya — semuanya benar sejak awal. Tembakan gagal, yang
 * koordinatnya nol, juga dilewati: menulis koordinat ke sana akan mengubah
 * "tidak ketemu" jadi terlihat seperti pengukuran yang berhasil.
 *
 * `temp_prisma` tidak diurus di sini. Isinya ditimpa penuh tiap siklus oleh
 * /api/datamasuk/adr, yang sudah mengoreksi sejak sebelum menulis, jadi ia
 * membetulkan dirinya sendiri dalam satu siklus.
 */
import { PrismaClient } from "@prisma/client";
import { getSite } from "@/lib/sites";
import { perbaikiKoordinat, tulisKoordinat } from "@/lib/koreksi-azimut";

const db = new PrismaClient();

type Baris = {
  id: number;
  id_kontrol: string;
  sensor1: string;
  sensor3: string;
  sensor5: string;
  sensor8: string;
  sensor9: string;
  site: string | null;
};

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
    stasiunE: site.rts.E,
    stasiunN: site.rts.N,
  };

  console.log(`Site        : ${site.nama} (${slug})`);
  console.log(`Stasiun     : E ${k.stasiunE} N ${k.stasiunN}`);
  console.log(`Azimut      : HA × ${k.faktorDerajat} + ${k.orientasiDeg}°`);
  console.log(`Mode        : ${terapkan ? "TERAPKAN — akan menulis ke basis data" : "uji coba, tidak menulis apa pun"}\n`);

  for (const tabel of ["rts", "temp_rts"] as const) {
    // Site sebuah baris ditentukan sesinya, bukan loggernya: satu logger boleh
    // melayani lebih dari satu site.
    const baris = await db.$queryRawUnsafe<Baris[]>(
      `SELECT t.id, t.id_kontrol, t.sensor1, t.sensor3, t.sensor5, t.sensor8, t.sensor9, l.site
         FROM \`${tabel}\` t
         JOIN log_kontrol l ON l.id_log = t.id_kontrol
        WHERE l.site = ?
        ORDER BY t.id`,
      slug
    );

    let berubah = 0;
    let dilewati = 0;
    let totalGeser = 0;
    let maksGeser = 0;
    const contoh: string[] = [];

    for (const b of baris) {
      const E = Number(b.sensor8);
      const N = Number(b.sensor9);
      const baru = perbaikiKoordinat(E, N, b.sensor5, k);
      if (!baru) {
        dilewati++;
        continue;
      }
      const geser = Math.hypot(baru.E - E, baru.N - N);
      // Baris yang sudah benar tidak ditulis ulang: menjalankan skrip ini lagi
      // sesudah semuanya beres harus melaporkan nol perubahan, bukan ribuan
      // penulisan yang tidak mengubah apa-apa.
      if (geser < 0.0005) {
        dilewati++;
        continue;
      }

      berubah++;
      totalGeser += geser;
      maksGeser = Math.max(maksGeser, geser);
      if (contoh.length < 6) {
        contoh.push(
          `   ${(b.sensor3 || b.sensor1).padEnd(6)} sesi ${b.id_kontrol}  ` +
            `${E.toFixed(3)}, ${N.toFixed(3)}  →  ${baru.E.toFixed(3)}, ${baru.N.toFixed(3)}   (${geser.toFixed(1)} m)`
        );
      }

      if (terapkan) {
        await db.$executeRawUnsafe(
          `UPDATE \`${tabel}\` SET sensor8 = ?, sensor9 = ? WHERE id = ?`,
          tulisKoordinat(baru.E),
          tulisKoordinat(baru.N),
          b.id
        );
      }
    }

    console.log(`── ${tabel} ──`);
    console.log(`   baris site ini   : ${baris.length}`);
    console.log(`   diperbaiki       : ${berubah}`);
    console.log(`   dilewati         : ${dilewati}  (tembakan gagal, HA kosong, atau sudah benar)`);
    if (berubah > 0) {
      console.log(`   pergeseran       : rata-rata ${(totalGeser / berubah).toFixed(1)} m, terjauh ${maksGeser.toFixed(1)} m`);
      console.log(contoh.join("\n"));
    }
    console.log();
  }

  if (!terapkan) {
    console.log("Tidak ada yang ditulis. Ulangi dengan --terapkan untuk menerapkannya.");
  }
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
