import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import mqtt from "mqtt";

/**
 * POST /api/kontrol/power
 * Power On/Off RTS via MQTT.
 *
 * Body: { action: "on" | "off" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action !== "on" && action !== "off") {
      return NextResponse.json({ success: false, error: 'action harus "on" atau "off"' }, { status: 400 });
    }

    const loggers = await prisma.$queryRaw<Array<{ id_logger: string }>>`
      SELECT l.id_logger FROM t_logger l
      JOIN kategori_logger kl ON l.kategori_log = kl.id_katlogger
      WHERE kl.nama_kategori LIKE '%ADR%' OR kl.nama_kategori LIKE '%RTS%' LIMIT 1
    `;
    const id_logger = loggers?.[0]?.id_logger;
    if (!id_logger) {
      return NextResponse.json({ success: false, error: "ADR logger not found" }, { status: 404 });
    }

    const topicTarget = process.env.MQTT_TOPIC || "ADR_Tambang_Kaltara";
    const payload = {
      [`set_${id_logger}`]: {
        command: "set_rts",
        ...(action === "on" ? { PowerOn: "true" } : { PowerOff: "true" }),
      },
    };

    // Tunggu balasan dari logger maksimal 5 detik
    const response = await publishAndWaitResponse(topicTarget, payload, action);

    return NextResponse.json({
      success: true,
      data: {
        action,
        response: response, // bisa berisi object balasan atau null jika timeout
      },
    });
  } catch (error) {
    console.error("[POST /api/kontrol/power]", error);
    return NextResponse.json({ success: false, error: "Failed to send power command" }, { status: 500 });
  }
}

function publishAndWaitResponse(
  topic: string,
  payload: object,
  action: "on" | "off"
): Promise<{ status: "success" | "failed" | "timeout"; message: string }> {
  const config = {
    host: process.env.MQTT_HOST || "mqtt.beacontelemetry.com",
    port: parseInt(process.env.MQTT_PORT || "8883", 10),
    username: process.env.MQTT_USERNAME || "userlog",
    password: process.env.MQTT_PASSWORD || "b34c0n",
  };

  const url = `mqtts://${config.host}:${config.port}`;
  const responseKey = action === "on" ? "PowerOn" : "PowerOff";

  return new Promise((resolve) => {
    const client = mqtt.connect(url, {
      username: config.username,
      password: config.password,
      rejectUnauthorized: process.env.MQTT_REJECT_UNAUTHORIZED === "true",
      connectTimeout: 5000,
    });

    const timeout = setTimeout(() => {
      client.end(true);
      resolve({ status: "timeout", message: "Logger tidak merespons dalam 5 detik" });
    }, 5000);

    client.on("connect", () => {
      client.subscribe(topic, { qos: 0 }, (err) => {
        if (err) {
          clearTimeout(timeout);
          client.end(true);
          resolve({ status: "failed", message: "Gagal subscribe ke MQTT broker" });
          return;
        }

        const payloadStr = JSON.stringify(payload);
        client.publish(topic, payloadStr, { qos: 0 });
      });
    });

    client.on("message", (_topic: string, message: Buffer) => {
      const rawMsg = message.toString();
      console.log(`[MQTT Debug] Received on ${_topic}:`, rawMsg);
      try {
        const data = JSON.parse(rawMsg);
        if (data[responseKey] && data[responseKey].nilai) {
          clearTimeout(timeout);
          client.end(true);
          
          const nilai = data[responseKey].nilai;
          // Anggap string "Failed" atau error lainnya sebagai failure
          const isFailed = nilai.toLowerCase().includes("failed") || nilai.toLowerCase().includes("tidak terhubung");
          
          resolve({
            status: isFailed ? "failed" : "success",
            message: nilai,
          });
        }
      } catch {
        // Abaikan kalau bukan JSON
      }
    });

    client.on("error", () => {
      clearTimeout(timeout);
      client.end(true);
      resolve({ status: "failed", message: "Koneksi MQTT error" });
    });
  });
}
