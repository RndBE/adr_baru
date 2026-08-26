import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRtsStartCommand } from "@/lib/mqtt";
import { verifikasiKodeAkses } from "@/lib/kode-akses";


/**
 * POST /api/kontrol/start
 * Start RTS measurement via MQTT.
 * Replaces CI3 Kontrol::lanjut_kontrol().
 *
 * Body: { kode_akses: string, site: string, id_logger?: string }
 *
 * `site` wajib dan harus terdaftar di t_site. Sebelumnya kolom `site` tidak
 * ikut di-insert sama sekali sehingga setiap sesi jatuh ke default DB 'ccp' —
 * artinya pengukuran di site mana pun tercatat sebagai CCP dan kemudian dinilai
 * dengan ambang bahaya serta rotasi milik CCP. Logger yang sama (30002) memang
 * dipakai di lebih dari satu site, jadi site tidak bisa disimpulkan dari logger
 * dan harus dipilih operator.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kode_akses, site } = body;

    const siteSlug = String(site ?? "").trim();
    if (!siteSlug) {
      return NextResponse.json(
        { success: false, error: "Site wajib dipilih sebelum memulai kontrol" },
        { status: 400 }
      );
    }

    const siteRow = await prisma.site.findUnique({ where: { slug: siteSlug } });
    if (!siteRow) {
      return NextResponse.json(
        { success: false, error: `Site "${siteSlug}" tidak terdaftar di Master Data` },
        { status: 400 }
      );
    }
    if (!siteRow.aktif) {
      return NextResponse.json(
        { success: false, error: `Site "${siteRow.nama}" sedang nonaktif` },
        { status: 400 }
      );
    }

    // Ambil logger ID ADR secara dinamis dari DB
    // Cari logger dengan kategori yang mengandung "ADR" atau "RTS"
    const loggers = await prisma.$queryRaw<Array<{ id: number; id_logger: string }>>`
      SELECT l.id, l.id_logger 
      FROM t_logger l
      JOIN kategori_logger kl ON l.kategori_log = kl.id_katlogger
      WHERE kl.nama_kategori LIKE '%ADR%' OR kl.nama_kategori LIKE '%RTS%'
      ORDER BY l.id ASC
      LIMIT 1
    `;
    const id_logger = loggers?.[0]?.id_logger;
    const id_logger_int = loggers?.[0]?.id;
    if (!id_logger) {
      return NextResponse.json(
        { success: false, error: "ADR logger not found in database" },
        { status: 404 }
      );
    }

    // Verifikasi kode akses — WAJIB, tanpa syarat.
    //
    // Dulu blok ini dibungkus `if (kode_akses)`, sehingga permintaan tanpa kode
    // melewatinya begitu saja dan langsung menjalankan perintah start ke RTS.
    // Tombol di UI memang dinonaktifkan tanpa kode, tapi endpoint-nya sendiri
    // tidak terlindungi.
    //
    // verifikasiKodeAkses() juga memeriksa masa berlaku (tanggal_mulai /
    // tanggal_selesai), yang sebelumnya tidak pernah dibaca sama sekali.
    const hasilAkses = await verifikasiKodeAkses(String(kode_akses ?? ""));
    if (!hasilAkses.valid) {
      return NextResponse.json(
        { success: false, error: hasilAkses.alasan },
        { status: hasilAkses.alasan === "Kode akses wajib diisi" ? 400 : 403 }
      );
    }

    // Update set_tempkontrol — sama dengan PHP: WHERE id_logger = '30002'
    const dateNow = new Date();
    await prisma.$executeRaw`
      UPDATE set_tempkontrol 
      SET status = '1', status_manual = '1', datetime = ${dateNow}
      WHERE id_logger = ${id_logger}
    `;

    // Reset prisma status_get ke 0 — sama dengan PHP asli.
    // Di-scope per site, bukan per logger: satu logger bisa melayani beberapa
    // site, dan mereset semuanya akan menghapus status prisma site lain.
    const dataPrisma = await prisma.$queryRaw<Array<{ id_prisma: string }>>`
      SELECT id_prisma FROM t_prisma WHERE site = ${siteSlug}
    `;
    for (const p of dataPrisma) {
      await prisma.$executeRaw`
        UPDATE temp_prisma SET status_get = 0
        WHERE id_prisma = ${p.id_prisma} AND site = ${siteSlug}
      `;
    }

    // Create log_kontrol entry. `site` di-insert eksplisit — mengandalkan default
    // kolom akan menandai semua sesi sebagai 'ccp'.
    const idLog = dateNow.toTimeString().slice(0, 8).replace(/:/g, "");
    await prisma.$executeRaw`
      INSERT INTO log_kontrol (id_log, id_logger, datetime, site)
      VALUES (${idLog}, ${id_logger}, ${dateNow}, ${siteSlug})
    `;

    // ── Kirim MQTT: hanya AutoTrackingStart ──
    // Config (jobName, prismConst, dll) dikirim dari RTS Config saat save
    // recordTarget dikirim dari Prism Config saat Auto Search
    const mqttSuccess = await sendRtsStartCommand(id_logger);

    return NextResponse.json({
      success: true,
      data: {
        id_log: idLog,
        site: siteSlug,
        mqtt_sent: mqttSuccess,
        datetime: dateNow.toISOString(),
      },
    });
  } catch (error) {
    console.error("[POST /api/kontrol/start]", error);
    return NextResponse.json(
      { success: false, error: "Failed to start kontrol" },
      { status: 500 }
    );
  }
}


/**
 * GET /api/kontrol/start?id_logger=XXXX
 * Get kontrol status.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Ambil id_logger dari query param, atau ambil dari DB jika tidak ada
    let idLogger = searchParams.get("id_logger");
    if (!idLogger) {
      const loggers = await prisma.$queryRaw<Array<{ id_logger: string }>>`
        SELECT id_logger FROM t_logger WHERE kategori_log = '1' ORDER BY id ASC LIMIT 1
      `;
      idLogger = loggers?.[0]?.id_logger ?? null;
    }
    if (!idLogger) {
      return NextResponse.json(
        { success: false, error: "ADR logger not found" },
        { status: 404 }
      );
    }

    const status = await prisma.statusKontrol.findFirst({
      where: { id_logger: idLogger },
    });

    const idLoggerNumber = Number(idLogger);
    const setTemp = Number.isNaN(idLoggerNumber)
      ? []
      : await prisma.setTempkontrol.findMany({
          where: { id_logger: idLoggerNumber },
        });

    const values = setTemp.map((s) => s.status);
    let statusKontrol = status?.status_kontrol ?? 0;
    if (statusKontrol === 2 && values.includes(1)) {
      statusKontrol = 1;
    }

    return NextResponse.json({
      success: true,
      data: { id_logger: idLogger, status_kontrol: statusKontrol },
    });
  } catch (error) {
    console.error("[GET /api/kontrol/start]", error);
    return NextResponse.json(
      { success: false, error: "Failed to get status" },
      { status: 500 }
    );
  }
}
