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
 * GET /api/mobile/data-terakhir?idlogger=30002&tabel=temp_rts
 * Setara CI3 Api::dtakhir() + pilihparameter()
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idlogger = searchParams.get("idlogger") || "";
    const tabel = searchParams.get("tabel") || "temp_rts";

    if (!idlogger) {
      return NextResponse.json(
        { success: false, error: "idlogger wajib diisi" },
        { status: 400 }
      );
    }

    // Get logger info
    const loggerInfo = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT t_logger.*, t_lokasi.nama_lokasi
      FROM t_logger
      JOIN t_lokasi ON t_logger.lokasi_logger = t_lokasi.idlokasi
      WHERE t_logger.id_logger = ${idlogger}
      LIMIT 1
    `;

    // Get parameters
    const params = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM parameter_sensor WHERE logger_id = ${idlogger}
    `;

    // Get latest data
    let latestData: Record<string, unknown> | null = null;
    try {
      const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT * FROM ${tabel} WHERE code_logger = ? ORDER BY waktu DESC LIMIT 1`,
        idlogger
      );
      latestData = rows?.[0] || null;
    } catch {
      // Table might not exist
    }

    const dataTerakhir = [];

    for (const p of params) {
      const kolom = String(p.kolom_sensor || "");
      let nilai = latestData ? latestData[kolom] : null;

      // Special formatting
      if (p.nama_parameter === "Illumination" && nilai !== null) {
        nilai = Number(nilai) / 1000;
      }
      if (p.nama_parameter !== "Wind_Direction" && nilai !== null && nilai !== undefined) {
        const n = Number(nilai);
        if (!isNaN(n)) nilai = n.toFixed(2);
      }

      dataTerakhir.push({
        idsensor: p.id_param,
        sensor: p.nama_parameter,
        data: nilai ?? "-",
        satuan: p.satuan || "",
        icon: p.icon_sensor || "",
        tipe_graf: p.tipe_graf || "line",
      });
    }

    const waktu = latestData?.waktu || null;

    return NextResponse.json(serializeBigInt({
      nama_logger: loggerInfo?.[0]?.nama_lokasi || "",
      waktu,
      tabel,
      data_terakhir: dataTerakhir,
    }));
  } catch (error) {
    console.error("[GET /api/mobile/data-terakhir]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch data terakhir" },
      { status: 500 }
    );
  }
}
