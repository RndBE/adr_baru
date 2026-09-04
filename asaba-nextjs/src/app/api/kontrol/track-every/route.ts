import { NextRequest, NextResponse } from "next/server";
import { publishMqtt, topikPerintah } from "@/lib/mqtt";
import { getLoggerForSite } from "@/lib/sites";
import { validasiTrackEvery } from "@/lib/protokol-rts";

/**
 * POST /api/kontrol/track-every
 *
 * Menyetel jadwal AutoTracking (PROTOKOL_MQTT_ADR, Bagian D — `_timeScheduled`).
 *
 *   {"set_30002":{"command":"set_rts","trackEvery":10}}
 *
 * `0` mematikan jadwal. Nilai di luar 5/10/15/20/30/60 ditolak perangkat lewat
 * `error_trackEvery`, tapi divalidasi di sini juga supaya penolakannya punya
 * kalimat yang bisa dibaca operator.
 *
 * Dikirim SENDIRIAN, tidak digabung ke /api/config-adr. Setelan ini tidak
 * disimpan aplikasi: nilainya dilaporkan balik perangkat lewat snapshot ack
 * konfigurasi, jadi menambah kolom database berarti membuat sumber kebenaran
 * kedua untuk besaran yang sama.
 *
 * Perintah ini hanya ada di varian firmware `_timeScheduled`. Unit lain
 * mengabaikannya TANPA balasan apa pun — tidak ada balasan bukan berarti
 * perintahnya tidak sampai.
 *
 * Body: { site: string, menit: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { site, menit } = body as { site?: string; menit?: number };

    if (!site) {
      return NextResponse.json({ success: false, error: "site wajib diisi" }, { status: 400 });
    }

    const salah = validasiTrackEvery(menit);
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

    const mqttSent = await publishMqtt(topikPerintah(id_logger), {
      [`set_${id_logger}`]: { command: "set_rts", trackEvery: Number(menit) },
    });

    return NextResponse.json({
      success: true,
      data: { site, id_logger, menit: Number(menit), mqtt_sent: mqttSent },
    });
  } catch (error) {
    console.error("[POST /api/kontrol/track-every]", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengirim jadwal AutoTracking" },
      { status: 500 }
    );
  }
}
