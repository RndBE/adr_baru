import { NextRequest, NextResponse } from "next/server";
import mqtt from "mqtt";
import { getLoggerForCommand } from "@/lib/sites";
import { topikPerintah } from "@/lib/mqtt";

/**
 * POST /api/kontrol/power
 * Power On/Off RTS via MQTT (fire-and-forget).
 * Balasan dari logger akan ditangkap langsung oleh frontend via MQTT.
 *
 * Body: { action: "on" | "off", site?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, site } = body;

    if (action !== "on" && action !== "off") {
      return NextResponse.json({ success: false, error: `action harus "on" atau "off"` }, { status: 400 });
    }

    // Perintah ini menyalakan/mematikan unit RTS, jadi logger tujuannya penting:
    // salah logger = salah perangkat yang dimatikan.
    //
    // `site` OPSIONAL — tanpa itu perilakunya sama seperti sebelum refactor
    // ("logger ADR pertama"), supaya pemanggil lama tidak berhenti bekerja.
    // Kirim `site` bila sudah ada lebih dari satu unit RTS terdaftar; lihat
    // peringatan di getLoggerForCommand().
    const id_logger = await getLoggerForCommand(site);
    if (!id_logger) {
      return NextResponse.json(
        {
          success: false,
          error: site
            ? `Logger untuk site "${site}" tidak ditemukan`
            : "ADR logger not found",
        },
        { status: 404 }
      );
    }

    const topicTarget = topikPerintah(id_logger);
    const payload = {
      [`set_${id_logger}`]: {
        command: "set_rts",
        ...(action === "on" ? { PowerOn: "true" } : { PowerOff: "true" }),
      },
    };

    // Fire and forget — tidak menunggu balasan, frontend yang tangkap via MQTT
    publishMqttFireAndForget(topicTarget, payload);

    return NextResponse.json({ success: true, data: { action } });
  } catch (error) {
    console.error("[POST /api/kontrol/power]", error);
    return NextResponse.json({ success: false, error: "Failed to send power command" }, { status: 500 });
  }
}

function publishMqttFireAndForget(topic: string, payload: object) {
  const config = {
    host: process.env.MQTT_HOST || "mqtt.beacontelemetry.com",
    port: parseInt(process.env.MQTT_PORT || "8883", 10),
    username: process.env.MQTT_USERNAME || "userlog",
    password: process.env.MQTT_PASSWORD || "b34c0n",
  };

  const url = `mqtts://${config.host}:${config.port}`;
  const client = mqtt.connect(url, {
    username: config.username,
    password: config.password,
    rejectUnauthorized: process.env.MQTT_REJECT_UNAUTHORIZED === "true",
    connectTimeout: 5000,
  });

  client.on("connect", () => {
    client.publish(topic, JSON.stringify(payload), { qos: 0 }, () => {
      client.end();
    });
  });

  client.on("error", () => {
    client.end(true);
  });
}
