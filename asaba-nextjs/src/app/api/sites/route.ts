import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invalidateSiteCache } from "@/lib/sites";
import { normalizeBody, validate } from "@/lib/site-validation";

/**
 * GET /api/sites — daftar site.
 *
 * Query params:
 * - all=1          : sertakan site nonaktif
 * - with_logger=1  : lengkapi tiap site dengan `nama_logger` dan `nama_lokasi`
 *                    (nama pos RTS dari t_lokasi lewat t_logger.lokasi_logger),
 *                    plus `jumlah_sesi` dari log_kontrol.
 *
 *                    `id_logger` SELALU ikut karena kini kolom asli di t_site.
 *                    Sebelumnya nilai itu ditebak dari log_kontrol — "logger
 *                    yang terakhir melapor" — sehingga site tanpa riwayat tidak
 *                    punya logger sama sekali, dan site yang pernah dilayani dua
 *                    unit berganti-ganti jawabannya. Sekarang relasinya
 *                    dinyatakan, bukan disimpulkan.
 *
 *                    Karena satu logger boleh melayani beberapa site, dua site
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

    // log_kontrol sekarang dipakai HANYA untuk menghitung sesi. Penentuan
    // loggernya sudah pindah ke kolom t_site.id_logger.
    const sesiPerSite = await prisma.$queryRaw<Array<{ site: string | null; sesi: bigint }>>`
      SELECT site, COUNT(*) AS sesi FROM log_kontrol GROUP BY site
    `;
    const jumlahSesi = new Map<string, number>();
    for (const row of sesiPerSite) {
      if (row.site) jumlahSesi.set(row.site, Number(row.sesi));
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
      const idLogger = s.id_logger ?? null;
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

/**
 * Pastikan id_logger menunjuk logger yang benar-benar terdaftar.
 *
 * Tidak ada foreign key di skema ini, jadi tanpa pemeriksaan ini sebuah site
 * bisa menunjuk logger yang tidak ada — dan seluruh perintahnya akan dikirim ke
 * topik MQTT yang tidak didengar siapa pun, tanpa satu pun pesan galat.
 */
async function cekLogger(idLogger: string | null): Promise<string | null> {
  if (!idLogger) return null;
  const ada = await prisma.logger.findFirst({ where: { id_logger: idLogger } });
  return ada ? null : `Logger "${idLogger}" tidak terdaftar di master data`;
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

    const galatLogger = await cekLogger(data.id_logger);
    if (galatLogger)
      return NextResponse.json({ success: false, error: galatLogger }, { status: 400 });

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
