import { NextRequest, NextResponse } from "next/server";
import { publishMqtt, topikPerintah } from "@/lib/mqtt";
import { getLoggerForSite } from "@/lib/sites";
import {
  BAWAAN_JUMLAH_REPLAY,
  MAKS_JUMLAH_REPLAY,
  validasiTanggalReplay,
} from "@/lib/protokol-rts";

/**
 * POST /api/kontrol/replay
 *
 * Menarik ulang rekaman dari kartu SD (PROTOKOL_MQTT_ADR, Bagian C.8 —
 * `_timeScheduled`).
 *
 *   {"set_30002":{"command":"set_rts","replay":{"tanggal":"20260903",
 *                                               "target":"P5","jam":"14:30"}}}
 *
 *   {"Replay":{"value":"data","rows":[…],"cocok":3,"terkirim":3,"sisa":0}}
 *   {"Replay":{"value":"done"}}
 *
 * Hanya `tanggal` yang wajib — itu yang memilih berkasnya. Sisanya penyaring.
 * Selama `sisa` di atas nol, panggil lagi dengan `lewati` dinaikkan sebanyak
 * yang sudah terkirim; paging-nya dikendalikan pemanggil, bukan di sini.
 *
 * Perintah ini hanya ada di varian firmware `_timeScheduled`, dan ia MENEKAN
 * ack kolektif setelan — jadi jangan digabung dengan perintah setelan apa pun
 * dalam satu payload.
 *
 * Body: { site, tanggal, target?, jam?, dari?, sampai?, jumlah?, lewati? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { site, tanggal, target, jam, dari, sampai, jumlah, lewati } = body as {
      site?: string;
      tanggal?: string;
      target?: string;
      jam?: string;
      dari?: string;
      sampai?: string;
      jumlah?: number;
      lewati?: number;
    };

    if (!site) {
      return NextResponse.json({ success: false, error: "site wajib diisi" }, { status: 400 });
    }

    const salah = validasiTanggalReplay(tanggal);
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

    // Firmware sudah membatasi 20, tapi dijepit di sini juga supaya jumlah yang
    // diminta sama dengan jumlah yang dipakai menghitung `lewati` berikutnya.
    // Kalau tidak, paging-nya melompati baris yang tidak pernah terkirim.
    const n = Number(jumlah);
    const jumlahAman = Number.isInteger(n)
      ? Math.min(Math.max(n, 1), MAKS_JUMLAH_REPLAY)
      : BAWAAN_JUMLAH_REPLAY;

    const replay: Record<string, string | number> = {
      tanggal: String(tanggal).trim(),
      jumlah: jumlahAman,
    };
    // Penyaring kosong DIHILANGKAN, bukan dikirim sebagai string kosong:
    // `target` dicocokkan persis, jadi "" tidak akan pernah cocok dengan
    // apa pun dan hasilnya balasan `empty` yang menyesatkan.
    if (target) replay.target = String(target).trim();
    if (jam) replay.jam = String(jam).trim();
    if (dari) replay.dari = String(dari).trim();
    if (sampai) replay.sampai = String(sampai).trim();
    if (Number.isInteger(Number(lewati)) && Number(lewati) > 0) replay.lewati = Number(lewati);

    const mqttSent = await publishMqtt(topikPerintah(id_logger), {
      [`set_${id_logger}`]: { command: "set_rts", replay },
    });

    return NextResponse.json({
      success: true,
      data: { site, id_logger, replay, mqtt_sent: mqttSent },
    });
  } catch (error) {
    console.error("[POST /api/kontrol/replay]", error);
    return NextResponse.json(
      { success: false, error: "Gagal meminta rekaman SD" },
      { status: 500 }
    );
  }
}
