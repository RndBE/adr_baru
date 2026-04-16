import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/loggers/[id]/informasi
 * Fetch logger info from t_informasi + t_logger (for id_logger & nama_logger).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        l.id_logger,
        l.nama_logger,
        l.nama_lokasi,
        inf.seri,
        inf.sensor,
        inf.serial_number,
        inf.nosell,
        inf.imei,
        inf.tgl_kontrak,
        inf.tgl_aktif,
        inf.garansi
      FROM t_logger l
      LEFT JOIN t_informasi inf ON inf.logger_id = l.id_logger
      WHERE l.id_logger = ${id}
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Logger not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("[GET /api/loggers/:id/informasi]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch logger informasi" },
      { status: 500 }
    );
  }
}
