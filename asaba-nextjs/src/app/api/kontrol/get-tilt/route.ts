import { NextRequest, NextResponse } from "next/server";
import { publishMqtt, topikPerintah } from "@/lib/mqtt";
import { getLoggerForSite } from "@/lib/sites";

/**
 * POST /api/kontrol/get-tilt
 *
 * Membaca kemiringan instrumen (PROTOKOL_MQTT_ADR, Bagian C).
 *
 *   {"set_30002":{"command":"set_rts","getTilt":true}}
 *   → {"data_tilt":{"tilt1":"-0.00732","tilt2":"0.0198"}}
 *
 * Nama balasannya `data_tilt`, bukan `getTilt`. Jangan tertukar dengan pesan
 * `Tilt`, yang merupakan diagnostik KEGAGALAN komunikasi, sebentuk dengan
 * `Rotate` dan `Idle`.
 *
 * Nilai yang dibaca adalah yang terakhir tersimpan di logger, disegarkan
 * sendiri tiap menit — perintah ini tidak memaksa pembacaan baru ke instrumen,
 * jadi tidak menggerakkan apa pun dan aman dipanggil kapan saja.
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

    const mqttSent = await publishMqtt(topikPerintah(id_logger), {
      [`set_${id_logger}`]: { command: "set_rts", getTilt: true },
    });

    return NextResponse.json({ success: true, data: { site, id_logger, mqtt_sent: mqttSent } });
  } catch (error) {
    console.error("[POST /api/kontrol/get-tilt]", error);
    return NextResponse.json(
      { success: false, error: "Gagal membaca kemiringan instrumen" },
      { status: 500 }
    );
  }
}
