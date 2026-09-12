import { NextRequest, NextResponse } from "next/server";
import { waktuDbWib } from "@/components/monitoring/format";
import { prisma } from "@/lib/prisma";
import { publishMqtt } from "@/lib/mqtt";
import { sesiTerakhirLogger, sesiUntukSiklus } from "@/lib/log-kontrol";
import { awalSiklus } from "@/lib/sesi-kontrol";

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

  // Jam server dipakai HANYA kalau logger tidak menyertakan waktunya sendiri.
  // Lewat waktuDbWib supaya hasilnya tetap jam dinding WIB walau zona proses
  // bukan WIB — getHours() dulu diam-diam ikut zona sistem.
  return waktuDbWib();
}

// Sensor yang kolom-nya FLOAT di MySQL — tidak boleh string kosong.
//
// Batasnya di sensor14: sensor1–sensor13 varchar (nama target, sudut DMS,
// koordinat), sensor14–sensor25 float. Lihat model Rts/TempRts di
// prisma/schema.prisma.
//
// Daftar ini sebelumnya berhenti di 19, padahal payload boleh tidak memuat
// sensor20–sensor25 sama sekali — termasuk tilt yang tidak terbaca. Slot yang
// hilang jadi "" dan MySQL menolaknya di kolom float.
const NUMERIC_SENSORS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
]);

