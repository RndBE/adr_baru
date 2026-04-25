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

    // Update set_tempkontrol — gunakan id_logger_int (Int) bukan string
    const dateNow = new Date();
    await prisma.setTempkontrol.updateMany({
      where: { id_logger: String(id_logger_int) },
      data: {
        status: "1",
        status_manual: "1",
        datetime: dateNow,
      },
    });

    // Reset prisma status_get ke 2 (Running) — menunggu data dari logger
    const dataPrisma = await prisma.prismaTarget.findMany({
      where: { id_logger: id_logger_int ?? parseInt(id_logger) },
    });
    for (const p of dataPrisma) {
      await prisma.tempPrisma.updateMany({
        where: { id_prisma: p.id_prisma },
        data: { status_get: 2 },
      });
    }

    // Create log_kontrol entry
    const idLog = dateNow.toTimeString().slice(0, 8).replace(/:/g, "");
    await prisma.logKontrol.create({
      data: {
        id_log: idLog,
        id_logger: id_logger,
        prisma: "",
        datetime: dateNow,
        r0: 0,
      },
    });

    // ── Ambil config RTS dari config_adr ──
    const configRows = await prisma.$queryRaw<Array<{
      job_name: string | null;
      prisma_cons: string | null;
      ts_high: string | null;
      coor_x: string | null;
      coor_y: string | null;
      coor_z: string | null;
      step_record: number | null;
      retries: number | null;
      cycle_time: number | null;
    }>>`
      SELECT job_name, prisma_cons, ts_high, coor_x, coor_y, coor_z,
             step_record, retries, cycle_time
      FROM config_adr LIMIT 1
    `;
    const cfg = configRows?.[0];

    const rtsConfig = {
      jobName:    cfg?.job_name    || "",
      prismConst: cfg?.prisma_cons || "0",
      tsHigh:     cfg?.ts_high     || "0",
      locCoor:    [
        String(cfg?.coor_x || "0"),
        String(cfg?.coor_y || "0"),
        String(cfg?.coor_z || "0"),
      ] as [string, string, string],
      stepRecord: Number(cfg?.step_record ?? 5),
      retries:    Number(cfg?.retries     ?? 2),
      cycleTime:  Number(cfg?.cycle_time  ?? 15),
    };

    // ── Ambil daftar prisma targets dari t_prisma ──
    const prismaRows = await prisma.$queryRaw<Array<{
      id: number;
      id_prisma: string;
      nama_prisma: string;
      target_height: string | null;
      HA: string | null;
      VA: string | null;
    }>>`
      SELECT id, id_prisma, nama_prisma, target_height, HA, VA
      FROM t_prisma
      WHERE id_logger = ${id_logger}
      ORDER BY id ASC
    `;

    const prismaTargets = prismaRows.map((p, idx) => ({
      slot:       idx + 1,
      name:       p.nama_prisma || p.id_prisma,
      targetHigh: String(p.target_height ?? "0"),
      HA:         String(p.HA ?? "0"),
      VA:         String(p.VA ?? "0"),
    }));

    // ── Kirim MQTT: config → recordTarget per prisma → AutoTrackingStart ──
    const mqttSuccess = await sendRtsStartCommand(id_logger, rtsConfig, prismaTargets);

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

    const setTemp = await prisma.setTempkontrol.findMany({
      where: { id_logger: idLogger },
    });

    const values = setTemp.map((s) => s.status);
    let statusKontrol = status?.status_kontrol || "0";
    if (statusKontrol === "2" && values.includes("1")) {
      statusKontrol = "1";
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
