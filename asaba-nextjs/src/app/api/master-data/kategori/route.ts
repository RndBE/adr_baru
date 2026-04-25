import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const data = await prisma.kategoriLogger.findMany({ orderBy: { id_katlogger: "asc" } });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, data: [] });
  }
}
