import type { PengukuranRow } from "@/components/monitoring/derive";

/**
 * Berkas Excel "Hasil Penembakan RTS".
 *
 * Bentuknya SENGAJA dipertahankan persis seperti versi sebelumnya — judul
 * gabungan, dua baris kepala kolom dengan merge, 19 kolom dalam METER, dan
 * lima baris teratas dibekukan. Berkas ini dipakai sebagai lampiran laporan,
 * jadi perubahan kolom atau satuannya akan merusak dokumen yang sudah beredar.
 *
 * ExcelJS di-import dinamis: pustakanya besar dan hanya dibutuhkan saat operator
 * benar-benar menekan Unduh.
 */
export async function buatExcelHasilPengukuran({
  rows,
  namaSite,
  tanggal,
}: {
  rows: PengukuranRow[];
  /** Nama site untuk judul, mis. "CPP 3". */
  namaSite: string;
  /** Tanggal sesi yang sudah diformat, mis. "21-11-2025 10:11". */
  tanggal: string;
}): Promise<Blob> {
  const ExcelJS = await import("exceljs").then((m) => m.default || m);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Hasil Pengukuran");

  sheet.columns = [
    { key: "no", width: 15 },
    { key: "nama", width: 15 },
    { key: "x0", width: 12 },
    { key: "y0", width: 12 },
    { key: "z0", width: 10 },
    { key: "ha0", width: 11 },
    { key: "va0", width: 11 },
    { key: "sd0", width: 10 },
    { key: "x1", width: 12 },
    { key: "y1", width: 12 },
    { key: "z1", width: 10 },
    { key: "ha1", width: 11 },
    { key: "va1", width: 11 },
    { key: "sd1", width: 10 },
    { key: "dx", width: 8 },
    { key: "dy", width: 8 },
    { key: "dz", width: 8 },
    { key: "lin", width: 10 },
    { key: "arah", width: 16 },
  ];

  const titleRow = sheet.addRow([`Hasil Penembakan RTS ${namaSite} PT MIP`]);
  sheet.mergeCells("A1:S1");
  titleRow.getCell(1).font = { size: 14, bold: true };
  titleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

  const dateRow = sheet.addRow([`Tanggal : ${tanggal}`]);
  sheet.mergeCells("A2:S2");
  dateRow.getCell(1).font = { size: 11 };
  dateRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

  sheet.addRow([]);

  sheet.addRow([
    "Nomor Prisma",
    "Nama Prisma",
    "Awal Pengukuran",
    "",
    "",
    "",
    "",
    "",
    "Hasil Pengukuran",
    "",
    "",
    "",
    "",
    "",
    "Pergeseran",
    "",
    "",
    "",
    "Arah Pergeseran",
  ]);
  sheet.mergeCells("A4:A5");
  sheet.mergeCells("B4:B5");
  sheet.mergeCells("C4:H4");
  sheet.mergeCells("I4:N4");
  sheet.mergeCells("O4:R4");
  sheet.mergeCells("S4:S5");

  sheet.addRow([
    "",
    "",
    "X",
    "Y",
    "Z",
    "HA",
    "VA",
    "Slop Dis",
    "X",
    "Y",
    "Z",
    "HA",
    "VA",
    "Slop Dis",
    "ΔX",
    "ΔY",
    "ΔZ",
    "Linear",
    "",
  ]);

  // Border & tebal pada seluruh area kepala, termasuk sel hasil merge —
  // eachCell() melewatkan sel yang di-merge, jadi ditulis per koordinat.
  for (let R = 4; R <= 5; R++) {
    for (let C = 1; C <= 19; C++) {
      const cell = sheet.getCell(R, C);
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }
  }

  const angka = (v: unknown) => Number(v || 0);
  const teks = (v: unknown) => (v === null || v === undefined || v === "" ? "-" : String(v));

  for (const row of rows) {
    const t = row.temp_tembak ?? {};
    const dataRow = sheet.addRow([
      row.id_prisma,
      row.nama_prisma || "-",
      angka(t.E0),
      angka(t.N0),
      angka(t.Z0),
      teks(t.HA0),
      teks(t.VA0),
      teks(t.SD0),
      angka(t.E1),
      angka(t.N1),
      angka(t.Z1),
      teks(t.HA1),
      teks(t.VA1),
      teks(t.SD1),
      angka(t.DE),
      angka(t.DN),
      angka(t.DZ),
      angka(t.linear),
      teks(t.arah_pergeseran),
    ]);

    dataRow.eachCell((cell) => {
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  }

  sheet.views = [{ state: "frozen", ySplit: 5 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Nama berkas: "Hasil_Pengukuran_21_11_2025_10_11.xlsx". */
export function namaBerkasExcel(tanggal: string): string {
  return `Hasil_Pengukuran_${tanggal.replace(/[\s:-]/g, "_")}.xlsx`;
}
