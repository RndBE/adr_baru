import { NextRequest, NextResponse } from "next/server";
import { publishMqtt, topikPerintah } from "@/lib/mqtt";
import { getLoggerForSite } from "@/lib/sites";
import { JENIS_UKUR, type KodeUkur } from "@/lib/protokol-rts";

/**
 * POST /api/kontrol/measure
 *
 * Mengukur backsight atau foresight (PROTOKOL_MQTT_ADR, Bagian C.2).
 *
 *   {"set_30002":{"command":"set_rts","measure_fs":true}}
 *   → {"MeasureFS":{"HADMS":…,"VADMS":…,"SDis":…,"HD":…}}
 *
 * Satu route untuk keduanya: perbedaannya hanya nama kunci perintah, dan
 * menduplikasi berkas hanya menambah tempat yang bisa menyimpang sendiri.
 *
 * `site` WAJIB. Perintah ini memang tidak memutar teleskop, tapi hasil ukurnya
 * dipakai sebagai data survei — bacaan dari instrumen site lain jauh lebih
 * berbahaya daripada sekadar tidak berguna.
 *
 * Fire-and-forget; tahapan dan hasilnya ditangkap browser lewat MQTT.
 *
 * Body: { site: string, jenis: "bs" | "fs" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { site, jenis } = body as { site?: string; jenis?: string };

    if (!site) {
      return NextResponse.json({ success: false, error: "site wajib diisi" }, { status: 400 });
    }

    if (jenis !== "bs" && jenis !== "fs") {
      return NextResponse.json(
        { success: false, error: 'jenis harus "bs" (backsight) atau "fs" (foresight)' },
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

    const spek = JENIS_UKUR[jenis as KodeUkur];
    const topicTarget = topikPerintah(id_logger);
    const payload = {
      [`set_${id_logger}`]: {
        command: "set_rts",
        // Nilainya diabaikan firmware — hanya keberadaan kuncinya yang dicek.
        [spek.perintah]: true,
      },
    };
    const mqttSent = await publishMqtt(topicTarget, payload);

    return NextResponse.json({
      success: true,
      data: { site, id_logger, jenis, perintah: spek.perintah, mqtt_sent: mqttSent },
    });
  } catch (error) {
    console.error("[POST /api/kontrol/measure]", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengirim perintah ukur" },
      { status: 500 }
    );
  }
}
