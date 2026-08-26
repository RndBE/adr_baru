import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { nfloat, fmt, rotateEN, arah8ID, utm2ll } from "@/lib/coordinates";
import {
  getSite,
  statusPergeseran,
  statusKecepatan,
  type SiteConfig,
} from "@/lib/sites";

/**
 * Peringatan yang harus terlihat operator. Angka deformasi dari site yang
 * belum dikalibrasi tetap dihitung, tapi tidak boleh dianggap sahih — jadi
 * peringatannya ikut di response, bukan hanya di log server.
 */
function buildPeringatan(site: SiteConfig): string[] {
  const pesan: string[] = [];
  if (site.tidakDikenal) {
    pesan.push(
      `Site "${site.slug}" belum terdaftar di Master Data → Site. ` +
        `Perhitungan memakai ambang default paling ketat dan tanpa koreksi rotasi.`
    );
  } else if (!site.terkalibrasi) {
    pesan.push(
      `Site "${site.nama}" belum dikalibrasi — koordinat referensi RTS dan/atau ` +
        `center peta belum diisi. Nilai pergeseran belum bisa dianggap sahih.`
    );
  } else if (site.dataDummy) {
    // Field-nya lengkap, tapi isinya nilai contoh — tanpa peringatan ini
    // angkanya akan terlihat sama meyakinkannya dengan site yang benar-benar disurvei.
    pesan.push(
      `Site "${site.nama}" memakai DATA CONTOH. Koordinat referensi dan ambang ` +
        `bahayanya belum berasal dari survei, jadi angka pergeseran di sini hanya ` +
        `untuk demo dan tidak boleh dipakai mengambil keputusan.`
    );
  }
  return pesan;
}

