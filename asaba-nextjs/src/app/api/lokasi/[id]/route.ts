import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/lokasi/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await prisma.lokasi.findUnique({ where: { idlokasi: parseInt(id) } });
    if (!data) return NextResponse.json({ success: false, error: "Tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Gagal mengambil data" }, { status: 500 });
  }
}

// PUT /api/lokasi/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { nama_lokasi, latitude, longitude } = body;
    if (!nama_lokasi) return NextResponse.json({ success: false, error: "nama_lokasi wajib diisi" }, { status: 400 });
    const updated = await prisma.lokasi.update({
      where: { idlokasi: parseInt(id) },
      data: { nama_lokasi, latitude: latitude || "0", longitude: longitude || "0" },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PUT /api/lokasi]", error);
    return NextResponse.json({ success: false, error: "Gagal mengupdate lokasi" }, { status: 500 });
  }
}

// DELETE /api/lokasi/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.lokasi.delete({ where: { idlokasi: parseInt(id) } });
    return NextResponse.json({ success: true, message: "Lokasi berhasil dihapus" });
  } catch (error) {
    console.error("[DELETE /api/lokasi]", error);
    return NextResponse.json({ success: false, error: "Gagal menghapus lokasi" }, { status: 500 });
  }
}
