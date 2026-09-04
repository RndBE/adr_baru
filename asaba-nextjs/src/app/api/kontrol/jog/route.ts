import { NextRequest, NextResponse } from "next/server";
import { publishMqtt, topikPerintah } from "@/lib/mqtt";
import { getLoggerForSite } from "@/lib/sites";
import { validasiJog } from "@/lib/protokol-rts";

/**
 * POST /api/kontrol/jog
 *
 * Menggeser arah teleskop secara RELATIF dari posisi sekarang
 * (PROTOKOL_MQTT_ADR, Bagian C.5 — kunci `jog`).
 *
 *   {"set_30002":{"command":"set_rts","jog":{"ha":0.5,"va":-0.01}}}
 *
 * Satuan DERAJAT DESIMAL, pecahan diterima. Menit ÷ 60, detik ÷ 3600.
 * Berubah dari detik busur di revisi 2 — selisihnya 3600× dan tidak
 * memunculkan galat apa pun kalau tertukar.
 *
 * `va` adalah sudut ZENIT — 90° berarti mendatar, jadi nilai POSITIF membuat
 * teleskop MENUNDUK. Pemetaan tombol arah ada di sisi UI; route ini meneruskan
 * angka apa adanya supaya hanya ada satu tempat yang memutuskan arah.
 *
 * `site` WAJIB: perintah ini menggerakkan instrumen, dan salah menebak logger
 * berarti memutar teleskop milik site lain.
 *
 * Fire-and-forget seperti auto-search; tahapan dan penolakannya ditangkap
 * browser lewat MQTT sebagai balasan bernama `Jog`.
 *
 * Body: { site: string, ha: number, va: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { site, ha, va } = body as { site?: string; ha?: number; va?: number };

    if (!site) {
      return NextResponse.json({ success: false, error: "site wajib diisi" }, { status: 400 });
    }

    const salah = validasiJog(ha, va);
    if (salah) {
      return NextResponse.json({ success: false, error: salah }, { status: 400 });
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
      [`set_${id_logger}`]: {
        command: "set_rts",
        jog: { ha: Number(ha), va: Number(va) },
      },
    };
    const mqttSent = await publishMqtt(topicTarget, payload);

    return NextResponse.json({
      success: true,
      data: { site, id_logger, ha: Number(ha), va: Number(va), mqtt_sent: mqttSent },
    });
  } catch (error) {
    console.error("[POST /api/kontrol/jog]", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengirim perintah jog" },
      { status: 500 }
    );
  }
}
