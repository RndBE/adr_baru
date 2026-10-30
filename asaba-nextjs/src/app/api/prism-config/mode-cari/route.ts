import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishMqtt, topikPerintah } from "@/lib/mqtt";
import { getLoggerForSite } from "@/lib/sites";
import {
  buatPayloadTargetSearch,
  formatModeCari,
  uraiModeCari,
  validasiModeCari,
} from "@/lib/protokol-rts";

/**
 * Ubah cara cari satu slot TANPA menyentuh sudutnya (ADR_RTS_PORTING §3.1).
 *
 * Dua langkah, sengaja dipisah:
 *
 *   POST  mengirim `targetSearch {slot, mode}` ke logger. Tidak menulis apa pun
 *         ke basis data.
 *   PUT   mencatat `mode_cari` di t_prisma. Dipanggil browser SESUDAH alat
 *         membalas `{"targetSearch":{...,"value":"OK"}}` di `pub_<id>`.
 *
 * Alasannya sama dengan search-area: yang dicatat di basis data adalah apa yang
 * sudah DIKONFIRMASI alat, bukan apa yang barusan diminta. Alat bisa menolak
 * (slot kosong, mode tak dikenal), dan catatan yang sudah terlanjur berubah
 * lalu menampilkan cara cari yang tidak pernah berlaku.
 *
 * Tidak memakai PUT /api/prism-config untuk ini: itu mengirim ulang
 * `recordTarget`, yang MEREKAM ULANG arah bidik sekarang dan menimpa sudut slot.
 *
 * `site` WAJIB, tanpa fallback ke logger pertama — slot "P1" di site berbeda
 * adalah target fisik berbeda, dan perintah menyentuh perangkat.
 *
 * Body: { site, slot_id, mode_cari }
 */
async function bacaPermintaan(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    site?: string;
    slot_id?: unknown;
    mode_cari?: unknown;
  };

  if (!body.site) {
    return { galat: NextResponse.json({ success: false, error: "site wajib diisi" }, { status: 400 }) };
  }
  const slot = Number(body.slot_id);
  if (!Number.isInteger(slot) || slot < 1 || slot > 50) {
    return {
      galat: NextResponse.json({ success: false, error: "slot_id harus bilangan bulat 1–50" }, { status: 400 }),
    };
  }
  // Di sini mode WAJIB diisi: kosong berarti bawaan "as" bagi firmware, tapi
  // untuk perintah ubah, kotak kosong lebih mungkin salah kirim daripada niat.
  if (body.mode_cari === undefined || String(body.mode_cari).trim() === "") {
    return { galat: NextResponse.json({ success: false, error: "mode_cari wajib diisi" }, { status: 400 }) };
  }
  const galatMode = validasiModeCari(body.mode_cari);
  if (galatMode) {
    return { galat: NextResponse.json({ success: false, error: galatMode }, { status: 400 }) };
  }
  const rantai = uraiModeCari(body.mode_cari) ?? ["as"];
  return { site: body.site, slot, rantai };
}

export async function POST(request: NextRequest) {
  try {
    const p = await bacaPermintaan(request);
    if ("galat" in p) return p.galat;

    const id_logger = await getLoggerForSite(p.site);
    if (!id_logger) {
      return NextResponse.json(
        { success: false, error: `Logger untuk site "${p.site}" tidak ditemukan` },
        { status: 404 }
      );
    }

    // Slotnya harus sudah terdaftar di site ini: targetSearch pada slot kosong
    // ditolak firmware, dan lebih baik ketahuan di sini dengan pesan yang jelas.
    const ada = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM t_prisma WHERE id_prisma = ${`P${p.slot}`} AND site = ${p.site} LIMIT 1
    `;
    if (ada.length === 0) {
      return NextResponse.json(
        { success: false, error: `Slot ${p.slot} belum terdaftar di site ini` },
        { status: 404 }
      );
    }

    const mqttSent = await publishMqtt(
      topikPerintah(id_logger),
      buatPayloadTargetSearch(id_logger, p.slot, p.rantai)
    );

    return NextResponse.json({
      success: true,
      data: { site: p.site, slot: p.slot, mode_cari: formatModeCari(p.rantai), mqtt_sent: mqttSent },
    });
  } catch (error) {
    console.error("[POST /api/prism-config/mode-cari]", error);
    return NextResponse.json({ success: false, error: "Gagal mengirim cara cari" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const p = await bacaPermintaan(request);
    if ("galat" in p) return p.galat;

    const mode = formatModeCari(p.rantai);
    // Jumlah baris terubah sengaja tidak diperiksa: MySQL melaporkan 0 juga saat
    // nilainya sudah sama, jadi 0 bukan bukti slotnya tidak ada.
    await prisma.$executeRaw`
      UPDATE t_prisma SET mode_cari = ${mode}
      WHERE id_prisma = ${`P${p.slot}`} AND site = ${p.site}
    `;
    return NextResponse.json({ success: true, data: { site: p.site, slot: p.slot, mode_cari: mode } });
  } catch (error) {
    console.error("[PUT /api/prism-config/mode-cari]", error);
    return NextResponse.json({ success: false, error: "Gagal mencatat cara cari" }, { status: 500 });
  }
}
