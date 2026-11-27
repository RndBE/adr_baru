import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishMqtt, topikPerintah } from "@/lib/mqtt";
import { getLoggerForSite } from "@/lib/sites";
import { nomorSlot, validasiBsSlot } from "@/lib/protokol-rts";

/**
 * POST /api/kontrol/bs-slot
 *
 * Backsight diukur di awal DAN di akhir tiap putaran AutoTracking
 * (firmware BL1100-v2.9.1):
 *
 *   {"set_30002":{"command":"set_rts","bsSlot":[9,10]}}   aktif
 *   {"set_30002":{"command":"set_rts","bsSlot":[]}}       mati
 *
 * Slotnya tidak diketik operator: diambil dari Prism Config, yaitu prisma
 * site ini yang berjenis "bs" (t_prisma.jenis). Dengan begitu yang diulang
 * alat selalu sama dengan yang ditandai backsight di aplikasi.
 *
 * Seperti get-config, rute ini hanya menerbitkan perintah. Penolakan datang di
 * pub_<id> sebagai {"error_bsSlot":"…"}; keadaan yang berlaku dibaca ulang lewat
 * get_config ("bsSlot":[…]). Firmware sebelum 2.9.1 mengabaikannya.
 *
 * Body: { site: string, aktif: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { site, aktif } = body as { site?: string; aktif?: boolean };

    if (!site) {
      return NextResponse.json({ success: false, error: "site wajib diisi" }, { status: 400 });
    }
    if (typeof aktif !== "boolean") {
      return NextResponse.json({ success: false, error: "aktif wajib true atau false" }, { status: 400 });
    }

    const id_logger = await getLoggerForSite(site);
    if (!id_logger) {
      return NextResponse.json(
        { success: false, error: `Logger untuk site "${site}" tidak ditemukan` },
        { status: 404 }
      );
    }

    let slot: number[] = [];
    if (aktif) {
      const bs = await prisma.$queryRaw<Array<{ id_prisma: string }>>`
        SELECT id_prisma FROM t_prisma WHERE site = ${site} AND jenis = 'bs' ORDER BY id
      `;
      slot = bs.map((b) => nomorSlot(b.id_prisma)).filter((n): n is number => n !== null);
      if (slot.length === 0) {
        return NextResponse.json(
          { success: false, error: "Belum ada prisma berjenis Backsight di Prism Config site ini" },
          { status: 400 }
        );
      }
    }
    const salah = validasiBsSlot(slot);
    if (salah) {
      return NextResponse.json({ success: false, error: salah }, { status: 400 });
    }

    const mqtt_sent = await publishMqtt(topikPerintah(id_logger), {
      [`set_${id_logger}`]: { command: "set_rts", bsSlot: slot },
    });

    return NextResponse.json({ success: true, data: { id_logger, slot, mqtt_sent } });
  } catch (error) {
    console.error("[POST /api/kontrol/bs-slot]", error);
    return NextResponse.json({ success: false, error: "Gagal mengirim bsSlot" }, { status: 500 });
  }
}
