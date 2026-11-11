import { NextRequest, NextResponse } from "next/server";
import { publishMqtt, topikPerintah } from "@/lib/mqtt";
import { getLoggerForSite } from "@/lib/sites";

/**
 * POST /api/kontrol/get-config
 *
 * Meminta logger melaporkan setelan RTS-nya yang berlaku sekarang.
 *
 *   {"set_30002":{"command":"set_rts","get_config":true}}
 *   → {"RTSConfig":{"jobName":"Demo","retries":1,"cycleTime":3000,...}}
 *
 * Hanya baca: tidak menyentuh RS232 maupun flash, dan dijawab juga saat RTS
 * sedang dipakai atau mati — nilainya dipegang logger, bukan instrumen.
 *
 * Seperti get-tilt, rute ini HANYA menerbitkan perintahnya. Balasannya tidak
 * lewat respons HTTP: ia datang di `pub_<idAlat>` dan dibaca browser lewat
 * langganan MQTT-nya sendiri (kontrol-adr/page.tsx), sebab server ini tidak
 * pernah berlangganan topik balasan.
 *
 * Dikirim SENDIRIAN. Snapshot ack setelan tidak dikirim bila pesan memuat
 * `get_config`, dan bila digabung dengan setelan lain, setelan diproses dulu
 * sehingga balasannya sudah memuat nilai baru — bukan yang ingin dibaca.
 *
 * Hanya firmware BL1100 yang mengenalnya. Logger Arduino tidak membalas apa
 * pun, jadi pemanggil wajib punya batas waktu dan jatuh ke database.
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
      [`set_${id_logger}`]: { command: "set_rts", get_config: true },
    });

    return NextResponse.json({ success: true, data: { site, id_logger, mqtt_sent: mqttSent } });
  } catch (error) {
    console.error("[POST /api/kontrol/get-config]", error);
    return NextResponse.json(
      { success: false, error: "Gagal meminta setelan dari logger" },
      { status: 500 }
    );
  }
}
