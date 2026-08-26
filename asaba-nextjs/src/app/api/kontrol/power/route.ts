import { NextRequest, NextResponse } from "next/server";
import mqtt from "mqtt";
import { getLoggerForSite } from "@/lib/sites";

/**
 * POST /api/kontrol/power
 * Power On/Off RTS via MQTT (fire-and-forget).
 * Balasan dari logger akan ditangkap langsung oleh frontend via MQTT.
 *
 * Body: { action: "on" | "off", site: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, site } = body;

    if (action !== "on" && action !== "off") {
      return NextResponse.json({ success: false, error: `action harus "on" atau "off"` }, { status: 400 });
    }

    // Perintah ini menyalakan/mematikan unit RTS. Logger diturunkan dari site,
    // bukan "logger ADR pertama" — dengan lebih dari satu unit terdaftar,
    // LIMIT 1 tanpa ORDER BY bisa mematikan perangkat milik site lain.
    if (!site) {
      return NextResponse.json({ success: false, error: "site wajib diisi" }, { status: 400 });
    }
    const id_logger = await getLoggerForSite(site);
    if (!id_logger) {
      return NextResponse.json(
        { success: false, error: `Logger untuk site "${site}" tidak ditemukan` },
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
