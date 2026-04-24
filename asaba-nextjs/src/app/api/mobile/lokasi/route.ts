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
 * GET /api/mobile/lokasi?kategori_log=1&tabel=temp_rts
 * Setara CI3 Api::lokasi() — list lokasi logger dengan status koneksi
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kategori = searchParams.get("kategori_log") || "";
    const tabel = searchParams.get("tabel") || "temp_rts";

    const whereKat = kategori ? `WHERE kategori_log = '${kategori}'` : "";

    const loggers = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT t_logger.*, t_lokasi.nama_lokasi, t_lokasi.latitude, t_lokasi.longitude
       FROM t_logger
       JOIN t_lokasi ON t_logger.lokasi_logger = t_lokasi.idlokasi
       ${whereKat}
       ORDER BY id_logger ASC`
    );

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
    const result = [];

    for (const lg of loggers) {
      const id_logger = String(lg.id_logger);

      // Check perbaikan
      const perbaikan = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM t_perbaikan WHERE id_logger = ${id_logger} LIMIT 1
      `;

      let status = "Off";
      if (perbaikan && perbaikan.length > 0) {
        status = "Perbaikan";
      } else {
        // Check last data time
        try {
          const lastData = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
            `SELECT waktu FROM ${tabel} WHERE code_logger = ? ORDER BY waktu DESC LIMIT 1`,
            id_logger
          );
          if (lastData?.[0]?.waktu) {
            const waktu = new Date(String(lastData[0].waktu));
            status = waktu >= new Date(oneHourAgo) ? "On" : "Off";
          }
        } catch {
          // Table might not exist
        }
      }

      result.push({
        logger_id: id_logger,
        nama_logger: lg.nama_logger || "",
        lokasi: lg.nama_lokasi || "",
        latitude: lg.latitude || "",
        longitude: lg.longitude || "",
        status,
      });
    }

    return NextResponse.json(serializeBigInt({
      lokasi_first: result[0] || null,
      lokasi: result,
    }));
  } catch (error) {
    console.error("[GET /api/mobile/lokasi]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch lokasi" },
      { status: 500 }
    );
  }
}
