import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishMqtt, topikPerintah } from "@/lib/mqtt";
import { getLoggerForSite } from "@/lib/sites";
import { validasiTrackEvery, validasiTrackRest, validasiModeJadwal } from "@/lib/protokol-rts";

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
 * Logger BL1100 punya mode kedua, `istirahat` — body membawa `mode`:
 *
 *   {"set_30002":{"command":"set_rts","trackMode":"istirahat","trackRest":3}}
 *   {"set_30002":{"command":"set_rts","trackMode":"jam","trackEvery":10}}
 *
 * `trackRest` = istirahat ANTAR siklus dalam menit (0–1440, 0 = mati), dihitung
 * dari SELESAINYA siklus. `trackMode` diproses firmware sebelum `trackRest`.
 * Tanpa `mode` perilaku persis seperti sebelumnya, jadi pemanggil lama dan
 * logger yang belum BL1100 tidak terpengaruh. Pemanggil hanya boleh menyertakan
 * `mode` untuk logger yang TERBUKTI BL1100 (get_config melaporkan trackMode):
 * firmware lain mengabaikan kunci itu tanpa balasan sehingga kegagalannya tak
 * akan ketahuan.
 *
 * Dikirim SENDIRIAN, tidak digabung ke /api/config-adr, karena akhirannya
 * berbeda: setelan lain ditunggu ack-nya, yang ini justru WAJAR tidak dijawab
 * di unit non-`_timeScheduled`. Dicampur jadi satu, diamnya perangkat tidak
 * bisa lagi dibedakan dari ack konfigurasi yang hilang.
 *
 * Nilainya DICATAT ke config_adr sesudah perintahnya terkirim. Pada firmware
 * lama jadwal TIDAK ikut di snapshot ack, jadi database satu-satunya tempat
 * nilainya bisa diingat; pada BL1100 `get_config` melaporkannya dan catatan ini
 * hanya cadangan saat logger tidak menjawab. Tetap bukan bukti keadaan
 * perangkat, dan tidak boleh dipakai untuk melewatkan pengiriman.
 *
 * Perintah ini hanya ada di varian firmware `_timeScheduled`. Unit lain
 * mengabaikannya TANPA balasan apa pun — tidak ada balasan bukan berarti
 * perintahnya tidak sampai.
 *
 * Body: { site: string, menit: number, mode?: "jam" | "istirahat", istirahat?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { site, menit, mode, istirahat } = body as {
      site?: string;
      menit?: number;
      mode?: string;
      istirahat?: number;
    };

    if (!site) {
      return NextResponse.json({ success: false, error: "site wajib diisi" }, { status: 400 });
    }

    // Hanya aturan milik mode yang dipakai: pada mode istirahat `trackEvery`
    // diabaikan firmware, dan sebaliknya.
    const pakaiMode = mode !== undefined;
    const salah = pakaiMode
      ? validasiModeJadwal(mode) ||
        (mode === "istirahat" ? validasiTrackRest(istirahat) : validasiTrackEvery(menit))
      : validasiTrackEvery(menit);
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

    const perintah: Record<string, unknown> = { command: "set_rts" };
    if (!pakaiMode) {
      perintah.trackEvery = Number(menit);
    } else if (mode === "istirahat") {
      perintah.trackMode = "istirahat";
      perintah.trackRest = Number(istirahat);
    } else {
      perintah.trackMode = "jam";
      perintah.trackEvery = Number(menit);
    }

    const mqttSent = await publishMqtt(topikPerintah(id_logger), {
      [`set_${id_logger}`]: perintah,
    });

    // Perangkat non-`_timeScheduled` mengabaikan perintah ini TANPA balasan,
    // jadi yang dicatat memang cuma "sudah dikirim" — tidak ada konfirmasi yang
    // bisa ditunggu. Publish yang gagal tidak dicatat.
    let tercatat = false;
    if (mqttSent) {
      // Kolom jam dicatat hanya pada mode jam (atau tanpa mode): pada mode
      // istirahat `menit` bukan nilai yang dikirim, dan menimpanya dengan angka
      // itu akan mengaburkan catatan terakhir milik mode jam.
      if (!pakaiMode || mode === "jam") {
        await prisma.$executeRaw`
          UPDATE config_adr SET track_every = ${Number(menit)} WHERE site = ${site}
        `;
      }
      // Kolom mode/istirahat (migrasi 020) opsional: kalau belum dijalankan,
      // perintahnya tetap sudah sampai dan respons membawa `tercatat: false`.
      if (pakaiMode) {
        try {
          if (mode === "istirahat") {
            await prisma.$executeRaw`
              UPDATE config_adr SET track_mode = 'istirahat', track_rest = ${Number(istirahat)}
              WHERE site = ${site}
            `;
          } else {
            await prisma.$executeRaw`
              UPDATE config_adr SET track_mode = 'jam' WHERE site = ${site}
            `;
          }
          tercatat = true;
        } catch (error) {
          console.error("[POST /api/kontrol/track-every] gagal mencatat mode jadwal", error);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        site,
        id_logger,
        menit: Number(menit),
        mode: pakaiMode ? mode : undefined,
        istirahat: pakaiMode && mode === "istirahat" ? Number(istirahat) : undefined,
        mqtt_sent: mqttSent,
        tercatat,
      },
    });
  } catch (error) {
    console.error("[POST /api/kontrol/track-every]", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengirim jadwal AutoTracking" },
      { status: 500 }
    );
  }
}
