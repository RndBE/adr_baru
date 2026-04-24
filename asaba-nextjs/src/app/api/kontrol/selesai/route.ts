import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/kontrol/selesai
 * Setara CI3 Kontrol::selesai_kontrol() / selesai_kontrol2()
 * Log data selesai kontrol ke log_kontrol.
 * Body: {
 *   id_logger: string,
 *   list_pintu: Array<{ id_pintu: string, elev_asli: number, elev: number }>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id_logger, list_pintu } = body;

    if (!id_logger || !Array.isArray(list_pintu)) {
      return NextResponse.json(
        { success: false, error: "id_logger dan list_pintu wajib diisi" },
        { status: 400 }
      );
    }

    const datetime = new Date().toISOString().slice(0, 19).replace("T", " ");
    const inserted = [];

    for (const item of list_pintu) {
      const sistem =
        Number(item.elev_asli) < Number(item.elev) ? "1" : "0";

      await prisma.$executeRaw`
        INSERT INTO log_kontrol (id_logger, id_pintu, metode, dari, ke, datetime, sistem)
        VALUES (${id_logger}, ${item.id_pintu}, 'Telemetry', ${String(item.elev_asli)}, ${String(item.elev)}, ${datetime}, ${sistem})
      `;

      inserted.push({
        id_pintu: item.id_pintu,
        dari: item.elev_asli,
        ke: item.elev,
        sistem,
      });
    }

    return NextResponse.json({
      success: true,
      data: inserted,
    });
  } catch (error) {
    console.error("[POST /api/kontrol/selesai]", error);
    return NextResponse.json(
      { success: false, error: "Failed to log selesai kontrol" },
      { status: 500 }
    );
  }
}
