import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/loggers/[id]
 * Get logger detail including prisms, latest sensor data, and dashboard info.
 * Replaces CI3 Beranda::index() per-logger detail queries.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idLogger = id;

    // Get logger with location
    const loggers = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT l.*, lok.nama_lokasi, lok.latitude, lok.longitude,
             kl.nama_kategori, kl.temp_data, kl.tabel as kat_tabel
      FROM t_logger l
      LEFT JOIN t_lokasi lok ON l.lokasi_logger = lok.idlokasi
      LEFT JOIN kategori_logger kl ON l.kategori_log = kl.id_katlogger
      WHERE l.id_logger = ${idLogger}
      LIMIT 1
    `;

    if (!loggers || loggers.length === 0) {
      return NextResponse.json(
        { success: false, error: "Logger not found" },
        { status: 404 }
      );
    }

    const logger = loggers[0];

    // Get prisms for this logger
    // temp_prisma uses N1/E1/Z1/N0/E0/Z0 columns (not sensor*)
    const prisms = await prisma.$queryRaw`
      SELECT p.*,
             tp.N1, tp.E1, tp.Z1,
             tp.N0, tp.E0, tp.Z0,
             tp.status_get,
             tp.waktu as tp_waktu
      FROM t_prisma p
      LEFT JOIN temp_prisma tp ON tp.id_prisma = p.id_prisma
      WHERE p.id_logger = ${parseInt(idLogger)}
    `;

    // Get latest temp_rts data — ORDER BY waktu DESC untuk pastikan dapat data terbaru
    const tempData = await prisma.$queryRaw`
      SELECT
        id, code_logger, id_kontrol, waktu,
        sensor1,  sensor2,  sensor3,  sensor4,  sensor5,
        sensor6,  sensor7,  sensor8,  sensor9,  sensor10,
        sensor11, sensor12, sensor13, sensor14, sensor15,
        sensor16, sensor17, sensor18, sensor19, sensor20,
        sensor21, sensor22, sensor23
      FROM temp_rts
      WHERE code_logger = ${idLogger}
      ORDER BY waktu DESC, id DESC
      LIMIT 1
    `;

    // Get sensor parameters — raw query to avoid schema mismatch
    let parameters: any[] = [];
    try {
      parameters = await prisma.$queryRaw`
        SELECT * FROM parameter_sensor WHERE logger_id = ${idLogger}
      `;
    } catch (_) { /* tabel mungkin kosong atau kolom berbeda */ }

    // Get ADR config — raw query to avoid schema mismatch
    let config: any = null;
    try {
      const configRows = await prisma.$queryRaw<any[]>`
        SELECT * FROM config_adr WHERE id_logger = ${parseInt(idLogger)} LIMIT 1
      `;
      config = configRows?.[0] ?? null;
    } catch (_) { /* opsional */ }

    return NextResponse.json({
      success: true,
      data: {
        logger,
        prisms,
        tempData,
        parameters,
        config,
      },
    });
  } catch (error) {
    console.error("[GET /api/loggers/:id] error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch logger detail",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
