import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


/**
 * GET /api/log-kontrol
 * Ambil riwayat running dari log_kontrol beserta data prisma per sesi.
 * Setara dengan query log_kontrol di Adr::kontrol() CI3.
 *
 * Query params:
 * - limit: jumlah log (default 10, max 100)
 * - site: filter berdasarkan site (optional)
 * - with_prisma: "true"  sertakan data prisma per log (default true)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 100);
    const site = searchParams.get("site");
    const withPrisma = searchParams.get("with_prisma") !== "false";

    // Query log_kontrol
    let logs: Array<Record<string, unknown>> = [];
    if (site) {
      logs = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT id_log, id_logger, datetime, site, r0, prisma
        FROM log_kontrol
        WHERE site = ${site}
        ORDER BY datetime DESC
        LIMIT ${limit}
      `;
    } else {
      logs = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT id_log, id_logger, datetime, site, r0, prisma
        FROM log_kontrol
        ORDER BY datetime DESC
        LIMIT ${limit}
      `;
    }

    // Sertakan data prisma per sesi jika diminta
    let result = logs;
    if (withPrisma && logs.length > 0) {
      result = await Promise.all(
        logs.map(async (lg) => {
          const idLog = lg.id_log as string;
          const rtsData = await prisma.$queryRaw<Array<Record<string, unknown>>>`
            SELECT sensor1 as id_prisma, sensor8 as E, sensor9 as N, sensor10 as Z,
              sensor3 as nama_prisma, waktu
            FROM rts
            WHERE id_kontrol = ${idLog}
          `;

          const data_kirim = (rtsData as Array<Record<string, unknown>>).map((v) => ({
            id_prisma: v.id_prisma,
            nama_prisma: v.nama_prisma,
            E: v.E,
            N: v.N,
            Z: v.Z,
            waktu: v.waktu,
            status:
              v.E !== 0 && v.N !== 0 && v.Z !== 0
                ? "Success"
                : "Failed",
          }));

          return {
            ...lg,
            data_kirim,
            prisma_count: data_kirim.length,
            success_count: data_kirim.filter((d) => d.status === "Success").length,
          };
        })
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
      total: result.length,
    });
  } catch (error) {
    console.error("[GET /api/log-kontrol]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch log kontrol" },
      { status: 500 }
    );
  }
}
