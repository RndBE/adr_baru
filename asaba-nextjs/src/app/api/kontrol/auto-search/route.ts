import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishMqtt } from "@/lib/mqtt";
import mqtt from "mqtt";

/**
 * POST /api/kontrol/auto-search
 * Kirim auto_search ke logger, lalu subscribe MQTT
 * untuk menangkap response HA/VA dari logger.
 *
 * Body: { slot_id?: number }
 *
 * Response: { success, data: { HA, VA, TargetName, ... } }
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

    // Kirim auto_search ke logger
    const topicTarget = process.env.MQTT_TOPIC || "ADR_Tambang_Kaltara";
    const payload = {
      [`set_${id_logger}`]: {
        command: "set_rts",
        auto_search: true,
      },
    };
    const mqttSent = await publishMqtt(topicTarget, payload);

    if (!mqttSent) {
      return NextResponse.json(
        { success: false, error: "Gagal mengirim auto_search ke logger" },
        { status: 500 }
      );
    }

    // Subscribe dan tunggu response dari logger (max 30 detik)
    const responseData = await waitForAutoSearchResponse(topicTarget, 30000);

    if (responseData) {
      // Simpan HA/VA ke t_prisma
      const id_prisma = body.slot_id ? `P${body.slot_id}` : responseData.TargetName;
      if (id_prisma) {
        await prisma.$executeRaw`
          UPDATE t_prisma
          SET HA = ${responseData.HA || "0"}, VA = ${responseData.VA || "0"}
          WHERE id_prisma = ${id_prisma}
        `;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        slot_id: body.slot_id ?? null,
        mqtt_sent: mqttSent,
        response: responseData,
      },
    });
  } catch (error) {
    console.error("[POST /api/kontrol/auto-search]", error);
    return NextResponse.json(
      { success: false, error: "Failed to send auto-search" },
      { status: 500 }
    );
  }
}

/**
 * Subscribe ke topic MQTT dan tunggu response recordTarget dari logger.
 */
function waitForAutoSearchResponse(
  topic: string,
  timeoutMs: number
): Promise<{ TargetName?: string; TgHigh?: string; HA?: string; VA?: string } | null> {
  return new Promise((resolve) => {
    const host = process.env.MQTT_HOST || "mqtt.beacontelemetry.com";
    const port = parseInt(process.env.MQTT_PORT || "8883", 10);
    const url = `mqtts://${host}:${port}`;

    const client = mqtt.connect(url, {
      username: process.env.MQTT_USERNAME || "userlog",
      password: process.env.MQTT_PASSWORD || "b34c0n",
      rejectUnauthorized: process.env.MQTT_REJECT_UNAUTHORIZED === "true",
      connectTimeout: 10000,
    });

    const timer = setTimeout(() => {
      console.log("[AutoSearch] Timeout waiting for logger response");
      client.end(true);
      resolve(null);
    }, timeoutMs);

    client.on("connect", () => {
      console.log("[AutoSearch] MQTT connected, subscribing to", topic);
      client.subscribe(topic);
    });

    client.on("message", (_t: string, message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        // Logger response: { "recordTarget": { "TargetName": "P2", "HA": "115,45,59", "VA": "294,02,67" } }
        const rt = data?.recordTarget;
        if (rt && rt.HA && rt.VA) {
          console.log("[AutoSearch] Got response:", rt);
          clearTimeout(timer);
          client.end();
          resolve({
            TargetName: rt.TargetName,
            TgHigh: rt.TgHigh,
            HA: String(rt.HA),
            VA: String(rt.VA),
          });
        }
      } catch {
        // Ignore non-JSON
      }
    });

    client.on("error", (err: Error) => {
      console.error("[AutoSearch] MQTT error:", err);
      clearTimeout(timer);
      client.end();
      resolve(null);
    });
  });
}
