import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const loggers = await prisma.$queryRaw`
      SELECT 
        l.id, l.id_logger, l.nama_logger, l.lokasi_logger, l.kategori_log, l.tabel,
        lok.nama_lokasi, lok.latitude, lok.longitude,
        kl.nama_kategori, kl.kepanjangan, kl.temp_data, kl.icon_app,
        inf.seri, inf.serial_number, inf.masa_aktif, inf.nosell
      FROM t_logger l
      LEFT JOIN t_lokasi lok ON l.lokasi_logger = lok.idlokasi
      LEFT JOIN kategori_logger kl ON l.kategori_log = kl.id_katlogger
      LEFT JOIN t_informasi inf ON inf.logger_id = l.id_logger
      ORDER BY l.id_logger
    `;

    return NextResponse.json({ success: true, data: loggers });
  } catch (error) {
    console.error("[GET /api/loggers]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch loggers" },
      { status: 500 }
    );
  }
}

// POST /api/loggers - tambah logger baru
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id_logger, nama_logger, lokasi_logger, kategori_log, tabel } = body;
    if (!id_logger || !nama_logger || !lokasi_logger || !kategori_log || !tabel) {
      return NextResponse.json({ success: false, error: "Semua field wajib diisi" }, { status: 400 });
    }
    const existing = await prisma.logger.findFirst({ where: { id_logger } });
    if (existing) return NextResponse.json({ success: false, error: "ID Logger sudah digunakan" }, { status: 409 });

    const created = await prisma.logger.create({
      data: { id_logger, nama_logger, lokasi_logger: String(lokasi_logger), kategori_log: String(kategori_log), tabel },
    });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/loggers]", error);
    return NextResponse.json({ success: false, error: "Gagal menambah logger" }, { status: 500 });
  }
}