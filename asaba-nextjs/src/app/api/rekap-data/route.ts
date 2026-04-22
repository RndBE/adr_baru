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
 * GET /api/rekap-data
 * Query params:
 *   - from:     tanggal awal  (YYYY-MM-DD)
 *   - to:       tanggal akhir (YYYY-MM-DD)
 *   - logger:   code_logger filter (opsional)
 *   - page:     halaman (default 1)
 *   - limit:    jumlah per halaman (default 20)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from    = searchParams.get("from")    || "";
    const to      = searchParams.get("to")      || "";
    const logger  = searchParams.get("logger")  || "";
    const page    = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit   = Math.min(100, Number(searchParams.get("limit") || 20));
    const offset  = (page - 1) * limit;

    // Build dynamic WHERE
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (from) {
      conditions.push("DATE(waktu) >= ?");
      params.push(from);
    }
    if (to) {
      conditions.push("DATE(waktu) <= ?");
      params.push(to);
    }
    if (logger) {
      conditions.push("code_logger = ?");
      params.push(logger);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count total rows
    const countSql = `SELECT COUNT(*) as total FROM rts ${whereClause}`;
    const countResult = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      countSql,
      ...params
    );
    const total = Number(countResult[0]?.total || 0);

    // Fetch data
    const dataSql = `
      SELECT 
        id, code_logger, id_kontrol, waktu,
        sensor1, sensor2, sensor3,
        sensor5, sensor6, sensor7,
        sensor8, sensor9, sensor10,
        sensor14, sensor16, sensor17
      FROM rts 
      ${whereClause}
      ORDER BY waktu DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      dataSql,
      ...params,
      limit,
      offset
    );

    // Fetch distinct loggers for filter dropdown
    const loggerList = await prisma.$queryRaw<Array<{ code_logger: string }>>`
      SELECT DISTINCT code_logger FROM rts ORDER BY code_logger ASC
    `;

    return NextResponse.json({
      success: true,
      data: serializeBigInt(rows),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      loggers: loggerList.map((l) => l.code_logger),
    });
  } catch (error) {
    console.error("[GET /api/rekap-data]", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch rekap data",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
