import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


/**
 * GET /api/sensor-data
 * Query sensor data by logger, table, and time range.
 * Replaces CI3 Data.php, Awlr.php controllers.
 * 
 * Query params:
 * - logger: code_logger (required)
 * - table: awlr | ews | rts (required)
 * - from: ISO datetime start
 * - to: ISO datetime end
 * - limit: max rows (default 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const logger = searchParams.get("logger");
    const table = searchParams.get("table");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    if (!logger || !table) {
      return NextResponse.json(
        { success: false, error: "logger and table params are required" },
        { status: 400 }
      );
    }

    // Validate table name to prevent SQL injection
    const allowedTables = ["awlr", "ews", "rts"];
    if (!allowedTables.includes(table)) {
      return NextResponse.json(
        { success: false, error: `Invalid table. Allowed: ${allowedTables.join(", ")}` },
        { status: 400 }
      );
    }

    let query = `SELECT * FROM ${table} WHERE code_logger = ?`;
    const params: (string | number)[] = [logger];

    if (from) {
      query += ` AND waktu >= ?`;
      params.push(from);
    }
    if (to) {
      query += ` AND waktu <= ?`;
      params.push(to);
    }

    query += ` ORDER BY waktu DESC LIMIT ?`;
    params.push(Math.min(limit, 5000));

    const data = await prisma.$queryRawUnsafe(query, ...params);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[GET /api/sensor-data]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch sensor data" },
      { status: 500 }
    );
  }
}
