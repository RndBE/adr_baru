import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/prisma-data?site=xxx
 * Status live tiap prisma dari temp_prisma.
 *
 * Query params:
 * - site: WAJIB diisi untuk memperoleh data satu site saja. Tanpa parameter
 *   ini, endpoint mengembalikan seluruh prisma dari semua site — perilaku lama
 *   yang membuat prisma site lain muncul di panel Kontrol ADR.
 *
 * Kolom:
 * - id_prisma  : nomor slot RTS (P1, P2, …) — dipakai ulang tiap site,
 *                jadi hanya unik bersama `site`
 * - waktu      : waktu pengukuran
 * - N1, E1, Z1 : koordinat hasil (Y, X, Z)
 * - N0, E0, Z0 : koordinat referensi
 * - status_get : 1 = success, 0 = failed, 2 = running
 * - HA, VA, SlopDis
 */
export async function GET(request: NextRequest) {
  try {
    const site = request.nextUrl.searchParams.get("site");

    // Baris terbaru per prisma, di-scope per site.
    const rows = site
      ? await prisma.$queryRaw<Array<Record<string, unknown>>>`
          SELECT tp.*
          FROM temp_prisma tp
          INNER JOIN (
            SELECT site, id_prisma, MAX(id) AS max_id
            FROM temp_prisma
            WHERE site = ${site}
            GROUP BY site, id_prisma
          ) latest
            ON tp.site = latest.site
           AND tp.id_prisma = latest.id_prisma
           AND tp.id = latest.max_id
          ORDER BY tp.id_prisma ASC
        `
      : await prisma.$queryRaw<Array<Record<string, unknown>>>`
          SELECT tp.*
          FROM temp_prisma tp
          INNER JOIN (
            SELECT site, id_prisma, MAX(id) AS max_id
            FROM temp_prisma
            GROUP BY site, id_prisma
          ) latest
            ON tp.site = latest.site
           AND tp.id_prisma = latest.id_prisma
           AND tp.id = latest.max_id
          ORDER BY tp.site ASC, tp.id_prisma ASC
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
