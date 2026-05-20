import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRtsStartCommand } from "@/lib/mqtt";


/**
 * POST /api/kontrol/start
 * Start RTS measurement via MQTT.
 * Replaces CI3 Kontrol::lanjut_kontrol().
 * 
 * Body: { kode_akses: string, id_logger?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kode_akses } = body;

    // Ambil logger ID ADR secara dinamis dari DB
    // Cari logger dengan kategori yang mengandung "ADR" atau "RTS"
    const loggers = await prisma.$queryRaw<Array<{ id: number; id_logger: string }>>`
      SELECT l.id, l.id_logger 
      FROM t_logger l
      JOIN kategori_logger kl ON l.kategori_log = kl.id_katlogger
      WHERE kl.nama_kategori LIKE '%ADR%' OR kl.nama_kategori LIKE '%RTS%'
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

    // Verify access code — cari dari semua user, tidak hardcoded id_user: 2
    if (kode_akses) {
      const { createHash } = await import("crypto");

      const hashedInput = createHash("md5").update(kode_akses).digest("hex");
      
      const accessCode = await prisma.kodeAkses.findFirst({
        where: { kode_akses: hashedInput },
      });

      if (!accessCode) {
        return NextResponse.json(
          { success: false, error: "Invalid access code" },
          { status: 403 }
        );
      }
    }

    // Update set_tempkontrol — sama dengan PHP: WHERE id_logger = '30002'
    const dateNow = new Date();
    await prisma.$executeRaw`
      UPDATE set_tempkontrol 
      SET status = '1', status_manual = '1', datetime = ${dateNow}
      WHERE id_logger = ${id_logger}
    `;

    // Reset prisma status_get ke 0 — sama dengan PHP asli
    const dataPrisma = await prisma.$queryRaw<Array<{ id_prisma: string }>>`
      SELECT id_prisma FROM t_prisma WHERE id_logger = ${id_logger}
    `;
    for (const p of dataPrisma) {
      await prisma.$executeRaw`
        UPDATE temp_prisma SET status_get = 0 WHERE id_prisma = ${p.id_prisma}
      `;
    }

    // Create log_kontrol entry — sama dengan PHP: id_log, id_logger, datetime
    const idLog = dateNow.toTimeString().slice(0, 8).replace(/:/g, "");
    await prisma.$executeRaw`
      INSERT INTO log_kontrol (id_log, id_logger, datetime)
      VALUES (${idLog}, ${id_logger}, ${dateNow})
    `;

    // ── Kirim MQTT: hanya AutoTrackingStart ──
    // Config (jobName, prismConst, dll) dikirim dari RTS Config saat save
    // recordTarget dikirim dari Prism Config saat Auto Search
    const mqttSuccess = await sendRtsStartCommand(id_logger);

    return NextResponse.json({
      success: true,
      data: {
        id_log: idLog,
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
        SELECT id_logger FROM t_logger WHERE kategori_log = '1' LIMIT 1
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
