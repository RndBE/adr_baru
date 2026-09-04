import { NextRequest, NextResponse } from "next/server";
import { publishMqtt, topikPerintah } from "@/lib/mqtt";
import { getLoggerForSite } from "@/lib/sites";

/**
 * POST /api/kontrol/manual-hava
 *
 * Membaca sudut HA/VA instrumen SAAT INI (PROTOKOL_MQTT_ADR, Bagian C.1).
 *
 *   {"set_30002":{"command":"set_rts","manual_hava":true}}
 *   → {"ManualHAVA":{"HA":"151,38,71","VA":"206,04,62"}}
 *
 * Perintah ini TIDAK menggerakkan apa pun — hanya membaca, timeout 5 detik.
 * Dokumen menyebutnya alat diagnosis tercepat: panggil beberapa kali tanpa
 * menggerakkan instrumen, lalu bandingkan dengan angka di layarnya.
 *
 * Kalau instrumen tidak menjawab, KEDUA nilainya menjadi "000,00,00" — itu
 * penanda gagal, bukan sudut sungguhan. Pemilahannya di sisi UI.
 *
 * `site` tetap WAJIB meski tidak menggerakkan apa pun: tanpa itu bacaannya bisa
 * datang dari instrumen site lain dan menyesatkan justru saat dipakai
 * mendiagnosis.
 *
 * Body: { site: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { site } = body as { site?: string };

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

    const topicTarget = topikPerintah(id_logger);
    const payload = {
      [`set_${id_logger}`]: { command: "set_rts", manual_hava: true },
    };
    const mqttSent = await publishMqtt(topicTarget, payload);

    return NextResponse.json({
      success: true,
      data: { site, id_logger, mqtt_sent: mqttSent },
    });
  } catch (error) {
    console.error("[POST /api/kontrol/manual-hava]", error);
    return NextResponse.json(
      { success: false, error: "Gagal membaca sudut instrumen" },
      { status: 500 }
    );
  }
}
