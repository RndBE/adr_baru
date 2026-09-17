/**
 * Perbaiki azimut koordinat tembakan yang SUDAH tersimpan di `rts`/`temp_rts`.
 * Jalankan: npx tsx scripts/perbaiki-azimut-rts.ts [site] [--terapkan]
 *
 * Tanpa `--terapkan` skrip ini TIDAK menulis apa pun — cuma melaporkan berapa
 * baris yang akan berubah dan sejauh apa. Itu bawaannya dengan sengaja:
 * skrip yang menyentuh seluruh riwayat pengukuran tidak boleh bisa dijalankan
 * tanpa melihat dampaknya lebih dulu.
 *
 * Duduk perkaranya ada di src/lib/koreksi-azimut.ts. Ringkasnya: HA dan VA
 * yang dikirim logger sama-sama gon tapi dipakai seolah derajat, dan HA-nya
 * juga salah tanda. Jadi setiap prisma tercatat di sisi yang salah dari alat,
 * jaraknya terlalu pendek, dan elevasinya ngawur.
 *
 * ── Aman dijalankan berulang ────────────────────────────────────────────────
 *
 * Koreksinya MENYUSUN ULANG E/N/Z dari HA/VA/SD, bukan menambal koordinat yang
 * ada. Ketiga pengukuran mentah itu tidak pernah ikut diubah, jadi menjalankan
 * skrip ini dua kali menghasilkan angka yang sama persis. Tidak ada risiko
 * koreksi tertumpuk dua kali.
 *
 * ── Yang tidak disentuh ─────────────────────────────────────────────────────
 *
 * Pengukuran mentahnya — sudut (sensor5/6) dan jarak miring (sensor7) —
 * dibiarkan apa adanya. Semuanya benar sejak awal; justru itu yang membuat
 * seluruh riwayat bisa dihitung ulang. Yang ditulis cuma hasil turunannya:
 * sensor8/9/10. Tembakan gagal dilewati: menulis koordinat ke sana akan
 * mengubah "tidak ketemu" jadi terlihat seperti pengukuran yang berhasil.
 *
 * ── Baris salinan yang tidak membawa sudutnya ───────────────────────────────
 *
 * 93 baris di kolam_bpp berjarak miring SAH tapi ber-sudut "0" — tembakan yang
 * sama dikirim ulang tanpa sudutnya. Sudutnya diambil dari baris saudara:
 * prisma yang sama, sesi yang sama, HA dan VA sah. Tanpa itu baris-baris itu tidak bisa
 * dikoreksi sama sekali, dan yang lebih buruk, `/api/deformasi` memilih baris
 * pertama yang ditemuinya — jadi salinan tak terkoreksi bisa saja yang terpakai
 * menghitung pergeseran.
 *
 * `temp_prisma` tidak diurus di sini. Isinya ditimpa penuh tiap siklus oleh
 * /api/datamasuk/adr, yang sudah mengoreksi sejak sebelum menulis, jadi ia
 * membetulkan dirinya sendiri dalam satu siklus.
 */
import { PrismaClient } from "@prisma/client";
import { getSite } from "@/lib/sites";
import { sudutKosong, perbaikiTembakan, tulisKoordinat } from "@/lib/koreksi-azimut";

const db = new PrismaClient();

