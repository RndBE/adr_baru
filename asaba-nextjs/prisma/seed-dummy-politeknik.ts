/**
 * Data CONTOH untuk site Politeknik PU.
 *
 * ⚠ SEMUA ANGKA DI SINI KARANGAN. Site-nya ditandai `data_dummy = true` supaya
 * peringatan tetap muncul di seluruh aplikasi meski field-nya terisi lengkap.
 * Hapus dengan `npx tsx prisma/seed-dummy-politeknik.ts --hapus` lalu isi
 * angka survei yang sebenarnya lewat Master Data → Site.
 *
 * Yang dibuat:
 *   - t_site      : koordinat referensi, center peta, ambang (ditandai contoh)
 *   - t_lokasi    : lokasi contoh di Semarang
 *   - t_logger    : logger 30003 khusus site ini
 *   - t_prisma    : 5 titik prisma
 *   - log_kontrol : 6 sesi pengukuran (1 baseline r0 + 5 lanjutan)
 *   - rts         : 1 baris per prisma per sesi, dengan pergeseran bertahap
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "politeknik-pu";

/**
 * Logger sendiri untuk site ini, mencerminkan bahwa tiap area pemantauan punya
 * unit RTS-nya masing-masing.
 *
 * Catatan penamaan prisma: id-nya P1..P5, bukan PPU1..PPU5. `id_prisma` adalah
 * nomor SLOT pada RTS (1..50) dan hanya unik bersama `site` — jadi P1 boleh ada
 * di ketiga site sekaligus dan menunjuk target yang berbeda-beda. Halaman Prism
 * Config juga memetakan slot ke id `P<nomor>`, sehingga id di luar pola itu
 * tidak akan muncul di daftar slot.
 */
const ID_LOGGER = 30003;
const NAMA_LOGGER = "ADR Politeknik PU (contoh)";
const NAMA_LOKASI = "Politeknik PU Semarang (contoh)";

// Lokasi contoh: area Politeknik PU, Semarang. UTM zona 49, hemisfer selatan.
const PUSAT_LAT = -7.0512;
const PUSAT_LNG = 110.4381;
const UTM_ZONE = 49;
const UTM_NORTH = false;

// ─── Konversi Lat/Lng → UTM ─────────────────────────────────────────────────
// Kebalikan dari utm2ll() di src/lib/coordinates.ts. Dipakai supaya koordinat
// contoh benar-benar konsisten dengan center peta, bukan angka asal.

