import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishMqtt } from "@/lib/mqtt";
import mqtt from "mqtt";

/**
 * POST /api/kontrol/auto-search
 * Kirim auto_search ke logger, tunggu konfirmasi (AutoSearch.nilai),
 * lalu background-listen untuk recordTarget HA/VA dan simpan ke t_prisma.
 *
 * Body: { slot_id?: number }
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

    // Subscribe MQTT dulu, lalu kirim auto_search
    const result = await subscribeAndSend(topicTarget, id_logger, body.slot_id);

    return NextResponse.json({
      success: true,
      data: {
        slot_id: body.slot_id ?? null,
        mqtt_sent: true,
        response: result,
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
 * Subscribe ke topic MQTT, kirim auto_search, tunggu:
 * 1. Konfirmasi AutoSearch.nilai (cepat, ~5 detik)
 * 2. recordTarget dengan HA/VA (tunggu max 30 detik setelah konfirmasi)
 * Return segera setelah recordTarget datang atau timeout.
 */
function subscribeAndSend(
  topic: string,
  id_logger: string,
  slot_id?: number
): Promise<{
  confirmed: boolean;
  HA?: string;
  VA?: string;
  TargetName?: string;
} | null> {
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

    let confirmed = false;
    let haVaReceived = false;

    // Timeout total: 35 detik
    const totalTimer = setTimeout(() => {
      console.log("[AutoSearch] Total timeout");
      client.end(true);
      resolve(confirmed ? { confirmed: true } : null);
    }, 35000);

    client.on("connect", () => {
      console.log("[AutoSearch] Connected, subscribing to", topic);
      client.subscribe(topic, () => {
        // Kirim auto_search setelah subscribe
        const payload = {
          [`set_${id_logger}`]: {
            command: "set_rts",
            auto_search: true,
          },
        };
        client.publish(topic, JSON.stringify(payload), { qos: 0 });
        console.log("[AutoSearch] Sent auto_search command");
      });
    });

    client.on("message", async (_t: string, message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());

        // 1. Konfirmasi: { "AutoSearch": { "nilai": 1 } }
        if (data?.AutoSearch?.nilai !== undefined && !confirmed) {
          confirmed = true;
          console.log("[AutoSearch] Confirmed by logger, nilai:", data.AutoSearch.nilai);
        }

        // 2. recordTarget dengan HA/VA
        const rt = data?.recordTarget;
        if (rt && rt.HA && rt.VA && !haVaReceived) {
          haVaReceived = true;
          console.log("[AutoSearch] Got HA/VA:", rt.HA, rt.VA);

          // Simpan ke t_prisma
          const id_prisma = slot_id ? `P${slot_id}` : rt.TargetName;
          if (id_prisma) {
            try {
              await prisma.$executeRaw`
                UPDATE t_prisma
                SET HA = ${String(rt.HA)}, VA = ${String(rt.VA)}
                WHERE id_prisma = ${id_prisma}
              `;
              console.log("[AutoSearch] Saved HA/VA to t_prisma for", id_prisma);
            } catch (dbErr) {
              console.error("[AutoSearch] DB save error:", dbErr);
            }
          }

          clearTimeout(totalTimer);
          client.end();
          resolve({
            confirmed: true,
            HA: String(rt.HA),
            VA: String(rt.VA),
            TargetName: rt.TargetName,
          });
        }
      } catch {
        // Ignore
      }
    });

    client.on("error", (err: Error) => {
      console.error("[AutoSearch] MQTT error:", err);
      clearTimeout(totalTimer);
      client.end();
      resolve(null);
    });
  });
}
