/**
 * Backfill kolom `site` pada t_prisma / temp_prisma / parameter_prisma,
 * lalu pasang unique key (site, id_prisma).
 *
 * Idempoten — aman dijalankan berulang.
 *
 * Selain mengisi kolom baru, script ini juga MELENGKAPI t_prisma. Sebelumnya
 * tabel itu cuma berisi P1 dan P2 (milik CCP), padahal data pengukuran memuat
 * P1–P10 untuk CCP dan P1–P8 untuk Viewpoint. Akibatnya Viewpoint sama sekali
 * tidak punya definisi prisma dan diam-diam "meminjam" milik CCP. Baris yang
 * hilang direkonstruksi dari tabel `rts`, yang tiap barisnya sudah terikat ke
 * sesi (`id_kontrol`) dan karenanya ke site — jadi sumbernya tidak ambigu.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Parameter standar tiap prisma: Northing, Easting, Elevation. */
const PARAM_STANDAR = [
  { nama: "Northing_Y", kolom: "sensor8", icon: "northing" },
  { nama: "Easting_X", kolom: "sensor9", icon: "easting" },
  { nama: "Elevation", kolom: "sensor10", icon: "elevation_z" },
];

async function main() {
  console.log("🔧 Backfill site pada tabel prisma\n");

  // ── 1. t_prisma: tentukan site dari logger pemiliknya ─────────────────────
  // Baris lama semuanya milik logger 30002 (CCP) — sudah benar lewat default.
  // Logger 30003 dibuat khusus untuk Politeknik PU.
  const perLogger = await prisma.$queryRaw<Array<{ id_logger: number; site: string | null }>>`
    SELECT DISTINCT lk.id_logger + 0 AS id_logger, lk.site
    FROM log_kontrol lk
    WHERE lk.site IS NOT NULL
  `;
  // Logger yang hanya melayani SATU site bisa dipetakan langsung.
  const siteDariLogger = new Map<number, Set<string>>();
  for (const r of perLogger) {
    if (!r.site) continue;
    if (!siteDariLogger.has(r.id_logger)) siteDariLogger.set(r.id_logger, new Set());
    siteDariLogger.get(r.id_logger)!.add(r.site);
  }
  for (const [idLogger, sites] of siteDariLogger) {
    if (sites.size !== 1) {
      console.log(
        `  logger ${idLogger}: melayani ${sites.size} site (${[...sites].join(", ")}) — ` +
          `tidak bisa dipetakan otomatis, baris t_prisma-nya dibiarkan di default.`
      );
      continue;
    }
    const site = [...sites][0];
    const n = await prisma.$executeRaw`
      UPDATE t_prisma SET site = ${site} WHERE id_logger = ${idLogger} AND site = 'ccp'
    `;
    if (n > 0) console.log(`  logger ${idLogger} → site "${site}" (${n} baris t_prisma)`);
  }

  // ── 2. Lengkapi t_prisma dari data pengukuran ─────────────────────────────
  const dariRts = await prisma.$queryRaw<
    Array<{ site: string; id_prisma: string; id_logger: number; nama: string }>
  >`
    SELECT lk.site,
           r.sensor1               AS id_prisma,
           MIN(r.code_logger + 0)  AS id_logger,
           SUBSTRING_INDEX(GROUP_CONCAT(r.sensor3 ORDER BY r.waktu DESC), ',', 1) AS nama
    FROM rts r
    JOIN log_kontrol lk ON lk.id_log = r.id_kontrol
    WHERE lk.site IS NOT NULL
      AND r.sensor1 <> ''
      AND r.sensor1 <> '0'
    GROUP BY lk.site, r.sensor1
  `;

  let dibuat = 0;
  for (const p of dariRts) {
    const ada = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*) AS n FROM t_prisma WHERE site = ${p.site} AND id_prisma = ${p.id_prisma}
    `;
    if (Number(ada[0].n) > 0) continue;

    await prisma.$executeRaw`
      INSERT INTO t_prisma (id_prisma, id_logger, nama_prisma, status_controller, target_height, HA, VA, SlopDis, site)
      VALUES (${p.id_prisma}, ${p.id_logger}, ${p.nama || p.id_prisma}, 'sensor9', 0, '000,00,00', '000,00,00', 0, ${p.site})
    `;
    dibuat++;
  }
  console.log(`  ${dibuat} baris t_prisma dilengkapi dari data pengukuran`);

  // ── 3. temp_prisma: samakan site dengan t_prisma ──────────────────────────
  // Baris temp_prisma yang ada (P1, P2) koordinatnya di rentang CCP, jadi
  // default 'ccp' sudah tepat. Yang perlu dipastikan: tiap prisma punya satu
  // baris temp per site, supaya status live tidak saling menimpa antar site.
  const semuaPrisma = await prisma.$queryRaw<Array<{ site: string; id_prisma: string }>>`
    SELECT site, id_prisma FROM t_prisma
  `;
  let tempDibuat = 0;
  for (const p of semuaPrisma) {
    const ada = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*) AS n FROM temp_prisma WHERE site = ${p.site} AND id_prisma = ${p.id_prisma}
    `;
    if (Number(ada[0].n) > 0) continue;
    await prisma.$executeRaw`
      INSERT INTO temp_prisma (id_prisma, waktu, N1, E1, Z1, N0, E0, Z0, status_get, HA, VA, SlopDis, site)
      VALUES (${p.id_prisma}, '-', '0', '0', '0', '0', '0', '0', 0, 0, 0, 0, ${p.site})
    `;
    tempDibuat++;
  }
  console.log(`  ${tempDibuat} baris temp_prisma dibuat`);

  // ── 4. parameter_prisma: pastikan tiap (site, prisma) punya 3 parameter ───
  let paramDibuat = 0;
  for (const p of semuaPrisma) {
    for (const par of PARAM_STANDAR) {
      const ada = await prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT COUNT(*) AS n FROM parameter_prisma
        WHERE site = ${p.site} AND id_prisma = ${p.id_prisma} AND nama_parameter = ${par.nama}
      `;
      if (Number(ada[0].n) > 0) continue;
      await prisma.$executeRaw`
        INSERT INTO parameter_prisma (id_prisma, nama_parameter, kolom_sensor, satuan, analisa, tipe_graf, icon_sensor, site)
        VALUES (${p.id_prisma}, ${par.nama}, ${par.kolom}, '', 1, 'spline', ${par.icon}, ${p.site})
      `;
      paramDibuat++;
    }
  }
  console.log(`  ${paramDibuat} baris parameter_prisma dibuat`);

  // ── 5. Unique key — dipasang SETELAH backfill supaya tidak menolak data ──
  for (const [tabel, indeks] of [
    ["t_prisma", "t_prisma_site_id_prisma_key"],
    ["temp_prisma", "temp_prisma_site_id_prisma_key"],
  ] as const) {
    const sudahAda = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SHOW INDEX FROM \`${tabel}\` WHERE Key_name = ?`,
      indeks
    );
    if (sudahAda.length > 0) {
      console.log(`  index ${indeks} sudah ada`);
      continue;
    }
    const duplikat = await prisma.$queryRawUnsafe<Array<{ site: string; id_prisma: string; n: bigint }>>(
      `SELECT site, id_prisma, COUNT(*) AS n FROM \`${tabel}\` GROUP BY site, id_prisma HAVING n > 1`
    );
    if (duplikat.length > 0) {
      console.error(
        `  ✗ ${tabel}: ada ${duplikat.length} kombinasi (site, id_prisma) ganda — ` +
          `index unik tidak dipasang. Bersihkan dulu:`,
        duplikat.slice(0, 5)
      );
      continue;
    }
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX \`${indeks}\` ON \`${tabel}\`(\`site\`, \`id_prisma\`)`
    );
    console.log(`  ✓ index unik ${indeks} dipasang`);
  }

  // ── Ringkasan ─────────────────────────────────────────────────────────────
  const ringkas = await prisma.$queryRaw<Array<{ site: string; n: bigint }>>`
    SELECT site, COUNT(*) AS n FROM t_prisma GROUP BY site ORDER BY site
  `;
  console.log("\n  Prisma per site:");
  for (const r of ringkas) console.log(`    ${r.site.padEnd(16)} ${Number(r.n)}`);
  console.log("\n✅ Backfill selesai.");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
