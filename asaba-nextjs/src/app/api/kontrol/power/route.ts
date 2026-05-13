import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import mqtt from "mqtt";

/**
 * POST /api/kontrol/power
 * Power On/Off RTS via MQTT.
 * 
 * Kirim command lalu tunggu respons dari logger (max 5 detik).
 *
 * Body: { action: "on" | "off" }
 *
 * ON  → {"set_XXXXX": {"command":"set_rts","PowerOn":"true"}}
 * OFF → {"set_XXXXX": {"command":"set_rts","PowerOff":"true"}}
 *
 * Logger responds:
 * {"PowerOn":  {"nilai": "..."}}
 * {"PowerOff": {"nilai": "..."}}
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

    // Subscribe → Publish → Tunggu respons dari logger (max 5 detik)
    const response = await publishAndWaitResponse(topicTarget, payload, action);

    return NextResponse.json({
      success: true,
      data: {
        action,
        mqtt_sent: true,
        response: response, // null jika timeout
      },
    });
  } catch (error) {
    console.error("[POST /api/kontrol/power]", error);
    return NextResponse.json(
      { success: false, error: "Failed to send power command" },
      { status: 500 }
    );
  }
}

/**
 * Connect MQTT, subscribe ke topic, publish command, 
 * tunggu respons PowerOn/PowerOff dari logger (max 5 detik).
 */
function publishAndWaitResponse(
  topic: string,
  payload: object,
  action: "on" | "off"
): Promise<{ type: "on" | "off"; message: string } | null> {
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
      connectTimeout: 10000,
    });

    // Timeout 5 detik — kalau logger tidak respond, return null
    const timeout = setTimeout(() => {
      console.log(`[Power] Timeout waiting for ${responseKey} response`);
      client.end(true);
      resolve(null);
    }, 5000);

    client.on("connect", () => {
      // 1. Subscribe ke topic untuk menangkap respons
      client.subscribe(topic, { qos: 0 }, (err) => {
        if (err) {
          console.error(`[Power] Subscribe failed:`, err);
          clearTimeout(timeout);
          client.end(true);
          resolve(null);
          return;
        }

        // 2. Publish command setelah subscribe berhasil
        const payloadStr = JSON.stringify(payload);
        console.log(`[Power] Sending ${action} to topic=${topic}`, payloadStr);
        client.publish(topic, payloadStr, { qos: 0 });
      });
    });

    // 3. Tunggu respons dari logger
    client.on("message", (_topic: string, message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());

        // Cek apakah ini respons PowerOn atau PowerOff dari logger
        if (data[responseKey] && data[responseKey].nilai) {
          console.log(`[Power] Got ${responseKey} response:`, data[responseKey].nilai);
          clearTimeout(timeout);
          client.end(true);
          resolve({
            type: action,
            message: data[responseKey].nilai,
          });
        }
      } catch {
        // Ignore non-JSON messages
      }
    });

    client.on("error", (err) => {
      console.error("[Power] MQTT error:", err);
      clearTimeout(timeout);
      client.end(true);
      resolve(null);
    });
  });
}
