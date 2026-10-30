import { NextRequest, NextResponse } from "next/server";
import { publishMqtt, topikPerintah } from "@/lib/mqtt";
import { getLoggerForSite } from "@/lib/sites";
import { buatPayloadSapuan, validasiSapuan, type PermintaanSapuan } from "@/lib/protokol-rts";

/**
 * POST /api/kontrol/auto-search-custom
 *
 * Uji sapuan custom sekali jalan (ADR_RTS_PORTING §3.2, `command:"autosearch"`).
 *
 *   {"set_10284":{"command":"autosearch","jenis":"custom","step":"0,30,00",
 *                 "Hlebar":"1,00,00","Vlebar":"1,00,00","rehat":500}}
 *
 * Ini BUKAN `auto_search` (rute /api/kontrol/auto-search): itu menyuruh
 * AutoSearch bawaan instrumen, sedangkan ini menyapu dengan langkah dan rentang
 * yang dipilih operator — dipakai menguji target jauh, di mana jendela bawaan
 * terlalu kasar. Setelan tersimpan di instrumen tidak diubah.
 *
 * Titik tengah sapuan = arah bidik instrumen SAAT perintah dijalankan, jadi
 * instrumen harus diarahkan ke perkiraan posisi prisma lebih dulu
 * (turning_target / jog). Rute ini tidak menggerakkannya.
 *
 * Fire-and-forget: progres dan hasil ditangkap browser lewat `pub_<id>`
 * (bacaBalasanSapuan). `aksi:"stop"` membatalkan sapuan yang sedang berjalan.
 *
 * `site` WAJIB, tanpa fallback "logger ADR pertama": perintah ini memutar
 * instrumen, dan menebak tujuannya berarti menggerakkan alat milik site lain.
 *
 * Body: { site, aksi?: "mulai" | "stop", step, Hlebar, Vlebar, rehat? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as PermintaanSapuan & {
      site?: string;
      aksi?: string;
    };
    const { site } = body;

    if (!site) {
      return NextResponse.json({ success: false, error: "site wajib diisi" }, { status: 400 });
    }

    const aksi = body.aksi === undefined || body.aksi === "mulai" ? "mulai" : body.aksi;
    if (aksi !== "mulai" && aksi !== "stop") {
      return NextResponse.json(
        { success: false, error: 'aksi harus "mulai" atau "stop"' },
        { status: 400 }
      );
    }

    // Divalidasi sebelum menyentuh MQTT: instrumen yang sudah diperintah
    // bergerak tidak bisa ditarik kembali, dan firmware baru menolak lewat
    // balasan yang datang belakangan.
    const hasil = aksi === "mulai" ? validasiSapuan(body) : null;
    if (hasil && !hasil.ok) {
      return NextResponse.json({ success: false, error: hasil.galat }, { status: 400 });
    }

    const id_logger = await getLoggerForSite(site);
    if (!id_logger) {
      return NextResponse.json(
        { success: false, error: `Logger untuk site "${site}" tidak ditemukan` },
        { status: 404 }
      );
    }

    const payload = buatPayloadSapuan(id_logger, aksi, body);
    const mqttSent = await publishMqtt(topikPerintah(id_logger), payload);

    return NextResponse.json({
      success: true,
      data: {
        site,
        id_logger,
        aksi,
        mqtt_sent: mqttSent,
        // Perkiraan untuk ditampilkan sebelum/ sesudah jalan; minimalDetik
        // adalah batas bawah (belum termasuk waktu ukur per titik).
        rencana: hasil && hasil.ok ? hasil.rencana : null,
      },
    });
  } catch (error) {
    console.error("[POST /api/kontrol/auto-search-custom]", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengirim uji sapuan" },
      { status: 500 }
    );
  }
}
