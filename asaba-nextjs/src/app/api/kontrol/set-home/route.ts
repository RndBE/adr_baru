import { NextRequest, NextResponse } from "next/server";
import { publishMqtt } from "@/lib/mqtt";
import { getLoggerForSite } from "@/lib/sites";

/**
 * POST /api/kontrol/set-home
 *
 * Menyimpan orientasi teleskop SAAT INI sebagai posisi home
 * (PROTOKOL_MQTT_ADR, Bagian C.1 — kunci `setHome`).
 *
 * `site` WAJIB, tidak seperti auto-search/power yang membiarkannya opsional
 * demi pemanggil lama. Endpoint ini baru, jadi tidak ada pemanggil lama yang
 * perlu dijaga — dan salah menebak logger di sini berarti menimpa posisi home
 * milik site lain, yang baru ketahuan saat PowerOff atau AutoTracking memutar
 * teleskop ke arah yang keliru.
 *
 * Tabel C.1 protokol menulis perintah ini TIDAK punya balasan. Kenyataannya
 * firmware membalas (terlihat 31 Agustus 2026):
 *
 *   {"setHome":{"setHome":",0,061,41,90,199,18,72;"}}
 *
 * Kunci dalamnya mengulang nama perintahnya, bukan `value` seperti aturan dasar
 * #2. Balasan itu ditangkap browser lewat MQTT WebSocket, bukan di sini — route
 * ini tetap fire-and-forget seperti auto-search dan go-to-target, jadi `success`
 * hanya berarti perintahnya terkirim ke broker.
 *
 * Body: { site: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { site } = body as { site?: string };

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
    // Nilai kunci tidak diperiksa untuk perintah aksi — firmware hanya mengecek
    // keberadaan kuncinya (Bagian C.1). `true` dipakai supaya seragam dengan
    // perintah aksi lain di kode ini.
    const payload = {
      [`set_${id_logger}`]: {
        command: "set_rts",
        setHome: true,
      },
    };
    const mqttSent = await publishMqtt(topicTarget, payload);

    return NextResponse.json({
      success: true,
      // Dinamai apa adanya: yang dijamin hanya pengiriman, bukan penyimpanan.
      // Tanpa balasan dari firmware, tidak ada cara memastikan lebih dari ini.
      data: { site, id_logger, mqtt_sent: mqttSent },
      message: "Perintah Set Home terkirim. Konfirmasinya datang lewat MQTT.",
    });
  } catch (error) {
    console.error("[POST /api/kontrol/set-home]", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengirim perintah Set Home" },
      { status: 500 }
    );
  }
}
