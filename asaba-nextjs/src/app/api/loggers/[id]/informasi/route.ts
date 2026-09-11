import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/loggers/[id]/informasi
 * Fetch logger info from t_informasi + t_logger (for id_logger & nama_logger).
 *
 * `nama_lokasi` ada di t_lokasi, BUKAN di t_logger — yang disimpan t_logger
 * hanya `lokasi_logger`, yaitu idlokasi-nya. Tanpa JOIN di bawah, MySQL menolak
 * seluruh query dengan `Unknown column 'l.nama_lokasi'` dan endpoint ini balas
 * 500 setiap kali dipanggil.
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
        lok.nama_lokasi,
        inf.seri,
        inf.sensor,
        inf.serial_number,
        inf.nosell,
        inf.imei,
        inf.tgl_kontrak,
        inf.tgl_aktif,
        inf.garansi
      FROM t_logger l
      LEFT JOIN t_lokasi lok ON l.lokasi_logger = lok.idlokasi
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
