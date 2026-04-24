import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function serializeBigInt(obj: unknown): unknown {
  if (typeof obj === "bigint") return Number(obj);
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, serializeBigInt(v)])
    );
  }
  return obj;
}

/**
 * GET /api/mobile/info?idlogger=30002
 * Setara CI3 Api::infov2() — info detail logger
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idlogger = searchParams.get("idlogger") || "";

    if (!idlogger) {
      return NextResponse.json(
        { success: false, error: "idlogger wajib diisi" },
        { status: 400 }
      );
    }

    // Get info
    const infoRows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM t_informasi WHERE logger_id = ${idlogger} LIMIT 1
    `;
    const info = infoRows?.[0];
    if (!info) {
      return NextResponse.json({ data: [] });
    }

    // Get logger & category for SD card check
    const loggerRows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT t_logger.*, kategori_logger.temp_data
      FROM t_logger
      JOIN kategori_logger ON kategori_logger.id_katlogger = t_logger.kategori_log
      WHERE t_logger.id_logger = ${idlogger}
      LIMIT 1
    `;
    const logger = loggerRows?.[0];

    let statusSd = "OK";
    let statusSensor = "OK";

    if (logger?.temp_data) {
      try {
        const sdRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
          `SELECT sensor13, sensor12 FROM ${String(logger.temp_data)} WHERE code_logger = ? ORDER BY waktu DESC LIMIT 1`,
          idlogger
        );
        if (sdRows?.[0]) {
          statusSd = String(sdRows[0].sensor13) === "1" ? "OK" : "Terjadi Kesalahan";
          statusSensor = String(sdRows[0].sensor12) === "1" ? "OK" : "Terjadi Kesalahan";
        }
      } catch {
        // Table might not exist
      }
    }

    const dataInfo: Array<{ nama: string; nilai: unknown }> = [
      { nama: "ID Logger", nilai: info.logger_id },
      { nama: "Seri", nilai: info.seri },
      { nama: "Serial Number", nilai: info.serial_number },
      { nama: "Sensor", nilai: info.sensor },
      { nama: "Status SD", nilai: statusSd },
      { nama: "Status Sensor", nilai: statusSensor },
      { nama: "Awal Kontrak", nilai: info.tgl_kontrak },
      { nama: "Akhir Garansi", nilai: info.garansi },
      { nama: "Logger Aktif", nilai: info.tgl_aktif },
    ];

    // Add elevasi if exists
    if (info.elevasi) {
      dataInfo.push({ nama: "Elevasi", nilai: info.elevasi });
    }

    dataInfo.push(
      { nama: "No Seluler", nilai: info.nosell },
      { nama: "IMEI", nilai: info.imei }
    );

    return NextResponse.json(serializeBigInt({ data: dataInfo }));
  } catch (error) {
    console.error("[GET /api/mobile/info]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch info" },
      { status: 500 }
    );
  }
}
