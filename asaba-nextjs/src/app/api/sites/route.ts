import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invalidateSiteCache } from "@/lib/sites";
import { normalizeBody, validate } from "@/lib/site-validation";

/**
 * GET /api/sites — daftar site.
 *
 * Query params:
 * - all=1          : sertakan site nonaktif
 * - with_logger=1  : sertakan `id_logger` yang DITURUNKAN dari data, yaitu
 *                    logger yang paling terakhir melapor untuk site itu.
 *                    Relasi site↔logger tidak dimodelkan di skema (satu unit
 *                    RTS bisa dipakai di lebih dari satu site), jadi ini murni
 *                    hasil pembacaan log_kontrol, bukan konfigurasi.
 *
 *                    Ikut menyertakan `nama_logger` dan `nama_lokasi` — nama pos
 *                    RTS dari t_lokasi, lewat t_logger.lokasi_logger. Judul
 *                    halaman dulu menulis "Pos RTS Site MIP" secara hardcode,
 *                    padahal nama posnya sudah ada di master data.
 *
 *                    Karena satu logger bisa melayani beberapa site, dua site
 *                    yang memakai unit RTS yang sama akan menunjukkan
 *                    `nama_lokasi` yang sama — itu memang satu pos fisik.
 */
export async function GET(req: NextRequest) {
  try {
    const includeInactive = req.nextUrl.searchParams.get("all") === "1";
    const withLogger = req.nextUrl.searchParams.get("with_logger") === "1";

    const sites = await prisma.site.findMany({
      where: includeInactive ? undefined : { aktif: true },
      orderBy: [{ urutan: "asc" }, { nama: "asc" }],
    });

    if (!withLogger) {
      return NextResponse.json({ success: true, data: sites });
    }

    const terakhir = await prisma.$queryRaw<
      Array<{ site: string | null; id_logger: string; sesi: bigint }>
    >`
      SELECT lk.site, lk.id_logger, COUNT(*) AS sesi
      FROM log_kontrol lk
      INNER JOIN (
        SELECT site, MAX(datetime) AS terbaru
        FROM log_kontrol
        GROUP BY site
      ) t ON t.site = lk.site
      GROUP BY lk.site, lk.id_logger
      ORDER BY MAX(lk.datetime) DESC
    `;

    // Site yang punya lebih dari satu logger: ambil yang paling terakhir melapor.
    const loggerPerSite = new Map<string, string>();
    const jumlahSesi = new Map<string, number>();
    for (const row of terakhir) {
      if (!row.site) continue;
      if (!loggerPerSite.has(row.site)) loggerPerSite.set(row.site, row.id_logger);
      jumlahSesi.set(row.site, (jumlahSesi.get(row.site) ?? 0) + Number(row.sesi));
    }

    // Nama pos RTS: t_logger.lokasi_logger → t_lokasi.idlokasi. LEFT JOIN karena
    // logger tanpa lokasi terdaftar harus tetap muncul, dengan nama_lokasi null.
    // Tanpa filter IN — t_logger hanya berisi segelintir baris.
    const loggers = await prisma.$queryRaw<
      Array<{ id_logger: string; nama_logger: string; nama_lokasi: string | null }>
    >`
      SELECT l.id_logger, l.nama_logger, lok.nama_lokasi
      FROM t_logger l
      LEFT JOIN t_lokasi lok ON l.lokasi_logger = lok.idlokasi
    `;
    const infoLogger = new Map(loggers.map((l) => [String(l.id_logger), l]));

    const data = sites.map((s) => {
      const idLogger = loggerPerSite.get(s.slug) ?? null;
      const info = idLogger ? infoLogger.get(idLogger) : undefined;
      return {
        ...s,
        id_logger: idLogger,
        nama_logger: info?.nama_logger ?? null,
        nama_lokasi: info?.nama_lokasi ?? null,
        jumlah_sesi: jumlahSesi.get(s.slug) ?? 0,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[GET /api/sites]", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data site" },
      { status: 500 }
    );
  }
}

// POST /api/sites — tambah site baru
export async function POST(req: NextRequest) {
  try {
    const data = normalizeBody(await req.json());
    const err = validate(data);
    if (err) return NextResponse.json({ success: false, error: err }, { status: 400 });

    const bentrok = await prisma.site.findUnique({ where: { slug: data.slug } });
    if (bentrok)
      return NextResponse.json(
        { success: false, error: `Slug "${data.slug}" sudah dipakai` },
        { status: 409 }
      );

    const created = await prisma.site.create({ data });
    invalidateSiteCache();
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/sites]", error);
    return NextResponse.json(
      { success: false, error: "Gagal menambah site" },
      { status: 500 }
    );
  }
}
