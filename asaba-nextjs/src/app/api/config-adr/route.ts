import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRtsConfig } from "@/lib/mqtt";


/**
 * GET /api/config-adr
 * Fetch konfigurasi ADR dari tabel config_adr (row pertama).
 *
 * PUT /api/config-adr
 * Update konfigurasi ADR (berdasarkan id) + kirim ke logger via MQTT.
 */
export async function GET() {
  try {
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM config_adr ORDER BY id ASC LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Config not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("[GET /api/config-adr]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch config ADR" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      job_name,
      prisma_cons,
      ts_high,
      coor_x,
      coor_y,
      coor_z,
      step_record,
      retries,
      cycle_time,
    } = body;

    // Simpan ke DB
    await prisma.$executeRaw`
      UPDATE config_adr
      SET
        job_name     = ${job_name},
        prisma_cons  = ${parseFloat(prisma_cons)},
        ts_high      = ${parseFloat(ts_high)},
        coor_x       = ${parseFloat(coor_x)},
        coor_y       = ${parseFloat(coor_y)},
        coor_z       = ${parseFloat(coor_z)},
        step_record  = ${parseInt(step_record)},
        retries      = ${parseInt(retries)},
        cycle_time   = ${parseInt(cycle_time)}
      WHERE id = ${id}
    `;

    // Ambil id_logger ADR untuk MQTT
    const loggers = await prisma.$queryRaw<Array<{ id_logger: string }>>`
      SELECT l.id_logger
      FROM t_logger l
      JOIN kategori_logger kl ON l.kategori_log = kl.id_katlogger
      WHERE kl.nama_kategori LIKE '%ADR%' OR kl.nama_kategori LIKE '%RTS%'
      LIMIT 1
    `;
    const loggerId = loggers?.[0]?.id_logger;

    // Kirim config ke logger via MQTT
    let mqttSent = false;
    if (loggerId) {
      mqttSent = await sendRtsConfig(loggerId, {
        jobName:    job_name || "",
        prismConst: String(prisma_cons ?? "0"),
        tsHigh:     String(ts_high ?? "0"),
        locCoor:    [String(coor_x ?? "0"), String(coor_y ?? "0"), String(coor_z ?? "0")],
        stepRecord: parseInt(step_record) || 5,
        retries:    parseInt(retries) || 2,
        cycleTime:  parseInt(cycle_time) || 15,
      });
    }

    return NextResponse.json({ success: true, mqtt_sent: mqttSent });
  } catch (error) {
    console.error("[PUT /api/config-adr]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update config ADR" },
      { status: 500 }
    );
  }
}

