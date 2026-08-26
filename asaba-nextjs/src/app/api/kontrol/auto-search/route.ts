import { NextRequest, NextResponse } from "next/server";
import { publishMqtt } from "@/lib/mqtt";
import { getLoggerForSite } from "@/lib/sites";

/**
 * POST /api/kontrol/auto-search
 * Setara dengan Adr::auto_search() di CI3.
 * Hanya kirim auto_search ke logger — fire-and-forget.
 * Response dari logger ditangkap oleh frontend via MQTT WebSocket.
 *
 * Body: { slot_id?: number, site: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { site } = body as { site?: string };

    // Logger diturunkan dari site — perintah auto_search menggerakkan unit RTS,
    // jadi memilih "logger ADR pertama" bisa menyapu perangkat milik site lain.
    if (!site) {
      return NextResponse.json(
        { success: false, error: "site wajib diisi" },
        { status: 400 }
      );
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
