import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TINGKAT_ALARM, type PrismaAlarm, type TingkatAlarm } from "@/lib/alarm-ambang";

export const dynamic = "force-dynamic";

/**
 * GET /api/alarm-ambang
 * Prisma yang sedang di atas Normal, di seluruh site aktif — sumber alarm suara
 * di dasbor (components/alarm-ambang.tsx), ditanya tiap 30 detik.
 *
 * Dibaca dari `status_prisma.tingkat`, tingkat yang diakui jalur peringatan
 * pada akhir tiap siklus — keputusan yang sama dengan pesan WhatsApp, jadi
 * bunyi di layar dan pesan di grup tidak pernah bercerita beda.
 *
 * Hanya slot yang masih terdaftar di t_prisma. Baris status_prisma tidak ikut
 * terhapus saat slot dihapus di Prism Config; tanpa penyaring ini prisma yang
 * sudah dicabut bisa membunyikan alarm selamanya dengan angka terakhirnya.
 */
export async function GET() {
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        site: string;
        nama: string;
        id_prisma: string;
        tingkat: string;
        nilai_mm: number | null;
        waktu: string | null;
      }>
    >`
      SELECT s.site, ts.nama, s.id_prisma, s.tingkat, s.nilai_mm,
        (SELECT DATE_FORMAT(MAX(l.datetime), '%Y-%m-%d %H:%i:%s')
           FROM log_kontrol l
          WHERE l.id_log = s.siklus_terakhir AND l.site = s.site) AS waktu
      FROM status_prisma s
      JOIN t_site ts ON ts.slug = s.site AND ts.aktif = 1
      WHERE s.tingkat IN ('Waspada', 'Siaga', 'Awas')
        AND EXISTS (
          SELECT 1 FROM t_prisma p WHERE p.site = s.site AND p.id_prisma = s.id_prisma
        )
      ORDER BY ts.urutan, s.site, s.id_prisma
    `;

    const data: PrismaAlarm[] = rows
      .filter((r) => (TINGKAT_ALARM as readonly string[]).includes(r.tingkat))
      .map((r) => ({
        site: r.site,
        namaSite: r.nama,
        idPrisma: r.id_prisma,
        tingkat: r.tingkat as TingkatAlarm,
        nilaiMm: r.nilai_mm == null ? null : Number(r.nilai_mm),
        waktu: r.waktu,
      }));

    return NextResponse.json(
      { success: true, data },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[GET /api/alarm-ambang]", error);
    return NextResponse.json(
      { success: false, error: "Gagal membaca status alarm" },
      { status: 500 }
    );
  }
}
