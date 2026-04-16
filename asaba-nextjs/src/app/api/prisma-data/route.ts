import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/prisma-data
 * Fetch all latest prisma data from temp_prisma grouped by id_prisma.
 *
 * Kolom:
 * - id_prisma  : nama prisma (misal P1, P2, ...)
 * - waktu      : waktu pengukuran
 * - N1, E1, Z1 : koordinat hasil (Y, X, Z)
 * - N0, E0, Z0 : koordinat referensi
 * - status_get : 1 = success, 0 = failed, 2 = running
 * - HA, VA, SlopDis
 */
export async function GET() {
  try {
    // Ambil data terbaru per id_prisma
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT tp.*
      FROM temp_prisma tp
      INNER JOIN (
        SELECT id_prisma, MAX(id) AS max_id
        FROM temp_prisma
        GROUP BY id_prisma
      ) latest ON tp.id_prisma = latest.id_prisma AND tp.id = latest.max_id
      ORDER BY tp.id_prisma ASC
    `;

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("[GET /api/prisma-data]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch prisma data" },
      { status: 500 }
    );
  }
}
