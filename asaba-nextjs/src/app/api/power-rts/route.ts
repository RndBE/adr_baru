import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PARAM_TO_SENSOR: Record<string, string> = {
  power_rts: "sensor23",
  humidity: "sensor20",
  battery: "sensor21",
  temperature: "sensor22",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date"); // Format YYYY-MM-DD
    const param = searchParams.get("param") || "power_rts";
    const loggerId = searchParams.get("logger") || "30002";

    if (!date) {
      return NextResponse.json(
        { success: false, error: "Parameter date wajib diisi (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const sensorCol = PARAM_TO_SENSOR[param];
    if (!sensorCol) {
      return NextResponse.json(
        { success: false, error: "Parameter tidak valid" },
        { status: 400 }
      );
    }

    // Ambil data mentah dari tabel rts pada tanggal yang dipilih
    // Kita langsung select waktu dan kolom sensor tujuan menggunakan raw query
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT waktu, ${sensorCol} as val FROM rts WHERE code_logger = ? AND DATE(waktu) = ? ORDER BY waktu ASC`,
      loggerId,
      date
    );

    // Siapkan wadah untuk 24 jam (00:00 sampai 23:00)
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      waktu: `${String(i).padStart(2, "0")}:00`,
      values: [] as number[],
    }));

    // Masukkan tiap baris data ke kelompok jamnya
    for (const row of rows) {
      const valStr = String(row.val).trim();
      if (!valStr || isNaN(Number(valStr))) continue;
      
      const val = Number(valStr);
      const dt = new Date(row.waktu);
      
      const hour = dt.getHours(); 
      if (hour >= 0 && hour < 24) {
        hourlyData[hour].values.push(val);
      }
    }

    // Hitung Rerata, Min, dan Maks untuk tiap jam (hanya untuk jam yang ada datanya)
    const finalData = hourlyData
      .filter((h) => h.values.length > 0)
      .map((h) => {
        const vals = h.values;
        const min = Math.min(...vals);
        const maks = Math.max(...vals);
        const rerata = vals.reduce((a, b) => a + b, 0) / vals.length;
        
        return {
          waktu: h.waktu,
          rerata: Number(rerata.toFixed(2)),
          min: Number(min.toFixed(2)),
          maks: Number(maks.toFixed(2)),
        };
      });

    return NextResponse.json({
      success: true,
      data: finalData,
    });
  } catch (error) {
    console.error("[GET /api/power-rts]", error);
    return NextResponse.json(
      { success: false, error: "Gagal memproses data", detail: String(error) },
      { status: 500 }
    );
  }
}
