import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { statusKejadian, type StatusKejadian } from "@/lib/aturan-kejadian";
import { ringkasKejadian } from "@/lib/kejadian-alarm";

export const dynamic = "force-dynamic";

const STATUS: ReadonlyArray<StatusKejadian | "semua" | "benar" | "palsu"> = [
  "semua",
  "perlu-konfirmasi",
  "disenyapkan",
  "perlu-verifikasi",
  "selesai",
  "benar",
  "palsu",
];

/**
 * GET /api/kejadian-alarm?site=<slug>&status=<status>
 * Riwayat kejadian alarm, terbaru dulu, paling banyak 300.
 *
 * `status`: semua (bawaan), perlu-konfirmasi, disenyapkan, perlu-verifikasi,
 * selesai, benar, palsu. Disaring sesudah dibaca — aturan statusnya ada di
 * aturan-kejadian.ts, dan menyalinnya ke SQL berarti dua aturan yang bisa
 * lepas sinkron.
 */
export async function GET(req: NextRequest) {
  try {
    const site = req.nextUrl.searchParams.get("site")?.trim() || undefined;
    const minta = req.nextUrl.searchParams.get("status") ?? "semua";
    const status = (STATUS as readonly string[]).includes(minta) ? minta : "semua";

    const baris = await prisma.kejadianAlarm.findMany({
      where: site ? { site } : {},
      orderBy: [{ mulai: "desc" }, { id: "desc" }],
      take: 300,
    });
    const data = (await ringkasKejadian(baris)).filter((k) => {
      if (status === "semua") return true;
      if (status === "benar" || status === "palsu") return k.hasil === status;
      return statusKejadian(k) === status;
    });

    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/kejadian-alarm]", error);
    return NextResponse.json({ success: false, error: "Gagal membaca riwayat alarm" }, { status: 500 });
  }
}
