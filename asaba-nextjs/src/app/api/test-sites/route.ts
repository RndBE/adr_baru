import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const sites = await prisma.$queryRawUnsafe(`SELECT DISTINCT site FROM log_kontrol`);
  return NextResponse.json({ sites });
}
