import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/lokasi - list semua lokasi
export async function GET() {
  try {
    const data = await prisma.lokasi.findMany({ orderBy: { idlokasi: "asc" } });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[GET /api/lokasi]", error);
    return NextResponse.json({ success: false, error: "Gagal mengambil data lokasi" }, { status: 500 });
  }
}

// POST /api/lokasi - tambah lokasi baru
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nama_lokasi, latitude, longitude } = body;
    if (!nama_lokasi) {
      return NextResponse.json({ success: false, error: "nama_lokasi wajib diisi" }, { status: 400 });
    }
    const created = await prisma.lokasi.create({
      data: { nama_lokasi, latitude: latitude || "0", longitude: longitude || "0" },
    });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/lokasi]", error);
    return NextResponse.json({ success: false, error: "Gagal menambah lokasi" }, { status: 500 });
  }
}
