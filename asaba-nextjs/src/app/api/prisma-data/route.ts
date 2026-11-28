import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nomorSlot } from "@/lib/step-record";

/**
 * GET /api/prisma-data?site=xxx
 * Status live tiap prisma dari temp_prisma.
 *
 * Query params:
 * - site: WAJIB diisi untuk memperoleh data satu site saja. Tanpa parameter
 *   ini, endpoint mengembalikan seluruh prisma dari semua site — perilaku lama
 *   yang membuat prisma site lain muncul di panel Kontrol ADR.
 *
 * Kolom:
 * - id_prisma  : nomor slot RTS (P1, P2, …) — dipakai ulang tiap site,
 *                jadi hanya unik bersama `site`
 * - waktu      : waktu pengukuran
 * - N1, E1, Z1 : koordinat hasil (Y, X, Z)
 * - N0, E0, Z0 : koordinat referensi
 * - status_get : 1 = success, 0 = failed, 2 = running
 * - HA, VA, SlopDis
 * - nama_prisma: nama dari t_prisma (Prism Config); null bila slot tidak terdaftar
 *
 * Diurutkan menurut nomor slot (P1 … P10).
 */
type BarisTemp = Record<string, unknown> & { site: string; id_prisma: string };

export async function GET(request: NextRequest) {
  try {
    const site = request.nextUrl.searchParams.get("site");

    // Baris terbaru per prisma, di-scope per site.
    const rows = site
      ? await prisma.$queryRaw<BarisTemp[]>`
          SELECT tp.*
          FROM temp_prisma tp
          INNER JOIN (
            SELECT site, id_prisma, MAX(id) AS max_id
            FROM temp_prisma
            WHERE site = ${site}
            GROUP BY site, id_prisma
          ) latest
            ON tp.site = latest.site
           AND tp.id_prisma = latest.id_prisma
           AND tp.id = latest.max_id
          ORDER BY tp.id_prisma ASC
        `
      : await prisma.$queryRaw<BarisTemp[]>`
          SELECT tp.*
          FROM temp_prisma tp
          INNER JOIN (
            SELECT site, id_prisma, MAX(id) AS max_id
            FROM temp_prisma
            GROUP BY site, id_prisma
          ) latest
            ON tp.site = latest.site
           AND tp.id_prisma = latest.id_prisma
           AND tp.id = latest.max_id
          ORDER BY tp.site ASC, tp.id_prisma ASC
        `;

    // Nama prisma (DF1, BS2, …) dari Prism Config. Digabung di sini, bukan
    // lewat JOIN: kolom site/id_prisma di t_prisma (utf8mb4) dan temp_prisma
    // (utf8mb3) beda collation.
    const target = await prisma.prismaTarget.findMany({
      where: site ? { site } : undefined,
      select: { site: true, id_prisma: true, nama_prisma: true },
    });
    const nama = new Map(target.map((t) => [`${t.site}\u0000${t.id_prisma}`, t.nama_prisma]));

    // Urut menurut nomor slot (P1, P2, …, P10), bukan urutan teks yang
    // menaruh P10 sesudah P1.
    const data = rows
      .map((r) => ({ ...r, nama_prisma: nama.get(`${r.site}\u0000${r.id_prisma}`) ?? null }))
      .sort(
        (a, b) =>
          String(a.site).localeCompare(String(b.site)) ||
          (nomorSlot(String(a.id_prisma)) ?? Infinity) - (nomorSlot(String(b.id_prisma)) ?? Infinity) ||
          String(a.id_prisma).localeCompare(String(b.id_prisma))
      );

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[GET /api/prisma-data]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch prisma data" },
      { status: 500 }
    );
  }
}
