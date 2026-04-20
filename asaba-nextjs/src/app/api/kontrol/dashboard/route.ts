import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


/**
 * GET /api/kontrol/dashboard
 * Ambil semua data yang diperlukan untuk halaman Kontrol ADR.
 * Setara dengan Adr::kontrol() di CI3.
 *
 * Response mencakup:
 * - info_logger: nama dan lokasi logger
 * - status_logger: online/offline berdasarkan waktu last update
 * - data_rts: data terbaru dari temp_rts (HA, VA, Slope Distance, dll)
 * - status_kontrol: status dari set_tempkontrol
 * - log_kontrol: 10 riwayat running terbaru beserta data prisma
 * - data_prisma: list prisma aktif dengan data temp_prisma
 * - config_adr: konfigurasi RTS
 * - schedule: daftar jadwal running
 * - jumlah_prisma: total prisma terdaftar
 *
 * Query params:
 * - id_logger: (optional) override logger ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let id_logger = searchParams.get("id_logger");

    // Ambil id_logger secara dinamis dari DB jika tidak disediakan
    if (!id_logger) {
      const loggers = await prisma.$queryRaw<Array<{ id_logger: string }>>`
        SELECT id_logger FROM t_logger WHERE kategori_log = '1' LIMIT 1
      `;
      id_logger = loggers?.[0]?.id_logger ?? null;
    }

    if (!id_logger) {
      return NextResponse.json(
        { success: false, error: "ADR logger not found in database" },
        { status: 404 }
      );
    }

    // 1. Info logger (nama & lokasi)
    const loggerInfo = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT 
        l.id_logger,
        l.nama_logger,
        lok.nama_lokasi,
        lok.latitude,
        lok.longitude
      FROM t_logger l
      LEFT JOIN t_lokasi lok ON l.lokasi_logger = lok.idlokasi
      WHERE l.id_logger = ${id_logger}
      LIMIT 1
    `;
    const info_logger = loggerInfo?.[0] ?? null;

    // 2. Data terbaru dari temp_rts
    const tempRtsRows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM temp_rts WHERE code_logger = ${id_logger} ORDER BY id DESC LIMIT 1
    `;
    const temp_rts = tempRtsRows?.[0] ?? null;

    // 3. Status logger (online jika waktu dalam 1 jam terakhir)
    let status_logger = false;
    if (temp_rts?.waktu) {
      const waktuRts = new Date(temp_rts.waktu as string);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      status_logger = waktuRts >= oneHourAgo;
    }

    // 4. Parameter sensor  mapping kolom ke nama parameter
    const params = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT nama_parameter, kolom_sensor, satuan
      FROM parameter_sensor
      WHERE logger_id = ${id_logger}
    `;
    const data_rts: Record<string, { nilai: unknown; satuan: string }> = {};
    if (temp_rts) {
      for (const p of params as Array<{ nama_parameter: string; kolom_sensor: string; satuan: string }>) {
        data_rts[p.nama_parameter] = {
          nilai: temp_rts[p.kolom_sensor],
          satuan: p.satuan,
        };
      }
    }

    // 5. Status kontrol dari set_tempkontrol
    const statusKontrolRows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM set_tempkontrol WHERE id_logger = ${id_logger} LIMIT 1
    `;
    const status_kontrol = statusKontrolRows?.[0] ?? null;

    // 6. Log kontrol (10 terbaru + data prisma per sesi)
    const logKontrolRows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM log_kontrol ORDER BY datetime DESC LIMIT 10
    `;

    const log_kontrol = await Promise.all(
      (logKontrolRows as Array<Record<string, unknown>>).map(async (lg) => {
        const idLog = lg.id_log as string;
        const rtsData = await prisma.$queryRaw<Array<Record<string, unknown>>>`
          SELECT sensor1, sensor8, sensor9, sensor10
          FROM rts
          WHERE id_kontrol = ${idLog}
        `;
        const data_kirim = (rtsData as Array<Record<string, unknown>>).map((v) => ({
          id_prisma: v.sensor1,
          E: v.sensor8,
          N: v.sensor9,
          Z: v.sensor10,
          status:
            v.sensor8 !== 0 && v.sensor9 !== 0 && v.sensor10 !== 0
              ? "Success"
              : "Failed",
        }));
        return { ...lg, data_kirim };
      })
    );

    // 7. Data prisma aktif dengan temp_prisma
    const dataPrisma = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT p.*, tp.N1, tp.E1, tp.Z1, tp.N0, tp.E0, tp.Z0, tp.status_get, tp.waktu as waktu_tembak
      FROM t_prisma p
      LEFT JOIN temp_prisma tp ON tp.id_prisma = p.id_prisma
      WHERE p.id_logger = ${id_logger}
      ORDER BY p.id ASC
    `;

    // 8. Config ADR
    const configAdrRows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM config_adr WHERE id_logger = ${id_logger} LIMIT 1
    `;
    const config_adr = configAdrRows?.[0] ?? null;

    // 9. Jadwal running (scheduling_task)
    const scheduleAll = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM scheduling_task ORDER BY days ASC, time ASC
    `;

    // Group schedule by days
    const dayGroups: Record<string, { status: boolean; sc: Array<Record<string, unknown>> }> = {};
    for (const sc of scheduleAll as Array<Record<string, unknown>>) {
      const day = String(sc.days);
      if (!dayGroups[day]) {
        dayGroups[day] = { status: false, sc: [] };
      }
      if (sc.status === "1" || sc.status === 1) {
        dayGroups[day].status = true;
      }
      dayGroups[day].sc.push(sc);
    }
    const schedule = Object.entries(dayGroups).map(([days, data]) => ({
      days,
      ...data,
    }));

    return NextResponse.json({
      success: true,
      data: {
        id_logger,
        info_logger,
        status_logger,
        data_rts,
        waktu: temp_rts?.waktu ?? null,
        status_kontrol,
        log_kontrol,
        data_prisma: dataPrisma,
        config_adr,
        schedule,
        schedule_all: scheduleAll,
        jumlah_prisma: dataPrisma.length,
      },
    });
  } catch (error) {
    console.error("[GET /api/kontrol/dashboard]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch kontrol dashboard data" },
      { status: 500 }
    );
  }
}
