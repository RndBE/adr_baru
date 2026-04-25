import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishMqtt } from "@/lib/mqtt";


/**
 * Helper: Ambil id_logger ADR secara dinamis dari kategori_log = '1'
 */
async function getAdrLoggerId(): Promise<string | null> {
  const loggers = await prisma.$queryRaw<Array<{ id_logger: string }>>`
    SELECT id_logger FROM t_logger WHERE kategori_log = '1' LIMIT 1
  `;
  return loggers?.[0]?.id_logger ?? null;
}

/**
 * GET /api/prism-config
 * Daftar 50 slot prisma (dinamis dari t_prisma + temp_prisma).
 * Setara dengan Adr::daftar_prisma() di CI3.
 * 
 * Query params:
 * - id_logger: (optional) override logger ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idLoggerParam = searchParams.get("id_logger");
    const id_logger = idLoggerParam ?? await getAdrLoggerId();

    if (!id_logger) {
      return NextResponse.json(
        { success: false, error: "ADR logger not found in database" },
        { status: 404 }
      );
    }

    // Ambil semua prisma terdaftar untuk logger ini
    const registeredPrisma = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT 
        p.id,
        p.id_prisma,
        p.id_logger,
        p.nama_prisma,
        p.status_controller,
        p.target_height,
        p.HA,
        p.VA,
        p.SlopDis,
        tp.waktu,
        tp.N1, tp.E1, tp.Z1,
        tp.N0, tp.E0, tp.Z0,
        tp.status_get
      FROM t_prisma p
      LEFT JOIN temp_prisma tp ON tp.id_prisma = p.id_prisma
      WHERE p.id_logger = ${id_logger}
      ORDER BY p.id ASC
    `;

    // Buat 50 slot (P1..P50)
    const registeredMap = new Map<string, Record<string, unknown>>();
    for (const pr of registeredPrisma as Array<Record<string, unknown>>) {
      registeredMap.set(pr.id_prisma as string, pr);
    }

    const slot = Array.from({ length: 50 }, (_, i) => {
      const id_prisma = `P${i + 1}`;
      if (registeredMap.has(id_prisma)) {
        return { ...registeredMap.get(id_prisma), slot: i + 1, registered: true };
      }
      return {
        slot: i + 1,
        id: i + 1,
        id_prisma,
        id_logger,
        nama_prisma: "Not Set",
        status_controller: "sensor9",
        target_height: "",
        HA: "Not Set",
        VA: "Not Set",
        SlopDis: "Not Set",
        registered: false,
      };
    });

    return NextResponse.json({
      success: true,
      data: slot,
      id_logger,
    });
  } catch (error) {
    console.error("[GET /api/prism-config]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch prism config" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/prism-config
 * Insert prisma baru ke t_prisma, temp_prisma, parameter_prisma + kirim MQTT.
 * Setara dengan Adr::input_prisma() di CI3.
 * 
 * Body: { slot_id, nama_prisma, target_height }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slot_id, nama_prisma, target_height } = body;

    if (!slot_id || !nama_prisma) {
      return NextResponse.json(
        { success: false, error: "slot_id dan nama_prisma wajib diisi" },
        { status: 400 }
      );
    }

    const id_logger = await getAdrLoggerId();
    if (!id_logger) {
      return NextResponse.json(
        { success: false, error: "ADR logger not found in database" },
        { status: 404 }
      );
    }

    const id_prisma = `P${slot_id}`;

    // Cek apakah sudah ada
    const existing = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM t_prisma WHERE id_prisma = ${id_prisma} LIMIT 1
    `;
    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: `Prisma ${id_prisma} sudah terdaftar. Gunakan PUT untuk update.` },
        { status: 409 }
      );
    }

    // Get max id
    const maxIdRows = await prisma.$queryRaw<Array<{ max_id: number | null }>>`
      SELECT MAX(id) as max_id FROM t_prisma
    `;
    const new_id = (maxIdRows[0]?.max_id ?? 0) + 1;

    // 1. INSERT ke t_prisma
    await prisma.$executeRaw`
      INSERT INTO t_prisma (id, id_logger, id_prisma, nama_prisma, status_controller, target_height)
      VALUES (${new_id}, ${id_logger}, ${id_prisma}, ${nama_prisma}, 'sensor9', ${target_height ?? 0})
    `;

    // 2. INSERT ke temp_prisma
    await prisma.$executeRaw`
      INSERT INTO temp_prisma (id_prisma, waktu, N1, E1, Z1, N0, E0, Z0, status_get)
      VALUES (${id_prisma}, '-', '0', '0', '0', '0', '0', '0', '1')
    `;

    // 3. INSERT parameter_prisma (Northing, Easting, Elevation)
    await prisma.$executeRaw`
      INSERT INTO parameter_prisma (id_prisma, nama_parameter, kolom_sensor, analisa, tipe_graf, icon_sensor)
      VALUES (${id_prisma}, 'Northing_Y', 'sensor8', '1', 'spline', 'northing')
    `;
    await prisma.$executeRaw`
      INSERT INTO parameter_prisma (id_prisma, nama_parameter, kolom_sensor, analisa, tipe_graf, icon_sensor)
      VALUES (${id_prisma}, 'Easting_X', 'sensor9', '1', 'spline', 'easting')
    `;
    await prisma.$executeRaw`
      INSERT INTO parameter_prisma (id_prisma, nama_parameter, kolom_sensor, analisa, tipe_graf, icon_sensor)
      VALUES (${id_prisma}, 'Elevation', 'sensor10', '1', 'spline', 'elevation_z')
    `;

    // 4. Kirim recordTarget ke logger via MQTT
    const topic = process.env.MQTT_TOPIC || "ADR_Tambang_Kaltara";
    const mqttPayload = {
      [`set_${id_logger}`]: {
        command: "set_rts",
        recordTarget: {
          slot: parseInt(String(slot_id)),
          name: nama_prisma,
          targetHigh: String(target_height ?? "0"),
          HA: "0",
          VA: "0",
        },
      },
    };
    const mqttSent = await publishMqtt(topic, mqttPayload);

    return NextResponse.json({
      success: true,
      message: "Prisma berhasil diset, menunggu respon perangkat...",
      mqtt_sent: mqttSent,
    });
  } catch (error) {
    console.error("[POST /api/prism-config]", error);
    return NextResponse.json(
      { success: false, error: "Failed to insert prisma" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/prism-config
 * Setara dengan Adr::update_prisma() di CI3.
 * Update data prisma + kirim recordTarget via MQTT (fire-and-forget).
 * HA/VA akan disimpan oleh frontend via /api/prism-config/prism-set
 * saat menerima response dari logger.
 *
 * Body: { slot_id, nama_prisma?, target_height? }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { slot_id, nama_prisma, target_height } = body;

    if (!slot_id) {
      return NextResponse.json(
        { success: false, error: "slot_id wajib diisi" },
        { status: 400 }
      );
    }

    const id_logger = await getAdrLoggerId();
    if (!id_logger) {
      return NextResponse.json(
        { success: false, error: "ADR logger not found in database" },
        { status: 404 }
      );
    }

    const id_prisma = `P${slot_id}`;

    // Update t_prisma (nama_prisma + target_height saja, seperti PHP)
    const updates: string[] = [];
    if (nama_prisma !== undefined) updates.push(`nama_prisma = '${nama_prisma}'`);
    if (target_height !== undefined) updates.push(`target_height = '${target_height}'`);

    if (updates.length > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE t_prisma SET ${updates.join(", ")} WHERE id_prisma = ?`,
        id_prisma
      );
    }

    // Kirim recordTarget ke logger via MQTT (tanpa HA/VA, seperti PHP)
    const topic = process.env.MQTT_TOPIC || "ADR_Tambang_Kaltara";
    const mqttPayload = {
      [`set_${id_logger}`]: {
        command: "set_rts",
        recordTarget: {
          slot: parseInt(String(slot_id)),
          name: nama_prisma ?? id_prisma,
          targetHigh: String(target_height ?? "0"),
        },
      },
    };
    const mqttSent = await publishMqtt(topic, mqttPayload);

    return NextResponse.json({
      success: true,
      message: "Prisma berhasil diperbarui",
      mqtt_sent: mqttSent,
    });
  } catch (error) {
    console.error("[PUT /api/prism-config]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update prisma" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/prism-config
 * Hapus prisma dari t_prisma, temp_prisma, parameter_prisma.
 * 
 * Body: { slot_id }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { slot_id } = body;

    if (!slot_id) {
      return NextResponse.json(
        { success: false, error: "slot_id wajib diisi" },
        { status: 400 }
      );
    }

    const id_prisma = `P${slot_id}`;

    await prisma.$executeRaw`DELETE FROM parameter_prisma WHERE id_prisma = ${id_prisma}`;
    await prisma.$executeRaw`DELETE FROM temp_prisma WHERE id_prisma = ${id_prisma}`;
    await prisma.$executeRaw`DELETE FROM t_prisma WHERE id_prisma = ${id_prisma}`;

    return NextResponse.json({ success: true, message: "Prisma berhasil dihapus" });
  } catch (error) {
    console.error("[DELETE /api/prism-config]", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete prisma" },
      { status: 500 }
    );
  }
}
