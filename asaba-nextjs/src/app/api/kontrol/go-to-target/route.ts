import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishMqtt } from "@/lib/mqtt";

/**
 * POST /api/kontrol/go-to-target
 * Kirim perintah turning_target ke logger via MQTT.
 *
 * Body: { slot_id: number }
 *
 * Payload MQTT:
 * {"set_XXXXX": {"command":"set_rts","turning_target":"<id dari t_prisma>"}}
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slot_id } = body;

    if (!slot_id) {
      return NextResponse.json(
        { success: false, error: "slot_id wajib diisi" },
        { status: 400 }
      );
    }

    const id_prisma = `P${slot_id}`;

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

    // Ambil id dari t_prisma
    const prismaRows = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM t_prisma WHERE id_prisma = ${id_prisma} AND id_logger = ${id_logger} LIMIT 1
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
