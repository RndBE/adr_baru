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
    const { kode_akses, id_logger = "30002" } = body;

    // Verify access code
    if (kode_akses) {
      const { createHash } = await import("crypto");
      const hashedInput = createHash("md5").update(kode_akses).digest("hex");
      
      const accessCode = await prisma.kodeAkses.findFirst({
        where: { id_user: 2 },
      });

      if (!accessCode || accessCode.kode_akses !== hashedInput) {
        return NextResponse.json(
          { success: false, error: "Invalid access code" },
          { status: 403 }
        );
      }
    }

    // Update set_tempkontrol
    const dateNow = new Date();
    await prisma.setTempkontrol.updateMany({
      where: { id_logger: id_logger },
      data: {
        status: "1",
        status_manual: "1",
        datetime: dateNow,
      },
    });

    // Reset prisma status_get
    const dataPrisma = await prisma.prismaTarget.findMany({
      where: { id_logger: parseInt(id_logger) },
    });
    for (const p of dataPrisma) {
      await prisma.tempPrisma.updateMany({
        where: { id_prisma: p.id_prisma },
        data: { status_get: 0 },
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

    // Send MQTT command
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
    const idLogger = searchParams.get("id_logger") || "30002";

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
      data: { status_kontrol: statusKontrol },
    });
  } catch (error) {
    console.error("[GET /api/kontrol/start]", error);
    return NextResponse.json(
      { success: false, error: "Failed to get status" },
      { status: 500 }
    );
  }
}
