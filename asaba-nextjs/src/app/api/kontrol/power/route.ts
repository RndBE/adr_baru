import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishMqtt } from "@/lib/mqtt";

/**
 * POST /api/kontrol/power
 * Power On/Off RTS via MQTT.
 *
 * Body: { action: "on" | "off" }
 *
 * ON  → {"set_XXXXX": {"command":"set_rts","PowerOn":"true"}}
 * OFF → {"set_XXXXX": {"command":"set_rts","PowerOff":"true"}}
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action !== "on" && action !== "off") {
      return NextResponse.json(
        { success: false, error: 'action harus "on" atau "off"' },
        { status: 400 }
      );
    }

    // Ambil logger ID ADR
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
        ...(action === "on" ? { PowerOn: "true" } : { PowerOff: "true" }),
      },
    };

    console.log(`[Power] Sending ${action} to topic=${topicTarget}`, JSON.stringify(payload));
    const t0 = Date.now();
    const mqttSent = await publishMqtt(topicTarget, payload);
    console.log(`[Power] MQTT result: ${mqttSent}, took ${Date.now() - t0}ms`);

    return NextResponse.json({
      success: true,
      data: { action, mqtt_sent: mqttSent },
    });
  } catch (error) {
    console.error("[POST /api/kontrol/power]", error);
    return NextResponse.json(
      { success: false, error: "Failed to send power command" },
      { status: 500 }
    );
  }
}
