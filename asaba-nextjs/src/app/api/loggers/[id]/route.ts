import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/loggers/[id]?site=xxx
 * Get logger detail including prisms, latest sensor data, and dashboard info.
 * Replaces CI3 Beranda::index() per-logger detail queries.
 *
 * `site` opsional — membatasi daftar prisma ke satu site. Berguna karena satu
 * logger bisa melayani lebih dari satu site.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idLogger = id;
    const site = new URL(request.url).searchParams.get("site");

    // Get logger with location
    const loggers = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT l.*, lok.nama_lokasi, lok.latitude, lok.longitude,
             kl.nama_kategori, kl.temp_data, kl.tabel as kat_tabel
      FROM t_logger l
      LEFT JOIN t_lokasi lok ON l.lokasi_logger = lok.idlokasi
      LEFT JOIN kategori_logger kl ON l.kategori_log = kl.id_katlogger
      WHERE l.id_logger = ${idLogger}
      LIMIT 1
    `;

    if (!loggers || loggers.length === 0) {
      return NextResponse.json(
        { success: false, error: "Logger not found" },
        { status: 404 }
      );
    }

    const logger = loggers[0];

    // Get prisms for this logger.
    // temp_prisma uses N1/E1/Z1/N0/E0/Z0 columns (not sensor*).
    // JOIN menyertakan `site` — id_prisma dipakai ulang antar site, jadi tanpa
    // itu prisma bisa dipasangkan dengan status live milik site lain.
    // Filter `site` opsional; tanpa itu hasilnya semua prisma milik logger.
    const prisms = site
      ? await prisma.$queryRaw`
          SELECT p.*,
                 tp.N1, tp.E1, tp.Z1,
                 tp.N0, tp.E0, tp.Z0,
                 tp.status_get,
                 tp.waktu as tp_waktu
          FROM t_prisma p
          LEFT JOIN temp_prisma tp
            ON tp.id_prisma = p.id_prisma AND tp.site = p.site
          WHERE p.id_logger = ${parseInt(idLogger)} AND p.site = ${site}
        `
      : await prisma.$queryRaw`
          SELECT p.*,
                 tp.N1, tp.E1, tp.Z1,
                 tp.N0, tp.E0, tp.Z0,
                 tp.status_get,
                 tp.waktu as tp_waktu
          FROM t_prisma p
          LEFT JOIN temp_prisma tp
            ON tp.id_prisma = p.id_prisma AND tp.site = p.site
          WHERE p.id_logger = ${parseInt(idLogger)}
        `;

    // Get latest temp_rts data — ORDER BY waktu DESC untuk pastikan dapat data terbaru
    const tempData = await prisma.$queryRaw`
      SELECT
        id, code_logger, id_kontrol, waktu,
        sensor1,  sensor2,  sensor3,  sensor4,  sensor5,
        sensor6,  sensor7,  sensor8,  sensor9,  sensor10,
        sensor11, sensor12, sensor13, sensor14, sensor15,
        sensor16, sensor17, sensor18, sensor19, sensor20,
        sensor21, sensor22, sensor23, sensor24, sensor25
      FROM temp_rts
      WHERE code_logger = ${idLogger}
      ORDER BY waktu DESC, id DESC
      LIMIT 1
    `;

    // Get sensor parameters — raw query to avoid schema mismatch
    let parameters: any[] = [];
    try {
      parameters = await prisma.$queryRaw`
        SELECT * FROM parameter_sensor WHERE logger_id = ${idLogger}
      `;
    } catch (_) { /* tabel mungkin kosong atau kolom berbeda */ }

    // Get ADR config — raw query to avoid schema mismatch
    let config: any = null;
    try {
      const configRows = await prisma.$queryRaw<any[]>`
        SELECT * FROM config_adr WHERE id_logger = ${parseInt(idLogger)} LIMIT 1
      `;
      config = configRows?.[0] ?? null;
    } catch (_) { /* opsional */ }

    // ── Serialisasi BigInt ──────────────────────────────────────────────────
    // Prisma $queryRaw mengembalikan kolom INT/TINYINT sebagai BigInt di Node.js.
    // JSON.stringify tidak bisa serialize BigInt → nilai jadi null/hilang di client.
    // Fungsi ini konversi semua BigInt ke Number sebelum dikirim.
    // PENTING: Date object harus di-skip (dikembalikan apa adanya) karena
    // JSON.stringify sudah bisa handle Date → ISO string secara otomatis.
    function serializeBigInt(obj: any): any {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === "bigint") return Number(obj);
      if (obj instanceof Date) return obj;           // ← jangan diubah, biarkan JSON.stringify yang handle
      if (Array.isArray(obj)) return obj.map(serializeBigInt);
      if (typeof obj === "object") {
        const out: any = {};
        for (const key of Object.keys(obj)) out[key] = serializeBigInt(obj[key]);
        return out;
      }
      return obj;
    }

    return NextResponse.json({
      success: true,
      data: serializeBigInt({
        logger,
        prisms,
        tempData,
        parameters,
        config,
      }),
    });
  } catch (error) {
    console.error("[GET /api/loggers/:id] error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch logger detail",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// PUT /api/loggers/[id] - update logger
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { id_logger, nama_logger, lokasi_logger, kategori_log, tabel } = body;
    if (!id_logger || !nama_logger || !lokasi_logger || !kategori_log || !tabel) {
      return NextResponse.json({ success: false, error: "Semua field wajib diisi" }, { status: 400 });
    }
    const updated = await prisma.logger.update({
      where: { id: parseInt(id) },
      data: { id_logger, nama_logger, lokasi_logger: String(lokasi_logger), kategori_log: String(kategori_log), tabel },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PUT /api/loggers/:id]", error);
    return NextResponse.json({ success: false, error: "Gagal mengupdate logger" }, { status: 500 });
  }
}

// DELETE /api/loggers/[id] - hapus logger
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const logger = await prisma.logger.findUnique({ where: { id: parseInt(id) } });
    if (!logger) {
      return NextResponse.json({ success: false, error: "Logger tidak ditemukan" }, { status: 404 });
    }

    // Tidak ada foreign key di skema ini: menghapus logger hanya membuang satu
    // baris t_logger dan meninggalkan prisma, config, serta seluruh riwayat
    // pengukurannya menunjuk id yang sudah tidak ada. Barisnya tidak hilang,
    // tapi tidak bisa lagi ditelusuri dari mana pun — jadi tolak selagi masih
    // ada yang menggantung.
    //
    // Tabel lain merujuk logger lewat KODE-nya (`id_logger`, mis. "30002"),
    // bukan lewat primary key `t_logger.id`. t_prisma/config_adr menyimpannya
    // sebagai INT, tabel data sebagai VARCHAR.
    const kode = logger.id_logger;
    const kodeInt = Number.parseInt(kode, 10);
    const [jumlah] = await prisma.$queryRaw<Array<Record<string, bigint>>>`
      SELECT
        (SELECT COUNT(*) FROM t_prisma WHERE id_logger = ${Number.isNaN(kodeInt) ? -1 : kodeInt}) AS prisma,
        (SELECT COUNT(*) FROM config_adr WHERE id_logger = ${Number.isNaN(kodeInt) ? -1 : kodeInt}) AS config,
        (SELECT COUNT(*) FROM rts WHERE code_logger = ${kode}) AS data_ukur
    `;
    const prismaCount = Number(jumlah.prisma);
    const configCount = Number(jumlah.config);
    const dataCount = Number(jumlah.data_ukur);

    if (prismaCount > 0 || configCount > 0 || dataCount > 0) {
      const bagian = [
        prismaCount > 0 ? `${prismaCount} prisma` : null,
        configCount > 0 ? `${configCount} konfigurasi ADR` : null,
        dataCount > 0 ? `${dataCount} baris data pengukuran` : null,
      ].filter(Boolean);
      return NextResponse.json(
        {
          success: false,
          error:
            `Logger "${logger.nama_logger}" masih dipakai oleh ${bagian.join(", ")}. ` +
            `Hapus dulu yang menggantung itu, atau biarkan logger ini apa adanya — ` +
            `menghapusnya membuat data tersebut tidak bisa ditelusuri lagi.`,
        },
        { status: 409 }
      );
    }

    await prisma.logger.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true, message: "Logger berhasil dihapus" });
  } catch (error) {
    console.error("[DELETE /api/loggers/:id]", error);
    return NextResponse.json({ success: false, error: "Gagal menghapus logger" }, { status: 500 });
  }
}
