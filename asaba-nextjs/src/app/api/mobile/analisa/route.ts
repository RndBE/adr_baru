import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function serializeBigInt(obj: unknown): unknown {
  if (typeof obj === "bigint") return Number(obj);
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, serializeBigInt(v)])
    );
  }
  return obj;
}

/**
 * GET /api/mobile/analisa
 * Setara CI3 Api::analisapertanggal/bulan/range/tahun()
 * Query params:
 *   mode: "tanggal" | "bulan" | "range" | "tahun"
 *   idlogger, idsensor, tabel
 *   tanggal (YYYY-MM-DD for tanggal, YYYY-MM for bulan, YYYY for tahun)
 *   awal, akhir (for range mode)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "tanggal";
    const idlogger = searchParams.get("idlogger") || "";
    const idsensor = searchParams.get("idsensor") || "";
    const tabel = searchParams.get("tabel") || "rts";
    const tanggal = searchParams.get("tanggal") || "";
    const awal = searchParams.get("awal") || "";
    const akhir = searchParams.get("akhir") || "";

    if (!idlogger || !idsensor) {
      return NextResponse.json(
        { success: false, error: "idlogger dan idsensor wajib diisi" },
        { status: 400 }
      );
    }

    // Get parameter info
    const params = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM parameter_sensor WHERE id_param = ${idsensor} LIMIT 1
    `;
    const param = params?.[0];
    if (!param) {
      return NextResponse.json({ status: "error", data: null });
    }

    const kolomSensor = String(param.kolom_sensor || "sensor1");
    const namaParameter = String(param.nama_parameter || "");
    const satuan = String(param.satuan || "");
    const tipeGraf = String(param.tipe_graf || "line");

    // Determine aggregate type
    let sensor = kolomSensor;
    let namaSensor: string;
    let selectExpr: string;

    if (namaParameter === "Debit") {
      sensor = String(param.kolom_acuan || kolomSensor);
      namaSensor = `Rerata_${namaParameter}`;
      selectExpr = `AVG(${sensor}) as data_val`;
    } else if (tipeGraf === "column" || (tabel === "t_klimatologi" && kolomSensor === "sensor8") || (tabel === "arr" && kolomSensor === "sensor9")) {
      namaSensor = `Akumulasi_${namaParameter}`;
      selectExpr = `SUM(${sensor}) as data_val`;
    } else {
      namaSensor = `Rerata_${namaParameter}`;
      selectExpr = `AVG(${sensor}) as data_val`;
    }

    // Build query based on mode
    let sql = "";
    const queryParams: string[] = [idlogger];

    switch (mode) {
      case "tanggal":
        sql = `SELECT waktu, ${selectExpr}, MIN(${sensor}) as min_val, MAX(${sensor}) as max_val
               FROM ${tabel} WHERE code_logger = ?
               AND waktu >= ? AND waktu <= ?
               GROUP BY HOUR(waktu), DAY(waktu), MONTH(waktu), YEAR(waktu)`;
        queryParams.push(`${tanggal} 00:00`, `${tanggal} 23:59`);
        break;

      case "bulan":
        sql = `SELECT waktu, DATE(waktu) as tanggal, ${selectExpr}, MIN(${sensor}) as min_val, MAX(${sensor}) as max_val
               FROM ${tabel} WHERE code_logger = ?
               AND waktu >= ? AND waktu <= ?
               GROUP BY DAY(waktu), MONTH(waktu), YEAR(waktu)`;
        queryParams.push(`${tanggal}-01 00:00`, `${tanggal}-31 23:59`);
        break;

      case "range":
        sql = `SELECT waktu, DATE(waktu) as tanggal, ${selectExpr}, MIN(${sensor}) as min_val, MAX(${sensor}) as max_val
               FROM ${tabel} WHERE code_logger = ?
               AND waktu >= ? AND waktu <= ?
               GROUP BY HOUR(waktu), DAY(waktu), MONTH(waktu), YEAR(waktu)
               ORDER BY waktu ASC`;
        queryParams.push(awal, `${akhir} 23:59:00`);
        break;

      case "tahun":
        sql = `SELECT waktu, DATE(waktu) as tanggal, MONTH(waktu) as bulan, ${selectExpr}, MIN(${sensor}) as min_val, MAX(${sensor}) as max_val
               FROM ${tabel} WHERE code_logger = ?
               AND waktu >= ? AND waktu <= ?
               GROUP BY MONTH(waktu), YEAR(waktu)`;
        queryParams.push(`${tanggal}-01-01 00:00`, `${tanggal}-12-31 23:59`);
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Mode '${mode}' tidak dikenali` },
          { status: 400 }
        );
    }

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...queryParams);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ status: "error", data: null });
    }

    const waktuArr: string[] = [];
    const dataArr: string[] = [];
    const minArr: string[] = [];
    const maxArr: string[] = [];

    for (const row of rows) {
      let val = Number(row.data_val || 0);
      let minV = Number(row.min_val || 0);
      let maxV = Number(row.max_val || 0);

      if (namaParameter === "Illumination") {
        val /= 1000;
        minV /= 1000;
        maxV /= 1000;
      }

      // Format waktu based on mode
      const w = row.waktu ? new Date(String(row.waktu)) : new Date();
      let wStr: string;
      if (mode === "tanggal" || mode === "range") {
        wStr = w.toISOString().slice(0, 13).replace("T", " ") + ":00";
      } else if (mode === "bulan") {
        wStr = w.toISOString().slice(0, 10);
      } else {
        wStr = w.toISOString().slice(0, 7);
      }

      waktuArr.push(wStr);
      dataArr.push(val.toFixed(2));
      minArr.push(minV.toFixed(2));
      maxArr.push(maxV.toFixed(2));
    }

    return NextResponse.json(serializeBigInt({
      status: "sukses",
      data: {
        status: "sukses",
        idLogger: idlogger,
        nosensor: sensor,
        namaSensor,
        satuan,
        waktu: waktuArr,
        tipegraf: tipeGraf,
        data: dataArr,
        datamin: minArr,
        datamax: maxArr,
      },
    }));
  } catch (error) {
    console.error("[GET /api/mobile/analisa]", error);
    return NextResponse.json(
      { status: "error", data: null, error: String(error) },
      { status: 500 }
    );
  }
}
