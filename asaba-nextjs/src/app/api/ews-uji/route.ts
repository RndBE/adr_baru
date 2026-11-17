import { NextRequest, NextResponse } from "next/server";
import { getSite } from "@/lib/sites";
import { validasiUji } from "@/lib/aturan-uji-ews";
import { jalankanUji } from "@/lib/uji-ews";
import { gagal, namaOperator, tolakKodeAkses } from "@/lib/api-kejadian";

/**
 * POST /api/ews-uji
 * Body: { site: string, tingkat: "Waspada" | "Siaga" | "Awas" | "Normal",
 *         detik?: number, kode_akses: string }
 *
 * Menyalakan sirene dan lampu putar EWS sebuah site untuk pengujian, tanpa
 * alarm sungguhan: tidak membuat kejadian alarm dan tidak mengirim WhatsApp.
 * "Normal" mematikan sekarang; selain itu server mematikan sendiri setelah
 * `detik` (bawaan 30). Lihat src/lib/uji-ews.ts.
 *
 * Dijaga kode akses — menyalakan sirene di lapangan sama beratnya dengan
 * mematikannya. Ditolak (409) bila site itu sedang punya kejadian alarm
 * sungguhan.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const v = validasiUji(body);
    if (!v.ok) return gagal(400, v.error);

    const ditolak = await tolakKodeAkses(body.kode_akses);
    if (ditolak) return ditolak;

    const cfg = await getSite(v.site);
    if (cfg.tidakDikenal) return gagal(404, "Site tidak ditemukan");
    if (!cfg.idLoggerEws) return gagal(400, `${cfg.nama} belum punya logger EWS (isi di Master Data → Site)`);

    const oleh = await namaOperator();
    const hasil = await jalankanUji({
      site: v.site,
      idLoggerEws: cfg.idLoggerEws,
      tingkat: v.tingkat,
      detik: v.detik,
    });
    console.log(
      `[ews-uji] ${v.site}: ${oleh} → ${v.tingkat}${v.tingkat === "Normal" ? "" : ` ${v.detik} dtk`} ` +
        `ke sub_${cfg.idLoggerEws}, hasil=${hasil}`
    );

    if (hasil === "alarm-aktif") {
      return gagal(
        409,
        `${cfg.nama} sedang punya alarm sungguhan. Uji ditolak supaya tidak menimpa atau membungkamnya.`
      );
    }
    if (hasil === "gagal") {
      return gagal(502, "Perintah tidak terkirim ke broker MQTT. Coba lagi sebentar lagi.");
    }
    return NextResponse.json({ success: true, tingkat: v.tingkat, detik: v.detik });
  } catch (error) {
    console.error("[POST /api/ews-uji]", error);
    return gagal(500, "Gagal menjalankan uji EWS");
  }
}
