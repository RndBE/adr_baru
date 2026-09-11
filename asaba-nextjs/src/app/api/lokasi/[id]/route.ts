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
    const idNum = parseInt(id);

    const lokasi = await prisma.lokasi.findUnique({ where: { idlokasi: idNum } });
    if (!lokasi) return NextResponse.json({ success: false, error: "Tidak ditemukan" }, { status: 404 });

    // t_logger.lokasi_logger menyimpan idlokasi sebagai VARCHAR dan tidak ada
    // foreign key-nya. Tanpa pemeriksaan ini, menghapus lokasi membuat kolom
    // LOKASI di daftar logger jatuh balik menampilkan angka id — persis gejala
    // yang bikin halaman ini terlihat rusak.
    const dipakai = await prisma.logger.findMany({
      where: { lokasi_logger: String(idNum) },
      select: { nama_logger: true },
    });
    if (dipakai.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Lokasi "${lokasi.nama_lokasi}" masih dipakai ${dipakai.length} logger ` +
            `(${dipakai.map((l) => l.nama_logger).join(", ")}). ` +
            `Pindahkan logger itu ke lokasi lain dulu.`,
        },
        { status: 409 }
      );
    }

    await prisma.lokasi.delete({ where: { idlokasi: idNum } });
    return NextResponse.json({ success: true, message: "Lokasi berhasil dihapus" });
  } catch (error) {
    console.error("[DELETE /api/lokasi]", error);
    return NextResponse.json({ success: false, error: "Gagal menghapus lokasi" }, { status: 500 });
  }
}
