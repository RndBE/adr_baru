import { NextRequest, NextResponse } from "next/server";
import { publishMqtt } from "@/lib/mqtt";
import { getLoggerForCommand } from "@/lib/sites";

/**
 * POST /api/kontrol/auto-search
 * Setara dengan Adr::auto_search() di CI3.
 * Hanya kirim auto_search ke logger — fire-and-forget.
 * Response dari logger ditangkap oleh frontend via MQTT WebSocket.
 *
 * Body: { slot_id?: number, site?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { site } = body as { site?: string };

    // `site` OPSIONAL — tanpa itu logger diturunkan seperti sebelum refactor
    // ("logger ADR pertama"), supaya pemanggil lama tetap bekerja. Kirim `site`
    // begitu ada lebih dari satu unit RTS: auto_search menggerakkan alat, jadi
    // menebak tujuan berarti menyapu perangkat milik site lain.
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
