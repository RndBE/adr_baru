import { NextResponse } from "next/server";
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
 * GET /api/mobile/menu
 * Setara CI3 Api::menu() — list menu/kategori logger
 */
export async function GET() {
  try {
    const categories = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM kategori_logger
    `;

    const result = [];

    for (const kat of categories) {
      // Check if this category has loggers
      const loggers = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT id_logger FROM t_logger WHERE kategori_log = ${String(kat.id_katlogger)} LIMIT 1
      `;

      if (loggers && loggers.length > 0) {
        result.push({
          id_kategori: kat.id_katlogger,
          menu: kat.nama_kategori,
          controller: kat.controller,
          tabel: kat.tabel,
          icon: kat.icon_app,
          temp_tabel: kat.temp_data,
        });
      }
    }

    return NextResponse.json(serializeBigInt(result));
  } catch (error) {
    console.error("[GET /api/mobile/menu]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch menu" },
      { status: 500 }
    );
  }
}
