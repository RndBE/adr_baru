import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/users/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await prisma.user.findUnique({ where: { id_user: parseInt(id) } });
    if (!data) return NextResponse.json({ success: false, error: "User tidak ditemukan" }, { status: 404 });
    const { password: _, ...safe } = data;
    return NextResponse.json({ success: true, data: safe });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Gagal mengambil data" }, { status: 500 });
  }
}

// PUT /api/users/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { nama, username, password, level_user, alamat, telp, instansi, latitude, longitude, zoom, bidang } = body;
    if (!nama || !username || !level_user) {
      return NextResponse.json({ success: false, error: "nama, username, level_user wajib diisi" }, { status: 400 });
    }
    // Cek username duplikat (exclude current user)
    const existing = await prisma.user.findFirst({ where: { username, NOT: { id_user: parseInt(id) } } });
    if (existing) return NextResponse.json({ success: false, error: "Username sudah digunakan user lain" }, { status: 409 });

    const updateData: any = { nama, username, level_user, alamat: alamat || "", telp: telp || "", instansi: instansi || null, latitude: latitude || "0", longitude: longitude || "0", zoom: zoom || 10, bidang: bidang || null };
    if (password && password.trim() !== "") updateData.password = password;

    const updated = await prisma.user.update({ where: { id_user: parseInt(id) }, data: updateData });
    const { password: _, ...safe } = updated;
    return NextResponse.json({ success: true, data: safe });
  } catch (error) {
    console.error("[PUT /api/users]", error);
    return NextResponse.json({ success: false, error: "Gagal mengupdate user" }, { status: 500 });
  }
}

// DELETE /api/users/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.user.delete({ where: { id_user: parseInt(id) } });
    return NextResponse.json({ success: true, message: "User berhasil dihapus" });
  } catch (error) {
    console.error("[DELETE /api/users]", error);
    return NextResponse.json({ success: false, error: "Gagal menghapus user" }, { status: 500 });
  }
}