function buildSensorPayload(payload: PayloadMap) {
  const data: Record<string, string | number> = {};

  for (let i = 1; i <= 25; i += 1) {
    const val = payload[`sensor${i}`];
    if (NUMERIC_SENSORS.has(i)) {
      // Kolom float: pakai 0 jika tidak ada atau kosong
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
 * legacy field names: id_alat, tanggal, jam, sensor1..sensor25, sn.
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
    const mqttPrismaTopic = `Logger_${idAlat}`;
    const mqttKontrolTopic = "kontrol-asaba";

    // DEBUG: log apa yang diterima dari logger
    console.log("[datamasuk/adr] payload.id_alat:", idAlat);
    console.log("[datamasuk/adr] payload.tanggal:", payload.tanggal);
    console.log("[datamasuk/adr] payload.jam:", payload.jam);
    console.log("[datamasuk/adr] payload.waktu (raw):", payload.waktu);
    console.log("[datamasuk/adr] waktu (computed):", waktu);

    // ── Sesi running ────────────────────────────────────────────────────────
    //
    // Dikerjakan SEBELUM apa pun yang menyentuh `rts` atau `temp_rts`, karena
    // dua hal di bawah bergantung padanya:
    //
    //   1. `id_kontrol` tiap baris `rts` harus menunjuk sesi siklus INI.
    //   2. Tepi naik sensor16 dibaca dari `temp_rts`, dan tabel itu ditimpa
    //      payload ini beberapa baris lagi.
    //
    // Sebelumnya tidak ada langkah ini sama sekali: sesi hanya lahir dari
    // tombol Mulai, dan tiap payload ditempelkan ke sesi TERAKHIR logger apa
    // pun keadaannya. Siklus yang dijalankan jadwal AutoTracking berjalan
    // langsung di firmware tanpa melewati aplikasi, jadi hasilnya menumpuk di
    // sesi lama yang sudah selesai — sesi 101109 dibuka 21-11-2025 dan masih
    // menerima baris bertanggal 26-08-2026. Di riwayat running tidak ada satu
    // pun sesi baru sejak 2025, padahal pengukurannya jalan terus.
    const rtsSebelumnya = await prisma.$queryRaw<Array<{ sensor16: number | string | null }>>`
      SELECT sensor16 FROM temp_rts WHERE code_logger = ${idAlat} LIMIT 1
    `;

    // Payload yang TIDAK menyebut sensor16 tidak dipakai menyimpulkan apa pun.
    // buildSensorPayload mengisi medan float yang hilang dengan "0" supaya
    // MySQL menerimanya, dan nol itu tidak bisa dibedakan dari "instrumen
    // berhenti" — dibaca sebagai berhenti, ia akan memecah satu siklus yang
    // sedang berjalan menjadi dua sesi begitu payload berikutnya menyebut 1
    // lagi. Keadaan sebelumnya dibiarkan berlaku sampai ada laporan sungguhan.
    const sensor16Dilaporkan =
      payload.sensor16 !== undefined && payload.sensor16 !== "";
    const siklusMulai =
      sensor16Dilaporkan && awalSiklus(sensorData.sensor16, rtsSebelumnya[0]?.sensor16);

    const sesi = siklusMulai
      ? await sesiUntukSiklus({ idLogger: idAlat, waktuDb: waktu })
      : await sesiTerakhirLogger(idAlat);

    // Site sesi yang sedang berjalan. Dipakai untuk membatasi update prisma —
    // `id_prisma` cuma nomor slot RTS yang dipakai ulang tiap site, jadi
    // meng-update berdasarkan id_prisma saja akan menimpa baris milik site lain.
    const siteAktif = sesi?.site ?? null;
    idLog = sesi?.idLog ?? "";

    if (siklusMulai) {
      console.log(
        `[datamasuk/adr] siklus mulai di ${idAlat} → sesi ${idLog || "(gagal)"}` +
          ` site=${siteAktif ?? "?"}` +
          (sesi && "baru" in sesi && sesi.baru ? " (dibuka logger sendiri)" : " (sesi tombol Mulai)")
      );
    }

    // Umumkan siklus yang dimulai logger sendiri, supaya halaman Kontrol ADR
    // yang sedang terbuka langsung menunjukkan pengukuran sedang berjalan —
    // tanpa ini operator cuma melihat kartu prisma sesi sebelumnya diam-diam
    // berubah satu per satu. `site` dan `id_logger` ikut dikirim karena topik
    // ini tidak ber-scope perangkat: tanpa keduanya, halaman yang sedang
    // membuka site lain ikut menyala "Running".
    if (siklusMulai && sesi && "baru" in sesi && sesi.baru) {
      mqttKontrolSent = await publishMqtt(mqttKontrolTopic, {
        status: "1",
        datetime: waktu,
        site: siteAktif,
        id_logger: idAlat,
        dipicu: "logger",
      });
    }

    if (sensorData.sensor1) {
      if (idLog) {
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

      if (siteAktif) {
        // Batasi ke site sesi berjalan.
        await prisma.$executeRawUnsafe(
          `${tempPrismaUpdate.sql} AND site = ?`,
          ...tempPrismaUpdate.values,
          siteAktif
        );
        // `sensor3` = nama titik. PROTOKOL_MQTT_ADR revisi 6 bagian F
        // menyebutnya "konstanta prisma" — itu keliru, sudah dikonfirmasi ke
        // sisi firmware, dan data historis di `rts` juga berisi nama (`TS_1`,
        // `TS_2`). Jangan diikutkan ke dokumen: kalau slot ini dianggap
        // konstanta, setiap payload masuk akan menimpa `nama_prisma` seluruh
        // prisma dengan angka seperti "-30".
        await prisma.$executeRaw`
          UPDATE t_prisma
          SET nama_prisma = ${sensorData.sensor3}
          WHERE id_prisma = ${sensorData.sensor1} AND site = ${siteAktif}
        `;
      } else {
        // Tidak ada sesi aktif untuk logger ini — tanpa site, update apa pun
        // berisiko mengenai baris site yang salah. Lewati dan catat.
        console.warn(
          `[datamasuk/adr] Tidak ada sesi log_kontrol untuk logger ${idAlat}; ` +
            `update prisma "${sensorData.sensor1}" dilewati agar tidak menimpa site lain.`
        );
      }

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
        // `site` dan `id_logger` ikut dikirim dengan alasan yang sama seperti
        // pada pengumuman "mulai": topik ini dipakai bersama semua perangkat,
        // jadi tanpa keduanya halaman yang sedang membuka site lain ikut
        // menganggap pengukurannya selesai.
        const kontrolPayload = {
          status: 0,
          status_manual: 0,
          site: siteAktif,
          id_logger: idAlat,
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
