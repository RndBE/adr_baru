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
    const prisms = await prisma.$queryRaw`
      SELECT p.*, tp.sensor1 as tp_sensor1, tp.sensor2 as tp_sensor2,
             tp.sensor3 as tp_sensor3, tp.sensor4 as tp_sensor4,
             tp.sensor5 as tp_sensor5, tp.sensor6 as tp_sensor6,
             tp.sensor7 as tp_sensor7, tp.sensor8 as tp_sensor8,
             tp.sensor9 as tp_sensor9, tp.nama as tp_nama,
             tp.status_get
      FROM t_prisma p
      LEFT JOIN temp_prisma tp ON tp.id_prisma = p.id_prisma
      WHERE p.id_logger = ${parseInt(idLogger)}
    `;

    // Get latest temp data
    const tempData = await prisma.$queryRaw`
      SELECT * FROM temp_rts WHERE code_logger = ${idLogger} LIMIT 1
    `;

    // Get sensor parameters
    const parameters = await prisma.parameterSensor.findMany({
      where: { logger_id: idLogger },
    });

    // Get ADR config
    const config = await prisma.configAdr.findFirst({
      where: { id_logger: parseInt(idLogger) },
    });

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
    console.error("[GET /api/loggers/:id]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch logger detail" },
      { status: 500 }
    );
  }
}
