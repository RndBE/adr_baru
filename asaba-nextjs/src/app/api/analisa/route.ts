import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/analisa
 * Ambil data analisa grafik untuk prisma tertentu berdasarkan rentang waktu.
 * Setara dengan Adr::analisa() dan Adr::analisa_logger() di CI3.
 *
 * Query params:
 * - type: "hari" | "bulan" | "tahun" | "range"  (wajib)
 * - id_prisma: misal "P1", "P2"  (wajib)
 * - kolom: kolom sensor misal "sensor8" (wajib)
 * - tgl: tanggal YYYY-MM-DD (untuk type=hari)
 * - bulan: YYYY-MM (untuk type=bulan)
 * - tahun: YYYY (untuk type=tahun)
 * - dari: datetime awal (untuk type=range)
 * - sampai: datetime akhir (untuk type=range)
 * - id_logger: (optional) override logger ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const id_prisma = searchParams.get("id_prisma");
    const kolom = searchParams.get("kolom");
    const tgl = searchParams.get("tgl") ?? searchParams.get("tanggal");
    const bulan = searchParams.get("bulan");
    const tahun = searchParams.get("tahun");
    const dari = searchParams.get("dari");
    const sampai = searchParams.get("sampai");

    // Validasi
    if (!type || !id_prisma || !kolom) {
      return NextResponse.json(
        { success: false, error: "Parameter type, id_prisma, kolom wajib diisi" },
        { status: 400 }
      );
    }

    // Cek kolom aman (whitelist)
    const allowedKolom = ["sensor8", "sensor9", "sensor10"];
    if (!allowedKolom.includes(kolom)) {
      return NextResponse.json(
        { success: false, error: "kolom tidak valid. Gunakan sensor8, sensor9, atau sensor10" },
        { status: 400 }
      );
    }

    // Ambil id_logger dari DB
    let id_logger = searchParams.get("id_logger");
    if (!id_logger) {
      const loggers = await prisma.$queryRaw<Array<{ id_logger: string }>>`
        SELECT id_logger FROM t_logger WHERE kategori_log = '1' LIMIT 1
      `;
      id_logger = loggers?.[0]?.id_logger ?? null;
    }

    // Ambil nama parameter untuk label
    const paramRows = await prisma.$queryRaw<Array<{ nama_parameter: string; satuan: string }>>`
      SELECT nama_parameter, satuan FROM parameter_prisma
      WHERE id_prisma = ${id_prisma} AND kolom_sensor = ${kolom}
      LIMIT 1
    `;
    const namaParameter = paramRows?.[0]?.nama_parameter ?? kolom;
    const satuan = paramRows?.[0]?.satuan ?? "";

    console.log("[analisa] id_prisma:", id_prisma, "kolom:", kolom, "type:", type);

    // Skip slow baseline query - not critical for chart display
    const firstRun = null;

    // ===== BUILD QUERY BERDASARKAN TYPE =====
    let rawData: Array<Record<string, unknown>> = [];

    if (type === "hari") {
      const tanggal = tgl ?? new Date().toISOString().split("T")[0];
      rawData = await prisma.$queryRawUnsafe(
        `SELECT waktu, ${kolom} as nilai
         FROM rts
         WHERE sensor1 = ? AND waktu >= ? AND waktu <= ?
         ORDER BY waktu ASC
         LIMIT 500`,
        id_prisma,
        `${tanggal} 00:00:00`,
        `${tanggal} 23:59:59`
      ) as Array<Record<string, unknown>>;

    } else if (type === "bulan") {
      const bulanVal = bulan ?? new Date().toISOString().slice(0, 7);
      rawData = await prisma.$queryRawUnsafe(
        `SELECT waktu, ${kolom} as nilai
         FROM rts
         WHERE sensor1 = ? AND waktu >= ? AND waktu <= ?
         ORDER BY waktu ASC
         LIMIT 500`,
        id_prisma,
        `${bulanVal}-01 00:00:00`,
        `${bulanVal}-31 23:59:59`
      ) as Array<Record<string, unknown>>;

    } else if (type === "tahun") {
      const tahunVal = tahun ?? new Date().getFullYear().toString();
      rawData = await prisma.$queryRawUnsafe(
        `SELECT waktu, ${kolom} as nilai
         FROM rts
         WHERE sensor1 = ? AND waktu >= ? AND waktu <= ?
         ORDER BY waktu ASC
         LIMIT 500`,
        id_prisma,
        `${tahunVal}-01-01 00:00:00`,
        `${tahunVal}-12-31 23:59:59`
      ) as Array<Record<string, unknown>>;

    } else if (type === "range") {
      if (!dari || !sampai) {
        return NextResponse.json(
          { success: false, error: "Parameter dari dan sampai wajib untuk type=range" },
          { status: 400 }
        );
      }

      // Hitung jumlah hari dalam range
      const dariDate = new Date(dari);
      const sampaiDate = new Date(sampai);
      const diffDays = Math.ceil(Math.abs(sampaiDate.getTime() - dariDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays > 2) {
        // Multi-hari: group per jam agar chart tidak terlalu padat
        rawData = await prisma.$queryRawUnsafe(
          `SELECT 
             DATE_FORMAT(waktu, '%Y-%m-%d %H:00:00') as waktu_jam,
             AVG(CAST(${kolom} AS DECIMAL(20,6))) as nilai_avg
           FROM rts
           WHERE sensor1 = ? AND waktu >= ? AND waktu <= ?
           GROUP BY waktu_jam
           ORDER BY waktu_jam ASC
           LIMIT 500`,
          id_prisma,
          dari,
          sampai
        ) as Array<Record<string, unknown>>;

        // Rename fields to match expected format
        rawData = rawData.map(r => ({
          waktu: r.waktu_jam,
          nilai: r.nilai_avg,
        }));
      } else {
        // 1-2 hari: tampilkan semua data point
        rawData = await prisma.$queryRawUnsafe(
          `SELECT waktu, ${kolom} as nilai
           FROM rts
           WHERE sensor1 = ? AND waktu >= ? AND waktu <= ?
           ORDER BY waktu ASC
           LIMIT 500`,
          id_prisma,
          dari,
          sampai
        ) as Array<Record<string, unknown>>;
      }

    } else {
      return NextResponse.json(
        { success: false, error: "type tidak valid. Gunakan: hari, bulan, tahun, range" },
        { status: 400 }
      );
    }

    // Format data untuk charting (Highcharts / Chart.js)
    const chartData = rawData.map((d) => {
      const waktu = new Date(d.waktu as string);
      return {
        timestamp: waktu.getTime(),
        waktu: d.waktu,
        nilai: d.nilai !== null ? parseFloat(String(d.nilai)) : null,
      };
    });

    // Tabel data
    const tabelData = rawData.map((d) => ({
      waktu: d.waktu,
      nilai: d.nilai !== null ? parseFloat(Number(d.nilai).toFixed(4)) : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        id_prisma,
        id_logger,
        kolom,
        nama_parameter: namaParameter,
        satuan,
        type,
        first_run: firstRun,
        chart_data: chartData,
        tabel_data: tabelData,
      },
    });
  } catch (error) {
    console.error("[GET /api/analisa]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch analisa data" },
      { status: 500 }
    );
  }
}
