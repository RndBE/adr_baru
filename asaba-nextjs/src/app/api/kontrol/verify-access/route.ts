import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/kontrol/verify-access
 * Hanya validasi kode akses — TIDAK kirim MQTT apapun.
 * Dipakai oleh halaman Prism Config untuk unlock tombol Set/Edit.
 *
 * Body: { kode_akses: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kode_akses } = body;

    if (!kode_akses) {
      return NextResponse.json(
        { success: false, error: "Kode akses wajib diisi" },
        { status: 400 }
      );
    }

    const { createHash } = await import("crypto");
    const hashedInput = createHash("md5").update(kode_akses).digest("hex");

    const accessCode = await prisma.kodeAkses.findFirst({
      where: { kode_akses: hashedInput },
    });

    if (!accessCode) {
      return NextResponse.json(
        { success: false, error: "Kode Akses Salah" },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/kontrol/verify-access]", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify access code" },
      { status: 500 }
    );
  }
}
