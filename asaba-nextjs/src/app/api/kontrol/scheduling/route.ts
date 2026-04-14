import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/kontrol/scheduling
 * List all scheduling tasks.
 */
export async function GET() {
  try {
    const tasks = await prisma.schedulingTask.findMany({
      orderBy: [{ days: "asc" }, { time: "asc" }],
    });

    return NextResponse.json({ success: true, data: tasks });
  } catch (error) {
    console.error("[GET /api/kontrol/scheduling]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch schedules" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/kontrol/scheduling
 * Create or update a scheduling task.
 * Body: { id_logger, days, time, status, site }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, id_logger, days, time, status, site } = body;

    if (id) {
      // Update existing
      await prisma.schedulingTask.update({
        where: { id: parseInt(id) },
        data: { id_logger, days, time, status, site },
      });
    } else {
      // Create new
      await prisma.schedulingTask.create({
        data: {
          id_logger,
          days: String(days),
          time: String(time),
          status: String(status),
          site: site || null,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/kontrol/scheduling]", error);
    return NextResponse.json(
      { success: false, error: "Failed to save schedule" },
      { status: 500 }
    );
  }
}