function ll2utm(lat: number, lon: number, zone: number, northern: boolean) {
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const e2 = 2 * f - f * f;
  const k0 = 0.9996;
  const ep2 = e2 / (1 - e2);

  const rad = Math.PI / 180;
  const phi = lat * rad;
  const lambda = lon * rad;
  const lambda0 = ((zone - 1) * 6 - 180 + 3) * rad;

  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const T = Math.tan(phi) ** 2;
  const C = ep2 * Math.cos(phi) ** 2;
  const A = Math.cos(phi) * (lambda - lambda0);

  const M =
    a *
    ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * phi -
      ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * phi) +
      ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * phi));

  const easting =
    k0 *
      N *
      (A +
        ((1 - T + C) * A ** 3) / 6 +
        ((5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5) / 120) +
    500000.0;

  let northing =
    k0 *
    (M +
      N *
        Math.tan(phi) *
        (A ** 2 / 2 +
          ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 +
          ((61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6) / 720));

  if (!northern) northing += 10000000.0;

  return { E: easting, N: northing };
}

// ─── Definisi prisma contoh ─────────────────────────────────────────────────
// `d*`    : offset awal dalam meter dari titik RTS — mengatur sebaran di peta.
// `laju*` : pergeseran per sesi dalam METER. Nilainya sengaja dipilih supaya
//           total setelah 5 sesi jatuh di level status yang berbeda-beda
//           (ambang site ini: 50 / 100 / 200 mm), jadi demo-nya menampilkan
//           Normal sampai Siaga, bukan semuanya "Awas".

const PRISMA_CONTOH = [
  // ±1,6 mm/sesi → ~8 mm total  → Normal
  { id: "P1", nama: "PPU_Lereng_Utara", dE: 42, dN: 68, dZ: 6.4, lajuE: 0.0010, lajuN: 0.0012, lajuZ: -0.0003 },
  // ±15 mm/sesi → ~75 mm total  → Waspada
  { id: "P2", nama: "PPU_Lereng_Timur", dE: 96, dN: 24, dZ: 4.1, lajuE: 0.0120, lajuN: 0.0090, lajuZ: -0.0040 },
  // ±33 mm/sesi → ~165 mm total → Siaga
  { id: "P3", nama: "PPU_Crest_Selatan", dE: 18, dN: -55, dZ: 9.2, lajuE: -0.0200, lajuN: -0.0262, lajuZ: 0.0050 },
  // titik referensi — diam
  { id: "P4", nama: "PPU_Referensi", dE: -74, dN: -12, dZ: 2.8, lajuE: 0, lajuN: 0, lajuZ: 0 },
  // ±48 mm/sesi → ~240 mm total → Awas, sekaligus melewati ambang kecepatan (40 mm/hari)
  { id: "P5", nama: "PPU_Retakan_Barat", dE: -38, dN: 51, dZ: 7.6, lajuE: -0.0384, lajuN: 0.0288, lajuZ: -0.0090 },
];

/**
 * 6 sesi tersebar 2 sesi per hari selama 3 hari. Dua sesi dalam hari yang sama
 * diperlukan supaya kecepatan harian (mm/hari) bisa dihitung — kalau tiap hari
 * cuma satu sesi, selisih dalam hari itu selalu nol dan status kecepatannya
 * selalu Normal.
 */
const SESI_PER_HARI = 2;
const JUMLAH_HARI = 3;
const JUMLAH_SESI = SESI_PER_HARI * JUMLAH_HARI;
const JAM_SESI = [8, 16];
const TANGGAL_ACUAN = new Date("2026-08-20T00:00:00");

/** Derajat/menit/detik gaya RTS, format "DDD,MM,SS". */
function sudutDMS(deg: number): string {
  const d = Math.floor(deg);
  const m = Math.floor((deg - d) * 60);
  const s = Math.floor(((deg - d) * 60 - m) * 60);
  return `${String(d).padStart(3, "0")},${String(m).padStart(2, "0")},${String(s).padStart(2, "0")}`;
}

async function hapus() {
  console.log(`🧹 Menghapus data contoh ${SLUG}...`);
  const logs = await prisma.$queryRaw<Array<{ id_log: string }>>`
    SELECT id_log FROM log_kontrol WHERE site = ${SLUG}
  `;
  const ids = logs.map((l) => l.id_log);

  if (ids.length > 0) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM rts WHERE id_kontrol IN (${ids.map(() => "?").join(",")})`,
      ...ids
    );
    await prisma.$executeRaw`DELETE FROM log_kontrol WHERE site = ${SLUG}`;
  }
  const idPrisma = PRISMA_CONTOH.map((p) => p.id);
  await prisma.$executeRawUnsafe(
    `DELETE FROM temp_prisma WHERE site = ? AND id_prisma IN (${idPrisma.map(() => "?").join(",")})`,
    SLUG,
    ...idPrisma
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM t_prisma WHERE site = ? AND id_prisma IN (${idPrisma.map(() => "?").join(",")})`,
    SLUG,
    ...idPrisma
  );
  await prisma.$executeRaw`DELETE FROM parameter_prisma WHERE site = ${SLUG}`;
  await prisma.$executeRaw`DELETE FROM t_logger WHERE id_logger = ${String(ID_LOGGER)}`;
  await prisma.$executeRaw`DELETE FROM t_lokasi WHERE nama_lokasi = ${NAMA_LOKASI}`;
  console.log(`  ${ids.length} sesi + ${idPrisma.length} prisma + logger ${ID_LOGGER} dihapus.`);
  console.log(`  Site "${SLUG}" sendiri tidak dihapus — kosongkan koordinatnya lewat Master Data bila perlu.`);
}

