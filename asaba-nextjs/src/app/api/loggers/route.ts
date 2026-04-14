import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/loggers
 * List all loggers with location and category info.
 * Replaces CI3 Beranda::index() logger queries.
 */
export async function GET() {
  try {
    const loggers = await prisma.$queryRaw`
      SELECT 
        l.id, l.id_logger, l.nama_logger, l.lokasi_logger, l.kategori_log, l.tabel,
        lok.nama_lokasi, lok.latitude, lok.longitude,
        kl.nama_kategori, kl.kepanjangan, kl.temp_data, kl.icon_app,
        inf.seri, inf.serial_number, inf.masa_aktif, inf.nosell
      FROM t_logger l
      LEFT JOIN t_lokasi lok ON l.lokasi_logger = lok.idlokasi
      LEFT JOIN kategori_logger kl ON l.kategori_log = kl.id_katlogger
      LEFT JOIN t_informasi inf ON inf.logger_id = l.id_logger
      ORDER BY l.id_logger
    `;

    return NextResponse.json({ success: true, data: loggers });
  } catch (error) {
    console.error("[GET /api/loggers]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch loggers" },
      { status: 500 }
    );
  }
}
