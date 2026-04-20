import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


/**
 * GET /api/config-adr
 * Fetch konfigurasi ADR dari tabel config_adr (row pertama).
 *
 * PUT /api/config-adr
 * Update konfigurasi ADR (berdasarkan id).
 */
export async function GET() {
  try {
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM config_adr ORDER BY id ASC LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Config not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("[GET /api/config-adr]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch config ADR" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      job_name,
      prisma_cons,
      ts_high,
      coor_x,
      coor_y,
      coor_z,
      step_record,
      retries,
      cycle_time,
    } = body;

    await prisma.$executeRaw`
      UPDATE config_adr
      SET
        job_name     = ${job_name},
        prisma_cons  = ${parseFloat(prisma_cons)},
        ts_high      = ${parseFloat(ts_high)},
        coor_x       = ${parseFloat(coor_x)},
        coor_y       = ${parseFloat(coor_y)},
        coor_z       = ${parseFloat(coor_z)},
        step_record  = ${parseInt(step_record)},
        retries      = ${parseInt(retries)},
        cycle_time   = ${parseInt(cycle_time)}
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PUT /api/config-adr]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update config ADR" },
      { status: 500 }
    );
  }
}
