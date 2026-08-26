import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSites } from "@/lib/sites";

/**
 * GET /api/test-sites — daftar site.
 *
 * Dulu daftar ini diturunkan dari `SELECT DISTINCT site FROM log_kontrol`,
 * sehingga site baru tidak pernah muncul sampai ada data pengukuran masuk —
 * masalah ayam-dan-telur. Sekarang sumbernya master data `t_site`, dan site
 * yang cuma ada di log_kontrol dilaporkan terpisah sebagai `belum_terdaftar`.
 */
export async function GET() {
  try {
    const sites = await getSites();

    const dipakai = await prisma.$queryRaw<Array<{ site: string | null }>>`
      SELECT DISTINCT site FROM log_kontrol
    `;
    const terdaftar = new Set(sites.map((s) => s.slug));
    const belumTerdaftar = dipakai
      .map((r) => r.site)
      .filter((s): s is string => !!s && !terdaftar.has(s));

    return NextResponse.json({
      sites: sites.map((s) => ({
        site: s.slug,
        nama: s.nama,
        badge_label: s.badgeLabel,
        badge_color: s.badgeColor,
        terkalibrasi: s.terkalibrasi,
        data_dummy: s.dataDummy,
      })),
      belum_terdaftar: belumTerdaftar,
    });
  } catch (error) {
    console.error("[GET /api/test-sites]", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil daftar site" },
      { status: 500 }
    );
  }
}
