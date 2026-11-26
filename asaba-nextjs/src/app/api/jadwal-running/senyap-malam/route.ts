import { NextRequest, NextResponse, after } from "next/server";
import { kunciApiCocok } from "@/lib/kunci-api";
import { jalankanSenyapMalam } from "@/lib/kejadian-alarm";
import { kirimKabar } from "@/lib/kirim-peringatan";

export const dynamic = "force-dynamic";

/**
 * POST /api/jadwal-running/senyap-malam
 *
 * Bunyi alarm dimatikan otomatis pada jam malam (src/lib/aturan-senyap-malam.ts).
 * Dipanggil cron server tiap menit, sesudah /api/jadwal-running/jalankan, dengan
 * kunci yang sama: header `X-API-Key` = env `JADWAL_RUNNING_KEY`. Berada di
 * bawah /api/jadwal-running supaya ikut jalur terbuka di proxy.ts — cron tidak
 * punya cookie sesi; kuncinya yang menjaga.
 *
 * Kejadian yang dibungkam dikabarkan ke WhatsApp/Telegram site-nya.
 */
export async function POST(req: NextRequest) {
  const kunci = process.env.JADWAL_RUNNING_KEY?.trim();
  if (!kunci) {
    return NextResponse.json({ success: false, error: "Pelaksana jadwal belum dikonfigurasi" }, { status: 503 });
  }
  if (!kunciApiCocok(req.headers.get("x-api-key"), kunci)) {
    return NextResponse.json({ success: false, error: "Kunci API salah" }, { status: 401 });
  }
  try {
    const dibungkam = await jalankanSenyapMalam();
    if (dibungkam.length > 0) {
      after(async () => {
        for (const d of dibungkam) {
          console.log(`[peringatan][senyap-malam] #${d.id} kabar: ${await kirimKabar(d.site, d.teks)}`);
        }
      });
    }
    return NextResponse.json({
      success: true,
      dibungkam: dibungkam.map((d) => ({ id: d.id, site: d.site, ews: d.ews })),
    });
  } catch (error) {
    console.error("[POST /api/jadwal-running/senyap-malam]", error);
    return NextResponse.json({ success: false, error: "Gagal menjalankan senyap malam" }, { status: 500 });
  }
}
