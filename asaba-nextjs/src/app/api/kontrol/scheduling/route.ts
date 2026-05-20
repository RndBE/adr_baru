import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function createScheduleId() {
  return Date.now().toString().slice(-11);
}

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
 * Body: { id, nama, days, time, status }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, nama, days, time, status } = body;
    const data = {
      nama: String(nama || "Jadwal"),
      days: Number(days),
      time: String(time),
      status: Number(status),
    };

    if (id) {
      // Update existing
      await prisma.schedulingTask.update({
        where: { id: String(id) },
        data,
      });
    } else {
      // Create new
      await prisma.schedulingTask.create({
        data: {
          id: createScheduleId(),
          ...data,
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
