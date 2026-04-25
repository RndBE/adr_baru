import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishMqtt } from "@/lib/mqtt";

/**
 * POST /api/kontrol/auto-search
 * Kirim perintah auto_search ke logger via MQTT.
 *
 * Body: { slot_id?: number }
 *
 * Payload MQTT:
 * {"set_XXXXX": {"command":"set_rts","auto_search":true}}
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    // Ambil id_logger ADR
    const loggers = await prisma.$queryRaw<Array<{ id_logger: string }>>`
      SELECT l.id_logger
      FROM t_logger l
      JOIN kategori_logger kl ON l.kategori_log = kl.id_katlogger
      WHERE kl.nama_kategori LIKE '%ADR%' OR kl.nama_kategori LIKE '%RTS%'
      LIMIT 1
    `;
    const id_logger = loggers?.[0]?.id_logger;
    if (!id_logger) {
      return NextResponse.json(
        { success: false, error: "ADR logger not found" },
        { status: 404 }
      );
    }

    const topicTarget = process.env.MQTT_TOPIC || "ADR_Tambang_Kaltara";
    const payload = {
      [`set_${id_logger}`]: {
        command: "set_rts",
        auto_search: true,
      },
    };
    const mqttSent = await publishMqtt(topicTarget, payload);

    return NextResponse.json({
      success: true,
      data: { slot_id: body.slot_id ?? null, mqtt_sent: mqttSent },
    });
  } catch (error) {
    console.error("[POST /api/kontrol/auto-search]", error);
    return NextResponse.json(
      { success: false, error: "Failed to send auto-search" },
      { status: 500 }
    );
  }
}
