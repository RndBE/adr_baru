import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishMqtt } from "@/lib/mqtt";
import { getLoggerForSite } from "@/lib/sites";

/**
 * POST /api/kontrol/go-to-target
 * Kirim perintah turning_target ke logger via MQTT.
 *
 * Body: { slot_id: number, site: string }
 *
 * Payload MQTT:
 * {"set_XXXXX": {"command":"set_rts","turning_target":"<id dari t_prisma>"}}
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slot_id, site } = body;

    if (!slot_id) {
      return NextResponse.json(
        { success: false, error: "slot_id wajib diisi" },
        { status: 400 }
      );
    }

    // Perintah ini memutar teleskop RTS ke arah target. Tanpa site, slot "P1"
    // bisa merujuk target milik site lain DAN dikirim ke perangkat yang salah —
    // dua kesalahan sekaligus pada perintah yang menggerakkan alat.
    if (!site) {
      return NextResponse.json(
        { success: false, error: "site wajib diisi" },
        { status: 400 }
      );
    }

    const id_prisma = `P${slot_id}`;

    // Logger diturunkan dari site, bukan "logger ADR pertama" — dengan lebih
    // dari satu unit RTS terdaftar, LIMIT 1 tanpa ORDER BY tidak deterministik.
    const id_logger = await getLoggerForSite(site);
    if (!id_logger) {
      return NextResponse.json(
        { success: false, error: `Logger untuk site "${site}" tidak ditemukan` },
        { status: 404 }
      );
    }

    // Ambil id dari t_prisma, di-scope per site — slot yang sama ada di
    // beberapa site dan menunjuk target fisik yang berbeda.
    const prismaRows = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM t_prisma WHERE id_prisma = ${id_prisma} AND site = ${site} LIMIT 1
    `;
    const prismaId = prismaRows?.[0]?.id;
    if (prismaId === undefined || prismaId === null) {
      return NextResponse.json(
        { success: false, error: `Prisma ${id_prisma} tidak ditemukan` },
        { status: 404 }
      );
    }

    // Kirim MQTT
    const topicTarget = process.env.MQTT_TOPIC || "ADR_Tambang_Kaltara";
    const payload = {
      [`set_${id_logger}`]: {
        command: "set_rts",
        turning_target: String(prismaId),
      },
    };
    const mqttSent = await publishMqtt(topicTarget, payload);

    return NextResponse.json({
      success: true,
      data: { turning_target: prismaId, mqtt_sent: mqttSent },
    });
  } catch (error) {
    console.error("[POST /api/kontrol/go-to-target]", error);
    return NextResponse.json(
      { success: false, error: "Failed to send go-to-target" },
      { status: 500 }
    );
  }
}
