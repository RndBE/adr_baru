import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nfloat, fmt, rotateEN, arah8ID } from "@/lib/coordinates";
import { getRtsBySite } from "@/lib/deformasi";

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
    const lokasiRts = getRtsBySite(site);

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

    // Get all distinct logger IDs from t_prisma
    const rtsLoggerIds = await prisma.$queryRaw<Array<{ id_logger: number }>>`
      SELECT DISTINCT id_logger FROM t_prisma
    `;

    const dataPengukuran: Array<Record<string, unknown>> = [];

    for (const lg of rtsLoggerIds) {
      const idLogger = Number(lg.id_logger);

      // Get prisms — select only from t_prisma (no JOIN to temp_prisma)
      const prisms = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT p.*
        FROM t_prisma p
        WHERE p.id_logger = ${idLogger}
      `;

      for (const p of prisms) {
        const idPrisma = p.id_prisma as string;
        if (!idPrisma) continue;

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

        // Apply rotation for CCP site
        if (site === "ccp") {
          const [rE1, rN1] = rotateEN(E1, N1, 114);
          E1 = rE1;
          N1 = rN1;
          const [rE0, rN0] = rotateEN(E0, N0, 114);
          E0 = rE0;
          N0 = rN0;
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

        dataPengukuran.push({
          id_prisma: idPrisma,
          nama_prisma: namaPrisma,
          id_logger: idLogger,
          waktu: current.waktu || datetime,
          temp_tembak: {
            nama_prisma: namaPrisma,
            N0,
            E0,
            Z0,
            HA0: baseline.sensor5 || "",
            VA0: baseline.sensor6 || "",
            SD0: baseline.sensor7 || "",
            N1,
            E1,
            Z1,
            HA1: current.sensor5 || "",
            VA1: current.sensor6 || "",
            SD1: current.sensor7 || "",
            DN: fmt(DN, 6),
            DE: fmt(DE, 6),
            DZ: fmt(DZ, 6),
            linear: linier3d,
            arah_pergeseran: arah,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        tanggal: datetime,
        posisi_rts: lokasiRts,
        data_pengukuran: dataPengukuran,
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
