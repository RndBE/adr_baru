import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
 * Dikirim SENDIRIAN, tidak digabung ke /api/config-adr, karena akhirannya
 * berbeda: setelan lain ditunggu ack-nya, yang ini justru WAJAR tidak dijawab
 * di unit non-`_timeScheduled`. Dicampur jadi satu, diamnya perangkat tidak
 * bisa lagi dibedakan dari ack konfigurasi yang hilang.
 *
 * Nilainya DICATAT ke config_adr sesudah perintahnya terkirim. Beda dari
 * setelan lain, jadwal ini TIDAK ikut di snapshot ack — perangkat tidak pernah
 * melaporkannya balik sama sekali — jadi database satu-satunya tempat nilainya
 * bisa diingat. Karena itu pula catatan ini tidak bisa dicocokkan dengan
 * keadaan perangkat, dan tidak boleh dipakai untuk melewatkan pengiriman.
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

    // Perangkat non-`_timeScheduled` mengabaikan perintah ini TANPA balasan,
    // jadi yang dicatat memang cuma "sudah dikirim" — tidak ada konfirmasi yang
    // bisa ditunggu. Publish yang gagal tidak dicatat.
    if (mqttSent) {
      await prisma.$executeRaw`
        UPDATE config_adr SET track_every = ${Number(menit)} WHERE site = ${site}
      `;
    }

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
