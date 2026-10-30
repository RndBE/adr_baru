import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishMqtt, topikPerintah } from "@/lib/mqtt";
import { getLoggerForSite } from "@/lib/sites";
import {
  buatPayloadSapuanGlobal,
  validasiSapuanGlobal,
  type KunciSapuanGlobal,
  type PermintaanSapuanGlobal,
} from "@/lib/protokol-rts";

/**
 * POST /api/kontrol/sapuan-global
 *
 * Menyetel parameter sapuan custom GLOBAL di instrumen — dipakai semua target
 * bermode `ac` di AutoTracking (ADR_RTS_PORTING §3.1):
 *
 *   {"set_10284":{"command":"set_rts","langkahHA":"0,00,01","langkahVA":"0,00,01",
 *                 "rentangHA":"0,00,20","rentangVA":"0,00,20","rehat":5000}}
 *   → snapshot ack {"updated":[..],"set_rts":"OK",...}
 *   → atau {"error_<kunci>":"<pesan>"}
 *
 * Ini BUKAN uji sapuan (/api/kontrol/auto-search-custom): itu sekali jalan dan
 * tidak mengubah apa pun yang tersimpan, sedangkan ini mengubah setelan yang
 * dipakai siklus produksi berikutnya.
 *
 * Tiap kunci berdiri sendiri, jadi boleh dikirim sebagian; yang tidak diisi
 * tidak dikirim dan tidak berubah di instrumen.
 *
 * Dikirim SENDIRIAN, tidak digabung ke /api/config-adr, mengikuti search-area
 * dan track-every: ack-nya milik langkah ini sendiri, dan menggabungkannya
 * membuat balasan yang saling menyusul tidak bisa lagi dipetakan ke perintahnya.
 *
 * Nilainya DICATAT ke config_adr sesudah perintahnya terkirim — "terakhir
 * dikirim", bukan bukti keadaan instrumen (migrasi 019). Hanya kolom yang
 * dikirim yang ditulis. Pencatatan opsional: kalau gagal (kolom belum ada),
 * perintah tetap berhasil dan respons membawa `tercatat: false`.
 *
 * `site` WAJIB, tanpa fallback ke logger pertama: perintah ini mengubah
 * perilaku alat milik site tertentu.
 *
 * Body: { site, langkahHA?, langkahVA?, rentangHA?, rentangVA?, rehat? }
 */

/** Kunci protokol → kolom config_adr. Daftar tetap, bukan dari input. */
const KOLOM: Record<KunciSapuanGlobal, string> = {
  langkahHA: "sapu_langkah_ha",
  langkahVA: "sapu_langkah_va",
  rentangHA: "sapu_rentang_ha",
  rentangVA: "sapu_rentang_va",
  rehat: "sapu_rehat",
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as PermintaanSapuanGlobal & { site?: string };
    const { site } = body;

    if (!site) {
      return NextResponse.json({ success: false, error: "site wajib diisi" }, { status: 400 });
    }

    const cek = validasiSapuanGlobal(body);
    if (!cek.ok) {
      return NextResponse.json({ success: false, error: cek.galat }, { status: 400 });
    }
    if (cek.rencana.kosong) {
      return NextResponse.json(
        { success: false, error: "Isi minimal satu setelan sapuan" },
        { status: 400 }
      );
    }

    const id_logger = await getLoggerForSite(site);
    if (!id_logger) {
      return NextResponse.json(
        { success: false, error: `Logger untuk site "${site}" tidak ditemukan` },
        { status: 404 }
      );
    }

    const mqttSent = await publishMqtt(
      topikPerintah(id_logger),
      buatPayloadSapuanGlobal(id_logger, cek.rencana.dikirim)
    );

    // Dicatat hanya kalau perintahnya benar-benar terkirim: catatan yang terisi
    // padahal publish gagal menyesatkan operator berikutnya.
    // Catatan hanya kenyamanan (mengisi ulang form), bukan bagian perintah: alat
    // sudah menerimanya, jadi gagal menulis (mis. migrasi 019 belum dijalankan)
    // tidak boleh membuat respons terbaca seolah perintahnya gagal.
    let tercatat = false;
    if (mqttSent) {
      try {
        const kunci = Object.keys(cek.rencana.dikirim) as KunciSapuanGlobal[];
        // Nama kolom dari tabel KOLOM di atas, tidak pernah dari input.
        const set = kunci.map((k) => `${KOLOM[k]} = ?`).join(", ");
        const nilai = kunci.map((k) => cek.rencana.dikirim[k]);
        await prisma.$executeRawUnsafe(`UPDATE config_adr SET ${set} WHERE site = ?`, ...nilai, site);
        tercatat = true;
      } catch (error) {
        console.error("[POST /api/kontrol/sapuan-global] gagal mencatat nilai terakhir dikirim", error);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        site,
        id_logger,
        dikirim: cek.rencana.dikirim,
        titik: cek.rencana.titik,
        minimalDetik: cek.rencana.minimalDetik,
        mqtt_sent: mqttSent,
        tercatat,
      },
    });
  } catch (error) {
    console.error("[POST /api/kontrol/sapuan-global]", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengirim setelan sapuan" },
      { status: 500 }
    );
  }
}
