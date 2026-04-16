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

function buildSensorPayload(payload: PayloadMap) {
  const data: PayloadMap = {};

  for (let i = 1; i <= 23; i += 1) {
    data[`sensor${i}`] = payload[`sensor${i}`] || "";
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
        id_prisma: sensorData.sensor1,
        waktu,
        N1: sensorData.sensor8,
        E1: sensorData.sensor9,
        Z1: sensorData.sensor10,
        N0: sensorData.sensor11,
        E0: sensorData.sensor12,
        Z0: sensorData.sensor13,
        status_get: "1",
      };

      const tempPrismaUpdate = buildUpdateStatement(
        "temp_prisma",
        prismaUpdate,
        "id_prisma",
        sensorData.sensor1
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

      mqttPrismaSent = await publishMqtt(`rts-${idAlat}`, prismaUpdate);
    }

    const rtsPayload: PayloadMap = {
      code_logger: idAlat,
      id_kontrol: idLog,
      waktu,
      ...sensorData,
    };

    const rtsInsert = buildInsertStatement("rts", rtsPayload);
    await prisma.$executeRawUnsafe(rtsInsert.sql, ...rtsInsert.values);

    const tempRtsUpdate = buildUpdateStatement(
      "temp_rts",
      rtsPayload,
      "code_logger",
      idAlat
    );
    await prisma.$executeRawUnsafe(
      tempRtsUpdate.sql,
      ...tempRtsUpdate.values
    );

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

        mqttKontrolSent = await publishMqtt("kontrol-asaba", kontrolPayload);
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
        mqtt_kontrol_sent: mqttKontrolSent,
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
