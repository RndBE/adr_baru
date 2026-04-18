import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/loggers/[id]/status
 * Cek status koneksi logger (online/offline) berdasarkan waktu data terbaru.
 * Setara dengan logika koneksi di Api::lokasi_new() dan Adr::kontrol() di CI3.
 *
 * Params:
 * - id: logger ID
 *
 * Response:
 * - status: "online" | "offline"
 * - waktu: waktu data terakhir
 * - id_logger: logger ID
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Ambil info logger dan kategori
    const loggerRows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT 
        l.id_logger,
        l.nama_logger,
        l.kategori_log,
        kl.temp_data
      FROM t_logger l
      LEFT JOIN kategori_logger kl ON l.kategori_log = kl.id_katlogger
      WHERE l.id_logger = ${id}
      LIMIT 1
    `;

    if (!loggerRows || loggerRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Logger not found" },
        { status: 404 }
      );
    }

    const logger = loggerRows[0] as { id_logger: string; nama_logger: string; kategori_log: string; temp_data: string };
    const tempTable = logger.temp_data || "temp_rts";

    // Ambil waktu terbaru dari tabel temp
    let waktuTerbaru: string | null = null;
    try {
      const tempRows = await prisma.$queryRawUnsafe<Array<{ waktu: string }>>(
        `SELECT waktu FROM ${tempTable} WHERE code_logger = ? ORDER BY id DESC LIMIT 1`,
        id
      );
      waktuTerbaru = tempRows?.[0]?.waktu ?? null;
    } catch {
      // Jika tabel tidak ditemukan, anggap offline
      waktuTerbaru = null;
    }

    // Cek status: online jika waktu dalam 1 jam terakhir
    let status = "offline";
    if (waktuTerbaru) {
      const waktu = new Date(waktuTerbaru);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (waktu >= oneHourAgo) {
        status = "online";
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id_logger: id,
        nama_logger: logger.nama_logger,
        status,
        waktu: waktuTerbaru,
      },
    });
  } catch (error) {
    console.error("[GET /api/loggers/:id/status]", error);
    return NextResponse.json(
      { success: false, error: "Failed to check logger status" },
      { status: 500 }
    );
  }
}
