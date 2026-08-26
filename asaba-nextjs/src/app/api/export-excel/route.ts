import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSite } from "@/lib/sites";
import ExcelJS from "exceljs";

function nfloat(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const s = String(v).replace(/,/g, ".").replace(/[^0-9.\-]/g, "");
  if (!s || s === "-" || s === "." || s === "-.") return 0;
  return parseFloat(s) || 0;
}

function fmt(v: number, d = 3): string {
  return v.toFixed(d);
}

function arah8ID(DE: number, DN: number) {
  let deg = (Math.atan2(DE, DN) * 180) / Math.PI;
  deg = ((deg % 360) + 360) % 360;
  const dirs = ["Utara", "Timur Laut", "Timur", "Tenggara", "Selatan", "Barat Daya", "Barat", "Barat Laut"];
  const index = Math.floor(((deg + 22.5) / 45) % 8);
  return { bearing: fmt(deg, 2), arah_id: dirs[index] };
}

/**
 * POST /api/export-excel
 * Setara CI3 Beranda::export_excel()
 * Body: { id_log: string, site?: string }
 * Returns: .xlsx file download
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id_log, site = "unknown" } = body;
    // Judul dan nama file pakai nama resmi site dari master data, bukan slug mentah.
    const siteConfig = await getSite(site);
    const siteName = siteConfig.nama;

    if (!id_log) {
      return NextResponse.json(
        { success: false, error: "id_log wajib diisi" },
        { status: 400 }
      );
    }

    // Get log info
    const logRows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM log_kontrol WHERE id_log = ${id_log} LIMIT 1
    `;
    const log = logRows?.[0];
    if (!log) {
      return NextResponse.json(
        { success: false, error: "id_log tidak ditemukan" },
        { status: 404 }
      );
    }

    const datetime = log.datetime ? String(log.datetime) : new Date().toISOString();

    // Get R0 (first measurement)
    const r0Rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT id_log FROM log_kontrol WHERE site = ${site} AND r0 = '1' LIMIT 1
    `;
    const logFirst = r0Rows?.[0]?.id_log || id_log;

    // Prisma milik site ini saja. Sebelumnya query ini tanpa filter sama sekali,
    // sehingga file ekspor satu site ikut memuat baris prisma site lain.
    const prisms = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT t_prisma.*, temp_prisma.N1, temp_prisma.E1, temp_prisma.Z1,
             temp_prisma.N0, temp_prisma.E0, temp_prisma.Z0, temp_prisma.status_get
      FROM t_prisma
      LEFT JOIN temp_prisma
        ON temp_prisma.id_prisma = t_prisma.id_prisma
       AND temp_prisma.site = t_prisma.site
      WHERE t_prisma.site = ${siteConfig.slug}
      ORDER BY t_prisma.id_prisma
    `;

    // Build measurement data
    const measurements: Array<Record<string, unknown>> = [];

    for (const p of prisms) {
      const id_prisma = String(p.id_prisma || "");
      if (!id_prisma) continue;

      // Current measurement
      const current = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM rts WHERE id_kontrol = ${id_log} AND sensor1 = ${id_prisma} LIMIT 1
      `;
      // First measurement
      const first = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM rts WHERE id_kontrol = ${logFirst} AND sensor1 = ${id_prisma} ORDER BY waktu ASC LIMIT 1
      `;

      if (!current?.[0] || !first?.[0]) continue;

      const c = current[0];
      const f = first[0];

      const N1 = nfloat(c.sensor8), E1 = nfloat(c.sensor9), Z1 = nfloat(c.sensor10);
      const N0 = nfloat(f.sensor8), E0 = nfloat(f.sensor9), Z0 = nfloat(f.sensor10);

      let DN = 0, DE = 0, DZ = 0, linear = 0;
      if ((N1 !== 0 || E1 !== 0 || Z1 !== 0) && (N0 !== 0 || E0 !== 0 || Z0 !== 0)) {
        DN = N1 - N0;
        DE = E1 - E0;
        DZ = Z1 - Z0;
        linear = Math.sqrt(DE * DE + DN * DN);
      }

      const arah = linear > 0 ? `${arah8ID(DE, DN).bearing} (${arah8ID(DE, DN).arah_id})` : "-";
      const nama = c.sensor3 || p.nama_prisma || p.nama || "";

      measurements.push({
        id_prisma, nama,
        E0, N0, Z0,
        HA0: f.sensor5 || "", VA0: f.sensor6 || "", SD0: f.sensor7 || "",
        E1, N1, Z1,
        HA1: c.sensor5 || "", VA1: c.sensor6 || "", SD1: c.sensor7 || "",
        DE: fmt(DE, 6), DN: fmt(DN, 6), DZ: fmt(DZ, 6),
        linear, arah,
      });
    }

    // Generate Excel
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Beacon Engineering";
    const sheet = workbook.addWorksheet("Hasil Pengukuran");

    // Title
    sheet.mergeCells("A1:S1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = `Hasil Penembakan RTS ${siteName} PT MIP`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 30;

    sheet.mergeCells("A2:S2");
    const dateCell = sheet.getCell("A2");
    dateCell.value = `Tanggal : ${datetime}`;
    dateCell.font = { size: 12 };
    dateCell.alignment = { horizontal: "center" };

    // Headers row 5-6
    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } },
      border: {
        top: { style: "thin" }, bottom: { style: "thin" },
        left: { style: "thin" }, right: { style: "thin" },
      },
      alignment: { horizontal: "center", vertical: "middle" },
    };

    // Row 5 merged headers
    const merges: [string, string, string][] = [
      ["A5:A6", "Nomor Prisma", "A"],
      ["B5:B6", "Nama Prisma", "B"],
      ["S5:S6", "Arah Pergeseran", "S"],
    ];
    for (const [range, label, col] of merges) {
      sheet.mergeCells(range);
      const cell = sheet.getCell(`${col}5`);
      cell.value = label;
      cell.style = headerStyle;
    }

    sheet.mergeCells("C5:H5");
    sheet.getCell("C5").value = "Awal Pengukuran";
    sheet.getCell("C5").style = headerStyle;

    sheet.mergeCells("I5:N5");
    sheet.getCell("I5").value = "Hasil Pengukuran";
    sheet.getCell("I5").style = headerStyle;

    sheet.mergeCells("O5:R5");
    sheet.getCell("O5").value = "Pergeseran";
    sheet.getCell("O5").style = headerStyle;

    // Row 6 sub-headers
    const subHeaders = ["", "", "X", "Y", "Z", "HA", "VA", "Slop Dis", "X", "Y", "Z", "HA", "VA", "Slop Dis", "ΔX", "ΔY", "ΔZ", "Linear", ""];
    const cols = "ABCDEFGHIJKLMNOPQRS".split("");
    for (let i = 0; i < cols.length; i++) {
      const cell = sheet.getCell(`${cols[i]}6`);
      if (subHeaders[i]) cell.value = subHeaders[i];
      cell.style = headerStyle;
    }

    sheet.getRow(5).height = 22;
    sheet.getRow(6).height = 22;
    sheet.getColumn("A").width = 13;
    sheet.getColumn("B").width = 15;
    sheet.getColumn("S").width = 15;

    // Data rows
    const dataStyle: Partial<ExcelJS.Style> = {
      border: {
        top: { style: "thin" }, bottom: { style: "thin" },
        left: { style: "thin" }, right: { style: "thin" },
      },
      alignment: { horizontal: "center" },
    };

    measurements.forEach((m, idx) => {
      const row = idx + 7;
      const vals = [
        m.id_prisma, m.nama,
        m.E0, m.N0, m.Z0, m.HA0, m.VA0, m.SD0,
        m.E1, m.N1, m.Z1, m.HA1, m.VA1, m.SD1,
        m.DE, m.DN, m.DZ, m.linear, m.arah,
      ];
      for (let i = 0; i < cols.length; i++) {
        const cell = sheet.getCell(`${cols[i]}${row}`);
        cell.value = vals[i] != null ? (typeof vals[i] === "number" ? vals[i] as number : String(vals[i])) : "";
        cell.style = dataStyle;
      }
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `Hasil_Penembakan_RTS_${siteConfig.slug}_${datetime.replace(/[: ]/g, "_")}.xlsx`;

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[POST /api/export-excel]", error);
    return NextResponse.json(
      { success: false, error: "Failed to export Excel" },
      { status: 500 }
    );
  }
}