async function buat() {
  const rts = ll2utm(PUSAT_LAT, PUSAT_LNG, UTM_ZONE, UTM_NORTH);
  console.log(`🌱 Membuat data CONTOH untuk ${SLUG}`);
  console.log(`   RTS  : E ${rts.E.toFixed(3)}  N ${rts.N.toFixed(3)}  (zona ${UTM_ZONE}${UTM_NORTH ? "N" : "S"})`);
  console.log(`   Peta : ${PUSAT_LAT}, ${PUSAT_LNG}`);

  // ── 1. Update site: isi koordinat contoh, tandai data_dummy ──
  await prisma.site.update({
    where: { slug: SLUG },
    data: {
      rts_e: Number(rts.E.toFixed(3)),
      rts_n: Number(rts.N.toFixed(3)),
      rts_z: 78.5,
      utm_zone: UTM_ZONE,
      utm_north: UTM_NORTH,
      map_lat: PUSAT_LAT,
      map_lng: PUSAT_LNG,
      map_zoom: 17,
      terkalibrasi: true,
      data_dummy: true,
      catatan:
        "DATA CONTOH — seluruh koordinat, elevasi, dan ambang di site ini karangan " +
        "untuk keperluan demo, bukan hasil survei. Ganti dengan angka sebenarnya " +
        "lalu hapus centang 'Data contoh'. Dibuat oleh prisma/seed-dummy-politeknik.ts.",
    },
  });
  console.log("  ✓ t_site diperbarui (ditandai data contoh)");

  // ── 2. Lokasi + logger khusus site ini ──
  const lokasiAda = await prisma.lokasi.findFirst({ where: { nama_lokasi: NAMA_LOKASI } });
  const lokasi =
    lokasiAda ??
    (await prisma.lokasi.create({
      data: {
        nama_lokasi: NAMA_LOKASI,
        latitude: String(PUSAT_LAT),
        longitude: String(PUSAT_LNG),
      },
    }));

  await prisma.$executeRaw`
    INSERT INTO t_logger (id_logger, nama_logger, lokasi_logger, kategori_log, tabel)
    VALUES (${String(ID_LOGGER)}, ${NAMA_LOGGER}, ${String(lokasi.idlokasi)}, '1', 'rts')
    ON DUPLICATE KEY UPDATE nama_logger = VALUES(nama_logger), lokasi_logger = VALUES(lokasi_logger)
  `;
  console.log(`  ✓ lokasi + logger ${ID_LOGGER} dibuat`);

  // ── 3. Prisma ──
  for (const p of PRISMA_CONTOH) {
    await prisma.$executeRaw`
      INSERT INTO t_prisma (id_prisma, id_logger, nama_prisma, status_controller, target_height, HA, VA, SlopDis, site)
      VALUES (${p.id}, ${ID_LOGGER}, ${p.nama}, 'sensor9', 0, '000,00,00', '000,00,00', 0, ${SLUG})
      ON DUPLICATE KEY UPDATE nama_prisma = VALUES(nama_prisma)
    `;
    // Sengaja TIDAK membuat baris temp_prisma. Tabel itu menyimpan status live
    // sesi yang sedang berjalan dan tidak punya kolom logger/site, sehingga
    // /api/prisma-data mengembalikannya secara global — baris contoh di sana
    // akan bocor ke panel Kontrol ADR milik site lain.
    await prisma.$executeRaw`
      DELETE FROM temp_prisma WHERE id_prisma = ${p.id} AND site = ${SLUG}
    `;
  }
  console.log(`  ✓ ${PRISMA_CONTOH.length} prisma dibuat`);

  // ── 4. Sesi pengukuran + pembacaan RTS ──
  let jumlahRts = 0;
  for (let sesi = 0; sesi < JUMLAH_SESI; sesi++) {
    const hariKe = Math.floor(sesi / SESI_PER_HARI);
    const waktu = new Date(TANGGAL_ACUAN);
    waktu.setDate(waktu.getDate() - (JUMLAH_HARI - 1 - hariKe));
    waktu.setHours(JAM_SESI[sesi % SESI_PER_HARI], 0, 0, 0);

    const idLog = `PPU${String(sesi + 1).padStart(5, "0")}`;
    const r0 = sesi === 0 ? 1 : 0; // sesi pertama = baseline

    await prisma.$executeRaw`
      DELETE FROM log_kontrol WHERE id_log = ${idLog}
    `;
    await prisma.$executeRaw`
      INSERT INTO log_kontrol (id_log, id_logger, prisma, datetime, r0, site)
      VALUES (${idLog}, ${String(ID_LOGGER)}, ${String(PRISMA_CONTOH.length)}, ${waktu}, ${r0}, ${SLUG})
    `;
    await prisma.$executeRaw`DELETE FROM rts WHERE id_kontrol = ${idLog}`;

    for (const p of PRISMA_CONTOH) {
      // Posisi awal + pergeseran linear seiring sesi (laju dalam meter/sesi).
      const E = rts.E + p.dE + p.lajuE * sesi;
      const N = rts.N + p.dN + p.lajuN * sesi;
      const Z = 78.5 + p.dZ + p.lajuZ * sesi;

      const dE = E - rts.E;
      const dN = N - rts.N;
      const jarakDatar = Math.sqrt(dE * dE + dN * dN);
      const jarakMiring = Math.sqrt(jarakDatar * jarakDatar + (Z - 78.5) ** 2);
      const bearing = ((Math.atan2(dE, dN) * 180) / Math.PI + 360) % 360;
      const vertikal = 90 - (Math.atan2(Z - 78.5, jarakDatar) * 180) / Math.PI;

      const waktuBaris = new Date(waktu);
      waktuBaris.setMinutes(waktuBaris.getMinutes() + PRISMA_CONTOH.indexOf(p) * 2);

      await prisma.$executeRaw`
        INSERT INTO rts (
          id_kontrol, code_logger, waktu,
          sensor1, sensor2, sensor3, sensor4,
          sensor5, sensor6, sensor7,
          sensor8, sensor9, sensor10,
          sensor11, sensor12, sensor13,
          sensor14, sensor15, sensor16, sensor17, sensor18, sensor19,
          sensor20, sensor21, sensor22, sensor23, sensor24, sensor25
        ) VALUES (
          ${idLog}, ${String(ID_LOGGER)}, ${waktuBaris},
          ${p.id}, '0', ${p.nama}, '0',
          ${sudutDMS(bearing)}, ${sudutDMS(vertikal)}, ${jarakMiring.toFixed(4)},
          ${N.toFixed(4)}, ${E.toFixed(4)}, ${Z.toFixed(4)},
          ${rts.N.toFixed(3)}, ${rts.E.toFixed(3)}, '78.5',
          0, 1, 1, 1, 0, 20,
          ${Number((42 + sesi * 0.4).toFixed(2))},
          ${Number((12.4 - sesi * 0.05).toFixed(2))},
          ${Number((31.5 + sesi * 0.3).toFixed(2))},
          ${Number((9.1 - sesi * 0.02).toFixed(2))},
          0, 0
        )
      `;
      jumlahRts++;
    }
  }
  console.log(`  ✓ ${JUMLAH_SESI} sesi, ${jumlahRts} baris pembacaan RTS`);
  console.log(`\n⚠ Site "${SLUG}" ditandai DATA CONTOH — peringatan akan muncul di seluruh aplikasi.`);
}

async function main() {
  if (process.argv.includes("--hapus")) await hapus();
  else await buat();
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
