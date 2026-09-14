import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggerForSite } from "@/lib/sites";

/**
 * GET /api/log-aktivitas?site=ccp&limit=50 — perintah terakhir ke alat.
 *
 * Disaring per LOGGER, bukan per site. Yang tercatat saat perintah dikirim
 * hanyalah id alat dari topik MQTT (`sub_<idAlat>`), dan satu logger boleh
 * melayani beberapa site — 30002 melayani ccp dan viewpoint. Jadi meminta log
 * "site ccp" mengembalikan perintah untuk alat milik ccp, yang bisa termasuk
 * perintah yang dikirim dari layar viewpoint. Itu jujur: alatnya memang satu,
 * dan menyembunyikan sebagiannya akan membuat riwayat terlihat bolong.
 *
 * `id_logger` boleh diberikan langsung untuk melewati pencarian site.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const site = searchParams.get("site");
    let idLogger = searchParams.get("id_logger");

    if (!idLogger && site) idLogger = await getLoggerForSite(site);
    if (!idLogger) {
      return NextResponse.json(
        { success: false, error: "site atau id_logger wajib diisi" },
        { status: 400 }
      );
    }

    const batas = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1),
      200
    );

    const rows = await prisma.logAktivitas.findMany({
      where: { id_logger: idLogger },
      orderBy: [{ waktu: "desc" }, { id: "desc" }],
      take: batas,
      // `payload` sengaja tidak ikut: isinya bentuk mentah firmware, tidak
      // dibaca siapa pun di daftar, dan hanya memperbesar balasan.
      select: {
        id: true,
        id_logger: true,
        perintah: true,
        terkirim: true,
        waktu: true,
      },
    });

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("[GET /api/log-aktivitas]", error);
    return NextResponse.json(
      { success: false, error: "Gagal membaca log aktivitas" },
      { status: 500 }
    );
  }
}