type Baris = {
  id: number;
  id_kontrol: string;
  sensor1: string;
  sensor3: string;
  sensor5: string;
  sensor6: string;
  sensor7: string;
  sensor8: string;
  sensor9: string;
  sensor10: string;
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
    tinggiAlat: site.koreksiAzimut.tinggiAlat,
    stasiunE: site.rts.E,
    stasiunN: site.rts.N,
    stasiunZ: site.rts.Z,
  };

  console.log(`Site        : ${site.nama} (${slug})`);
  console.log(`Stasiun     : E ${k.stasiunE} N ${k.stasiunN} Z ${k.stasiunZ} (+${k.tinggiAlat} m tinggi alat)`);
  console.log(`Azimut      : HA × ${k.faktorDerajat} + ${k.orientasiDeg}°`);
  console.log(`Jarak/Z     : SD × sin/cos(VA × ${k.faktorDerajat})`);
  console.log(`Mode        : ${terapkan ? "TERAPKAN — akan menulis ke basis data" : "uji coba, tidak menulis apa pun"}\n`);

  for (const tabel of ["rts", "temp_rts"] as const) {
    // Site sebuah baris ditentukan sesinya, bukan loggernya: satu logger boleh
    // melayani lebih dari satu site.
    const baris = await db.$queryRawUnsafe<Baris[]>(
      `SELECT t.id, t.id_kontrol, t.sensor1, t.sensor3, t.sensor5, t.sensor6, t.sensor7,
              t.sensor8, t.sensor9, t.sensor10, l.site
         FROM \`${tabel}\` t
         JOIN log_kontrol l ON l.id_log = t.id_kontrol
        WHERE l.site = ?
        ORDER BY t.id`,
      slug
    );

    // Sudut dari baris saudara, untuk salinan yang tidak membawa sudutnya sendiri.
    const sudutSaudara = new Map<string, { ha: string; va: string }>();
    for (const b of baris) {
      if (sudutKosong(b.sensor5) || sudutKosong(b.sensor6)) continue;
      const kunci = `${b.id_kontrol}|${b.sensor1}`;
      if (!sudutSaudara.has(kunci)) sudutSaudara.set(kunci, { ha: b.sensor5, va: b.sensor6 });
    }

    let berubah = 0;
    let dilewati = 0;
    let pinjamHa = 0;
    let totalGeser = 0;
    let maksGeser = 0;
    const contoh: string[] = [];

    for (const b of baris) {
      const E = Number(b.sensor8);
      const N = Number(b.sensor9);
      const Z = Number(b.sensor10);
      const sendiri = !sudutKosong(b.sensor5) && !sudutKosong(b.sensor6);
      const pinjam = sendiri ? undefined : sudutSaudara.get(`${b.id_kontrol}|${b.sensor1}`);
      const ha = sendiri ? b.sensor5 : pinjam?.ha;
      const va = sendiri ? b.sensor6 : pinjam?.va;
      const baru = perbaikiTembakan(ha, va, b.sensor7, k);
      if (!baru) {
        dilewati++;
        continue;
      }
      const geser = Math.hypot(baru.E - E, baru.N - N);
      const geserZ = Number.isFinite(Z) ? Math.abs(baru.Z - Z) : 0;
      // Baris yang sudah benar tidak ditulis ulang: menjalankan skrip ini lagi
      // sesudah semuanya beres harus melaporkan nol perubahan, bukan ribuan
      // penulisan yang tidak mengubah apa-apa.
      if (geser < 0.0005 && geserZ < 0.0005) {
        dilewati++;
        continue;
      }

      berubah++;
      if (!sendiri) pinjamHa++;
      totalGeser += geser;
      maksGeser = Math.max(maksGeser, geser);
      if (contoh.length < 6) {
        contoh.push(
          `   ${(b.sensor3 || b.sensor1).padEnd(6)} sesi ${b.id_kontrol}  ` +
            `${E.toFixed(1)}, ${N.toFixed(1)}, z${Z.toFixed(1)}  →  ` +
            `${baru.E.toFixed(1)}, ${baru.N.toFixed(1)}, z${baru.Z.toFixed(1)}   ` +
            `(mendatar ${geser.toFixed(1)} m, tegak ${geserZ.toFixed(1)} m)`
        );
      }

      if (terapkan) {
        await db.$executeRawUnsafe(
          `UPDATE \`${tabel}\` SET sensor8 = ?, sensor9 = ?, sensor10 = ? WHERE id = ?`,
          tulisKoordinat(baru.E),
          tulisKoordinat(baru.N),
          tulisKoordinat(baru.Z),
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
      if (pinjamHa > 0) console.log(`   sudut dari saudara: ${pinjamHa} baris salinan tanpa sudut sendiri`);
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