/**
 * GET /api/deformasi?id_log=XXXX
 * Calculate deformation data for a specific log_kontrol entry.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idLog = searchParams.get("id_log");

    if (!idLog) {
      return NextResponse.json(
        { success: false, error: "id_log parameter is required" },
        { status: 400 }
      );
    }

    // Get the log entry
    const log = await prisma.logKontrol.findUnique({
      where: { id_log: idLog },
    });

    if (!log) {
      return NextResponse.json(
        { success: false, error: "id_log tidak ditemukan" },
        { status: 404 }
      );
    }

    const site = log.site || "unknown";
    const datetime = log.datetime?.toISOString() || new Date().toISOString();
    const siteConfig = await getSite(site);
    // null bila site belum dikalibrasi — jangan diganti 0, karena 0 terlihat
    // seperti koordinat sah dan menghasilkan pergeseran raksasa yang palsu.
    const lokasiRts = siteConfig.rts;

    // Get first log (r0=1 or earliest) for baseline
    let logFirst = await prisma.logKontrol.findFirst({
      where: { site, r0: 1 },
    });
    if (!logFirst) {
      logFirst = await prisma.logKontrol.findFirst({
        where: { site },
        orderBy: { datetime: "asc" },
      });
    }
    const firstLogId = logFirst?.id_log || idLog;

    // Get daily logs
    const dt = log.datetime;
    const dailyLogs = await prisma.$queryRaw<Array<{id_log: string}>>`
      SELECT id_log FROM log_kontrol 
      WHERE site = ${site} 
      AND DATE(datetime) = DATE(${dt})
    `;
    const dailyLogIds = dailyLogs.map(l => l.id_log);

    // Prisma milik SITE ini. Sebelumnya diambil per logger dengan menelusuri
    // semua logger di t_prisma, padahal satu logger bisa melayani lebih dari
    // satu site — jadi prisma site lain ikut terbawa dan baru tersaring secara
    // kebetulan karena tidak punya baris `rts` di sesi ini.
    const prisms = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT p.*
      FROM t_prisma p
      WHERE p.site = ${site}
      ORDER BY p.id_prisma
    `;

    const dataPengukuran: Array<Record<string, unknown>> = [];

    {
      for (const p of prisms) {
        const idPrisma = p.id_prisma as string;
        if (!idPrisma) continue;
        const idLogger = Number(p.id_logger);

        // Current measurement
        const cekTembak = await prisma.$queryRaw<Array<Record<string, unknown>>>`
          SELECT * FROM rts 
          WHERE id_kontrol = ${idLog} AND sensor1 = ${idPrisma}
          LIMIT 1
        `;

        // Baseline measurement
        const firstData = await prisma.$queryRaw<Array<Record<string, unknown>>>`
          SELECT * FROM rts 
          WHERE id_kontrol = ${firstLogId} AND sensor1 = ${idPrisma}
          ORDER BY waktu ASC LIMIT 1
        `;

        if (!cekTembak?.[0] || !firstData?.[0]) continue;

        const current = cekTembak[0];
        const baseline = firstData[0];

        let N1 = nfloat(current.sensor8);
        let E1 = nfloat(current.sensor9);
        const Z1 = nfloat(current.sensor10);

        let N0 = nfloat(baseline.sensor8);
        let E0 = nfloat(baseline.sensor9);
        const Z0 = nfloat(baseline.sensor10);

        // Save raw UTM (before rotation) for map display
        const rawE0 = E0; const rawN0 = N0;
        const rawE1 = E1; const rawN1 = N1;

        // Koreksi rotasi — hanya untuk site yang memang punya parameternya.
        if (siteConfig.rotation) {
          const [rE1, rN1] = rotateEN(E1, N1, siteConfig.rotation);
          E1 = rE1;
          N1 = rN1;
          const [rE0, rN0] = rotateEN(E0, N0, siteConfig.rotation);
          E0 = rE0;
          N0 = rN0;
        }

        // Compute map lat/lon using the SAME logic as PHP utm2ll().
        // Zona UTM per site — jangan diasumsikan semua site di Zone 50 North.
        let mapLat0: number | null = null, mapLon0: number | null = null;
        let mapLat1: number | null = null, mapLon1: number | null = null;
        const mapZone  = siteConfig.utm.zone;
        const mapNorth = siteConfig.utm.north;
        if (E0 !== 0 || N0 !== 0) {
          const ll0 = utm2ll(E0, N0, mapZone, mapNorth);
          mapLat0 = ll0.lat; mapLon0 = ll0.lon;
        }
        if (E1 !== 0 || N1 !== 0) {
          const ll1 = utm2ll(E1, N1, mapZone, mapNorth);
          mapLat1 = ll1.lat; mapLon1 = ll1.lon;
        }

        const valid1 = N1 !== 0 || E1 !== 0 || Z1 !== 0;
        const valid0 = N0 !== 0 || E0 !== 0 || Z0 !== 0;

        let DN = 0, DE = 0, DZ = 0, linier3d = 0, linier2d = 0;
        if (valid1 && valid0) {
          DN = N1 - N0;
          DE = E1 - E0;
          DZ = Z1 - Z0;
          linier3d = Math.sqrt(DE * DE + DN * DN + DZ * DZ);
          linier2d = Math.sqrt(DE * DE + DN * DN);
        }

        let arah = "-";
        if (linier2d > 0) {
          const tmp = arah8ID(DE, DN);
          arah = `${tmp.bearing.toFixed(2)} (${tmp.arah_id})`;
        }

        const namaPrisma =
          (current.sensor3 as string) ||
          (p.nama_prisma as string) ||
          "";

        const entry: Record<string, any> = {
          id_prisma: idPrisma,
          nama_prisma: namaPrisma,
          id_logger: idLogger,
          waktu: current.waktu || datetime,
          temp_tembak: {
            nama_prisma: namaPrisma,
            N0, E0, Z0,
            HA0: baseline.sensor5 || "",
            VA0: baseline.sensor6 || "",
            SD0: baseline.sensor7 || "",
            N1, E1, Z1,
            HA1: current.sensor5 || "",
            VA1: current.sensor6 || "",
            SD1: current.sensor7 || "",
            DN: fmt(DN, 6),
            DE: fmt(DE, 6),
            DZ: fmt(DZ, 6),
            linear: linier3d,
            arah_pergeseran: arah,
            // Raw UTM coords for map (before rotation)
            raw_E0: rawE0, raw_N0: rawN0,
            raw_E1: rawE1, raw_N1: rawN1,
            // Computed Lat/Lon for map (using same utm2ll as PHP)
            map_lat0: mapLat0, map_lon0: mapLon0,
            map_lat1: mapLat1, map_lon1: mapLon1,
          },
          daily: {
            count: 0,
            first_time: null,
            last_time: null,
            pergeseran_mm: null,
            kecepatan_mmd: null,
            status_pergeseran: null,
            status_kecepatan: null,
            series: []
          }
        };

        // Calculate daily logic
        const base_ok = !(Math.abs(E0) < 1e-12 && Math.abs(N0) < 1e-12 && Math.abs(Z0) < 1e-12);
        if (base_ok && dailyLogIds.length > 0) {
          const dailyRows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
            SELECT waktu, sensor8, sensor9, sensor10 
            FROM rts 
            WHERE code_logger = ${idLogger}
              AND sensor1 = ${idPrisma}
              AND id_kontrol IN (${Prisma.join(dailyLogIds)}) 
            ORDER BY waktu ASC
          `;

          let first_lin: number | null = null;
          let last_lin: number | null = null;
          let first_time: string | null = null;
          let last_time: string | null = null;
          const series: Array<{t: string, mm: number}> = [];

          for (const rw of dailyRows) {
            let e1_d = nfloat(rw.sensor9);
            let n1_d = nfloat(rw.sensor8);
            const z1_d = nfloat(rw.sensor10);

            if (Math.abs(e1_d) < 1e-12 && Math.abs(n1_d) < 1e-12 && Math.abs(z1_d) < 1e-12) {
              continue;
            }

            if (siteConfig.rotation) {
              const [e1r_d, n1r_d] = rotateEN(e1_d, n1_d, siteConfig.rotation);
              e1_d = e1r_d;
              n1_d = n1r_d;
            }

            const lin_m = Math.sqrt(Math.pow(e1_d - E0, 2) + Math.pow(n1_d - N0, 2));

            const wkt = String(rw.waktu);
            if (first_lin === null) {
              first_lin = lin_m;
              first_time = wkt;
            }
            last_lin = lin_m;
            last_time = wkt;
            series.push({
              t: wkt,
              mm: lin_m * 1000.0
            });
          }

          if (first_lin !== null && last_lin !== null) {
            const pergeseran_mm = last_lin * 1000.0;
            const delta_mm = Math.abs(last_lin - first_lin) * 1000.0;
            const kecepatan_mmd = delta_mm;

            entry.daily = {
              count: dailyRows.length,
              first_time,
              last_time,
              pergeseran_mm,
              kecepatan_mmd,
              status_pergeseran: statusPergeseran(pergeseran_mm, siteConfig),
              status_kecepatan: statusKecepatan(kecepatan_mmd, siteConfig),
              series
            };
          }
        }

        dataPengukuran.push(entry);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        tanggal: datetime,
        posisi_rts: lokasiRts,
        data_pengukuran: dataPengukuran,
        site: {
          slug: siteConfig.slug,
          nama: siteConfig.nama,
          badge_label: siteConfig.badgeLabel,
          badge_color: siteConfig.badgeColor,
          map: siteConfig.map,
          terkalibrasi: siteConfig.terkalibrasi,
          data_dummy: siteConfig.dataDummy,
          tidak_dikenal: siteConfig.tidakDikenal,
        },
        // Peringatan yang harus ditampilkan di UI, bukan sekadar log server.
        peringatan: buildPeringatan(siteConfig),
      },
    });
  } catch (error) {
    console.error("[GET /api/deformasi] Detail error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to calculate deformation",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
