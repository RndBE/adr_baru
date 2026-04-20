import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET() {
  try {
    const rows = await prisma.$queryRaw<Array<any>>`
      SELECT id, nama, status, time, days
      FROM scheduling_task
      ORDER BY days ASC, nama ASC
    `;
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("[GET /api/scheduling]", error);
    return NextResponse.json({ success: false, error: "Failed to fetch scheduling" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { schedules } = await request.json();
    // schedules is an array of updates: { id: string, status: number, time: string }
    for (const update of schedules) {
      await prisma.$executeRaw`
        UPDATE scheduling_task
        SET status = ${update.status}, time = ${update.time}
        WHERE id = ${update.id}
      `;
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PUT /api/scheduling]", error);
    return NextResponse.json({ success: false, error: "Failed to update scheduling" }, { status: 500 });
  }
}
