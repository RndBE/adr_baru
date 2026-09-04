import { NextRequest, NextResponse } from "next/server";
import { publishMqtt, topikPerintah } from "@/lib/mqtt";
import { getLoggerForSite } from "@/lib/sites";
import { validasiSearchArea } from "@/lib/protokol-rts";

/**
 * POST /api/kontrol/search-area
 *
 * Menyetel rentang sapuan pencarian prisma (PROTOKOL_MQTT_ADR, Bagian D).
 *
 *   {"set_30002":{"command":"set_rts","SearchArea":{"Hor":15,"Ver":15}}}
 *   → {"SearchArea":{"horizontal":15,"vertical":15}}
 *
 * Nama medannya BERBEDA antara permintaan (`Hor`/`Ver`) dan balasan
 * (`horizontal`/`vertical`).
 *
 * Dikirim SENDIRIAN, tidak digabung ke setelan lain di /api/config-adr. Dua
 * alasan:
 *
 * 1. Nilainya tidak disimpan aplikasi. Perangkat sudah melaporkannya balik —
 *    lewat balasan ini dan lewat snapshot ack konfigurasi — jadi menambah kolom
 *    database berarti membuat sumber kebenaran kedua untuk besaran yang sama.
 *    Repo ini sudah punya masalah persis itu pada koordinat origin
 *    (config_adr.coor_* vs t_site.rts_*), dan tidak perlu yang ketiga.
 *
 * 2. Waktunya berbeda. `auto_search` yang dikirim sendirian memakai apa pun
 *    yang sedang ada di instrumen, dan PowerOn menimpanya dengan 7° yang
 *    ter-hardcode. Jadi rentang ini perlu dikirim TEPAT SEBELUM auto_search,
 *    bukan sekali saat menyimpan konfigurasi.
 *
 * Body: { site: string, hor: number, ver: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { site, hor, ver } = body as { site?: string; hor?: number; ver?: number };

    if (!site) {
      return NextResponse.json({ success: false, error: "site wajib diisi" }, { status: 400 });
    }

    const salah = validasiSearchArea(hor, ver);
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
        // `Hor`/`Ver` — bentuk PERMINTAAN. Balasannya memakai nama lain.
        SearchArea: { Hor: Number(hor), Ver: Number(ver) },
      },
    };
    const mqttSent = await publishMqtt(topicTarget, payload);

    return NextResponse.json({
      success: true,
      data: { site, id_logger, hor: Number(hor), ver: Number(ver), mqtt_sent: mqttSent },
    });
  } catch (error) {
    console.error("[POST /api/kontrol/search-area]", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengirim SearchArea" },
      { status: 500 }
    );
  }
}
