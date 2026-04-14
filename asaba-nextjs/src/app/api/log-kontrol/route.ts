import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/log-kontrol
 * List log_kontrol entries with optional site filter.
 * Replaces log_kontrol queries in Beranda::index().
 * 
 * Query params:
 * - site: filter by site (optional)
 * - limit: max rows (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const site = searchParams.get("site");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const where: Record<string, unknown> = {};
    if (site) where.site = site;

    const logs = await prisma.logKontrol.findMany({
      where,
      orderBy: { datetime: "desc" },
      take: Math.min(limit, 500),
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    console.error("[GET /api/log-kontrol]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}
