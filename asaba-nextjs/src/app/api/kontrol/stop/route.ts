import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishMqtt } from "@/lib/mqtt";

/**
 * POST /api/kontrol/stop
 * Stop kontrol — setara CI3 Kontrol::stop_kontrol() & selesai()
 * Body: { id_logger: string, action?: "stop" | "selesai" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id_logger, action = "stop" } = body;

    if (!id_logger) {
      return NextResponse.json(
        { success: false, error: "id_logger wajib diisi" },
        { status: 400 }
      );
    }

    if (action === "selesai") {
      // Setara Kontrol::selesai() — reset status_kontrol + publish MQTT
      await prisma.$executeRaw`
        UPDATE status_kontrol 
        SET status_kontrol = '0'
        WHERE id_logger = ${id_logger}
      `;

      const mqttPayload = { status_kontrol: "0" };
      const topic = process.env.MQTT_KONTROL_TOPIC || "kontrol-asaba";
      await publishMqtt(topic, mqttPayload);

      return NextResponse.json({ success: true, action: "selesai" });
    }

    // Setara Kontrol::stop_kontrol() — update set_tempkontrol
    await prisma.$executeRaw`
      UPDATE set_tempkontrol
      SET status = '0', status_manual = '0'
      WHERE id_logger = ${id_logger}
    `;

    // Publish MQTT stop
    const stopPayload = { status: 0, status_manual: 0 };
    const topic = process.env.MQTT_KONTROL_TOPIC || "kontrol-asaba";
    await publishMqtt(topic, stopPayload);

    return NextResponse.json({ success: true, action: "stop" });
  } catch (error) {
    console.error("[POST /api/kontrol/stop]", error);
    return NextResponse.json(
      { success: false, error: "Failed to stop kontrol" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/kontrol/stop
 * Reset operasi / respon logger
 * Body: { id_logger: string, action: "operasi" | "respon" }
 * - operasi: Setara Kontrol::operasi() — reset status_kontrol=0, session_id=0
 * - respon: Setara Kontrol::respon_logger() — set status_kontrol=2
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id_logger, action } = body;

    if (!id_logger || !action) {
      return NextResponse.json(
        { success: false, error: "id_logger dan action wajib diisi" },
        { status: 400 }
      );
    }

    if (action === "respon") {
      await prisma.$executeRaw`
        UPDATE status_kontrol
        SET status_kontrol = '2'
        WHERE id_logger = ${id_logger}
      `;
      return NextResponse.json({ success: true, action: "respon" });
    }

    if (action === "operasi") {
      await prisma.$executeRaw`
        UPDATE status_kontrol
        SET status_kontrol = '0', session_id = '0'
        WHERE id_logger = ${id_logger}
      `;
      return NextResponse.json({ success: true, action: "operasi" });
    }

    return NextResponse.json(
      { success: false, error: `Action '${action}' tidak dikenali` },
      { status: 400 }
    );
  } catch (error) {
    console.error("[PUT /api/kontrol/stop]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update kontrol status" },
      { status: 500 }
    );
  }
}
