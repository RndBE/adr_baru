import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishMqtt } from "@/lib/mqtt";

type PayloadMap = Record<string, string>;

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

async function parsePayload(request: NextRequest): Promise<PayloadMap> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const json = (await request.json()) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(json).map(([key, value]) => [key, toStringValue(value)])
    );
  }

  const form = await request.formData();
  return Object.fromEntries(
    Array.from(form.entries()).map(([key, value]) => [key, toStringValue(value)])
  );
}

function getWaktu(payload: PayloadMap): string {
  if (payload.waktu) {
    return payload.waktu;
  }

  if (payload.tanggal && payload.jam) {
    return `${payload.tanggal} ${payload.jam}`.trim();
  }

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

// Sensor yang kolom-nya integer/bit di MySQL — tidak boleh string kosong
const NUMERIC_SENSORS = new Set([14, 15, 16, 17, 18, 19]);

function buildSensorPayload(payload: PayloadMap) {
  const data: Record<string, string | number> = {};

  for (let i = 1; i <= 25; i += 1) {
    const val = payload[`sensor${i}`];
    if (NUMERIC_SENSORS.has(i)) {
      // Kolom integer/bit: pakai 0 jika tidak ada atau kosong
      data[`sensor${i}`] = (val !== undefined && val !== "") ? val : "0";
    } else {
      // Kolom varchar/text: pakai string kosong jika tidak ada
      data[`sensor${i}`] = val ?? "";
    }
  }

  return data;
}

function buildInsertStatement(table: string, data: PayloadMap) {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;

  return { sql, values };
}

function buildUpdateStatement(
  table: string,
  data: PayloadMap,
  whereColumn: string,
  whereValue: string
) {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const assignments = columns.map((column) => `${column} = ?`).join(", ");
  const sql = `UPDATE ${table} SET ${assignments} WHERE ${whereColumn} = ?`;

  return { sql, values: [...values, whereValue] };
}

/**
 * POST /api/datamasuk/adr
 * Port of CI3 Datamasuk::add_adr().
 *
 * Accepts either JSON or form-urlencoded/form-data payloads using the
 * legacy field names: id_alat, tanggal, jam, sensor1..sensor23, sn.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await parsePayload(request);
    const idAlat = payload.id_alat;

    if (!idAlat) {
      return NextResponse.json(
        { success: false, error: "id_alat is required" },
        { status: 400 }
      );
    }

    const waktu = getWaktu(payload);
    const sensorData = buildSensorPayload(payload);
    let idLog = "";
    let mqttPrismaSent = false;
    let mqttKontrolSent = false;
    const mqttPrismaTopic = `rts-${idAlat}`;
    const mqttKontrolTopic = "kontrol-asaba";

    // DEBUG: log apa yang diterima dari logger
    console.log("[datamasuk/adr] payload.id_alat:", idAlat);
    console.log("[datamasuk/adr] payload.tanggal:", payload.tanggal);
    console.log("[datamasuk/adr] payload.jam:", payload.jam);
    console.log("[datamasuk/adr] payload.waktu (raw):", payload.waktu);
    console.log("[datamasuk/adr] waktu (computed):", waktu);

    if (sensorData.sensor1) {
      const latestLog = await prisma.$queryRaw<Array<{ id_log: string }>>`
        SELECT id_log
        FROM log_kontrol
        WHERE id_logger = ${idAlat}
        ORDER BY datetime DESC
        LIMIT 1
      `;

      if (latestLog[0]?.id_log) {
        idLog = latestLog[0].id_log;
        await prisma.$executeRaw`
          UPDATE log_kontrol
          SET prisma = ${sensorData.sensor1}
          WHERE id_log = ${idLog}
        `;
      }

      const prismaUpdate: PayloadMap = {
        id_prisma: String(sensorData.sensor1),
        waktu,
        N1: String(sensorData.sensor8),
        E1: String(sensorData.sensor9),
        Z1: String(sensorData.sensor10),
        N0: String(sensorData.sensor11),
        E0: String(sensorData.sensor12),
        Z0: String(sensorData.sensor13),
        status_get: "1",
      };

      const tempPrismaUpdate = buildUpdateStatement(
        "temp_prisma",
        prismaUpdate,
        "id_prisma",
        String(sensorData.sensor1)
      );
      await prisma.$executeRawUnsafe(
        tempPrismaUpdate.sql,
        ...tempPrismaUpdate.values
      );

      await prisma.$executeRaw`
        UPDATE t_prisma
        SET nama_prisma = ${sensorData.sensor3}
        WHERE id_prisma = ${sensorData.sensor1}
      `;

      mqttPrismaSent = await publishMqtt(mqttPrismaTopic, prismaUpdate);
    }

    const rtsPayload: PayloadMap = {
      code_logger: idAlat,
      id_kontrol: idLog,
      waktu,
      ...sensorData,
    };

    const rtsInsert = buildInsertStatement("rts", rtsPayload);
    await prisma.$executeRawUnsafe(rtsInsert.sql, ...rtsInsert.values);

    // UPDATE temp_rts: hapus baris lama lalu insert baru
    // - Tidak bergantung pada UNIQUE KEY di code_logger
    // - Menjamin hanya 1 baris per logger yang tersimpan
    await prisma.$executeRaw`DELETE FROM temp_rts WHERE code_logger = ${idAlat}`;
    const tempRtsInsert = buildInsertStatement("temp_rts", rtsPayload);
    await prisma.$executeRawUnsafe(tempRtsInsert.sql, ...tempRtsInsert.values);

    const kontrolRows = await prisma.$queryRaw<
      Array<{ status: string | null; status_manual: string | null }>
    >`
      SELECT status, status_manual
      FROM set_tempkontrol
      WHERE id_logger = ${idAlat}
      LIMIT 1
    `;

    const kontrol = kontrolRows[0];

    if (kontrol) {
      if (kontrol.status === "1" && sensorData.sensor16 === "1") {
        await prisma.$executeRaw`
          UPDATE set_tempkontrol
          SET status = '0', status_manual = '1'
          WHERE id_logger = ${idAlat}
        `;
      } else if (
        kontrol.status === "0" &&
        kontrol.status_manual === "0" &&
        sensorData.sensor16 === "1"
      ) {
        await prisma.$executeRaw`
          UPDATE set_tempkontrol
          SET status_manual = '1'
          WHERE id_logger = ${idAlat}
        `;
      } else if (kontrol.status_manual === "1" && sensorData.sensor16 === "0") {
        const kontrolPayload = {
          status: 0,
          status_manual: 0,
        };

        await prisma.$executeRaw`
          UPDATE set_tempkontrol
          SET status = '0', status_manual = '0'
          WHERE id_logger = ${idAlat}
        `;

        mqttKontrolSent = await publishMqtt(mqttKontrolTopic, kontrolPayload);
      }
    }

    if (payload.sn) {
      const infoRows = await prisma.$queryRaw<Array<{ serial_number: string | null }>>`
        SELECT serial_number
        FROM t_informasi
        WHERE logger_id = ${idAlat}
        LIMIT 1
      `;

      const serialNumber = infoRows[0]?.serial_number || "";
      if (serialNumber !== payload.sn) {
        await prisma.$executeRaw`
          UPDATE t_informasi
          SET serial_number = ${payload.sn}
          WHERE logger_id = ${idAlat}
        `;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id_alat: idAlat,
        id_log: idLog,
        waktu,
        prisma: sensorData.sensor1 || null,
        mqtt_prisma_sent: mqttPrismaSent,
        mqtt_prisma_topic: mqttPrismaTopic,
        mqtt_kontrol_sent: mqttKontrolSent,
        mqtt_kontrol_topic: mqttKontrolTopic,
      },
    });
  } catch (error) {
    console.error("[POST /api/datamasuk/adr]", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process ADR payload",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
