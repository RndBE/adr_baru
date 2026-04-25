import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/users - list semua user
export async function GET() {
  try {
    const data = await prisma.user.findMany({ orderBy: { id_user: "asc" } });
    // Sembunyikan password dari response
    const safe = data.map(({ password: _, ...rest }) => rest);
    return NextResponse.json({ success: true, data: safe });
  } catch (error) {
    console.error("[GET /api/users]", error);
    return NextResponse.json({ success: false, error: "Gagal mengambil data user" }, { status: 500 });
  }
}

// POST /api/users - tambah user baru
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nama, username, password, level_user, alamat, telp, instansi, latitude, longitude, zoom, bidang } = body;
    if (!nama || !username || !password || !level_user) {
      return NextResponse.json({ success: false, error: "nama, username, password, level_user wajib diisi" }, { status: 400 });
    }
    // Cek username sudah ada
    const existing = await prisma.user.findFirst({ where: { username } });
    if (existing) return NextResponse.json({ success: false, error: "Username sudah digunakan" }, { status: 409 });

    const created = await prisma.user.create({
      data: {
        nama,
        username,
        password, // simpan as-is (sesuai sistem legacy)
        level_user,
        alamat: alamat || "",
        telp: telp || "",
        instansi: instansi || null,
        latitude: latitude || "0",
        longitude: longitude || "0",
        zoom: zoom || 10,
        bidang: bidang || null,
      },
    });
    const { password: _, ...safe } = created;
    return NextResponse.json({ success: true, data: safe }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/users]", error);
    return NextResponse.json({ success: false, error: "Gagal menambah user" }, { status: 500 });
  }
}
