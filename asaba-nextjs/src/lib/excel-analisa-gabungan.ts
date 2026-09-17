import type { GrafikPng } from "@/lib/grafik-ke-png";
import type {
  BasisGabungan,
  RingkasanGabungan,
  SeriGabungan,
} from "@/components/monitoring/gabungan";

/**
 * Berkas Excel halaman Analisa Gabungan.
 *
 * Empat lembar, dan pembagiannya punya alasan:
 *
 *   Ringkasan   — angka kelompok beserta kalimat bacaannya, supaya berkas ini
 *                 bisa dibaca sendirian tanpa membuka aplikasi.
 *   Grafik      — grafik gabungan sebagai GAMBAR. ExcelJS 4.4 tidak punya
 *                 addChart sama sekali; yang ada hanya addImage. Gambar itu
 *                 tidak ikut berubah kalau angkanya disunting.
 *   Deret waktu — justru karena grafiknya cuma gambar, deret angkanya ikut
 *                 penuh di sini: satu kolom per prisma plus rata-ratanya, siap
 *                 disorot lalu dibuat grafik Excel yang sungguhan.
 *   Per prisma  — sumbangan tiap prisma terhadap angka kelompok.
 *
 * ExcelJS di-import dinamis: pustakanya besar dan hanya dibutuhkan saat
 * operator benar-benar menekan Unduh.
 */

const BORDER = {
  top: { style: "thin" as const },
  left: { style: "thin" as const },
  bottom: { style: "thin" as const },
  right: { style: "thin" as const },
};

export interface IsiExcelGabungan {
  namaSite: string;
  /** "17/09/2026 06:00 – 17/09/2026 12:59". */
  rentangTeks: string;
  basis: BasisGabungan;
  labelBasis: string;
  /** Tanggal sesi acuan R0; null bila belum ketemu. */
  r0Teks: string | null;
  perJam: boolean;
  hasil: RingkasanGabungan;
  seri: SeriGabungan;
  bacaan: { judul: string; teks: string };
  /** Null bila grafiknya belum tergambar saat Unduh ditekan. */
  grafik: GrafikPng | null;
  /** Stempel tiap baris deret, sudah diformat jam dinding WIB. */
  waktuBaris: string[];
}

export async function buatExcelAnalisaGabungan(isi: IsiExcelGabungan): Promise<Blob> {
  const ExcelJS = await import("exceljs").then((m) => m.default || m);
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  const { hasil, seri, basis } = isi;
  const akhir = basis === "akhir";
  const kataBesar = akhir ? "Pergeseran" : "Gerak";

  // ── Lembar 1: Ringkasan ───────────────────────────────────────────────────
  const s1 = wb.addWorksheet("Ringkasan");
  s1.columns = [{ width: 30 }, { width: 22 }, { width: 58 }];

  const judul = s1.addRow([`Analisa Gabungan Prisma — ${isi.namaSite}`]);
  s1.mergeCells("A1:C1");
  judul.getCell(1).font = { size: 14, bold: true };
  judul.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

  const sub = s1.addRow([isi.rentangTeks]);
  s1.mergeCells("A2:C2");
  sub.getCell(1).font = { size: 11 };
  sub.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  s1.addRow([]);

  const meta: [string, string][] = [
    ["Dasar perhitungan", isi.labelBasis],
    ["Acuan R0", isi.r0Teks ?? "belum ada sesi acuan"],
    ["Prisma digabung", `${hasil.dipakai.length} prisma`],
    [
      "Tidak ikut dihitung",
      hasil.diabaikan.length
        ? `${hasil.diabaikan.length} — ${hasil.diabaikan.map((n) => n.replace(/_/g, " ")).join(", ")}`
        : "tidak ada",
    ],
    ["Pembacaan", isi.perJam ? "dirata-rata per jam" : "tiap pembacaan"],
  ];
  for (const [k, v] of meta) {
    const r = s1.addRow([k, v]);
    s1.mergeCells(`B${r.number}:C${r.number}`);
    r.getCell(1).font = { bold: true };
    r.getCell(1).alignment = { vertical: "middle" };
    r.getCell(2).alignment = { vertical: "middle", wrapText: true };
  }
  s1.addRow([]);

  const rBacaan = s1.addRow([isi.bacaan.judul]);
  s1.mergeCells(`A${rBacaan.number}:C${rBacaan.number}`);
  rBacaan.getCell(1).font = { size: 12, bold: true };
  const rTeks = s1.addRow([isi.bacaan.teks]);
  s1.mergeCells(`A${rTeks.number}:C${rTeks.number}`);
  rTeks.getCell(1).alignment = { wrapText: true, vertical: "top" };
  rTeks.height = 46;
  s1.addRow([]);

  const kepala = s1.addRow(["Besaran", "Nilai", "Keterangan"]);
  for (let c = 1; c <= 3; c++) {
    const cell = kepala.getCell(c);
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = BORDER;
  }

  /** Angka ditulis sebagai ANGKA, bukan teks — supaya bisa dihitung ulang. */
  const baris = (label: string, nilai: number | string | null, fmt: string, ket: string) => {
    const r = s1.addRow([label, nilai === null ? "—" : nilai, ket]);
    if (typeof nilai === "number") r.getCell(2).numFmt = fmt;
    r.getCell(2).alignment = { horizontal: "right" };
    r.getCell(3).alignment = { wrapText: true, vertical: "middle" };
    for (let c = 1; c <= 3; c++) r.getCell(c).border = BORDER;
    return r;
  };

  baris(`${kataBesar} resultan`, hasil.vektorRata.besarMm, "0.00", "mm — panjang vektor rata-rata kelompok");
  baris("Arah resultan", hasil.vektorRata.bearing, "0.0", "derajat dari utara, searah jarum jam");
  baris(
    "Keseragaman arah",
    hasil.keseragaman,
    "0%",
    "1 = semua prisma searah; 0 = arahnya saling meniadakan, dan resultan di atas tidak mewakili apa pun"
  );
  baris("Simpangan arah", hasil.simpangArahDeg, "0.0", "derajat — sebaran arah yang setara dengan keseragaman di atas");
  baris(`${kataBesar} terbesar`, hasil.sebaran.maksMm, "0.00", "mm");
  baris(`${kataBesar} median`, hasil.sebaran.medianMm, "0.00", "mm");
  baris(`${kataBesar} terkecil`, hasil.sebaran.minMm, "0.00", "mm");
  baris("Sebaran besar", hasil.sebaran.sdMm, "0.00", "mm — simpangan baku");
  baris(
    "Beda gerak antar prisma",
    hasil.diferensialMm,
    "0.00",
    "mm — pasangan prisma yang paling berbeda. Nol berarti kelompok bergerak utuh"
  );
  baris("Kecepatan rata-rata", hasil.lajuRataMmd, "0.00", "mm/hari");
  baris("Kecepatan tertinggi", hasil.lajuMaksMmd, "0.00", "mm/hari");
  baris(
    "Status terburuk",
    akhir ? (hasil.status ?? "—") : "—",
    "@",
    akhir
      ? "tingkat pergeseran terhadap ambang site"
      : "ambang pergeseran TIDAK dipakai pada basis ini — ambang itu untuk jarak total dari R0, bukan untuk gerak dalam satu rentang. Lihat kolom Status laju di lembar Per prisma"
  );

  s1.addRow([]);
  const catatan = s1.addRow([
    "Angka gabungan di berkas ini alat bantu baca pola, bukan dasar penilaian bahaya. Penilaian tetap per prisma terhadap ambang site, dan itulah yang dipakai peringatan.",
  ]);
  s1.mergeCells(`A${catatan.number}:C${catatan.number}`);
  catatan.getCell(1).alignment = { wrapText: true, vertical: "top" };
  catatan.getCell(1).font = { italic: true, size: 10 };
  catatan.height = 32;

  // ── Lembar 2: Grafik ──────────────────────────────────────────────────────
  const s2 = wb.addWorksheet("Grafik");
  s2.columns = [{ width: 120 }];
  const j2 = s2.addRow([`Grafik gabungan — ${isi.namaSite}`]);
  j2.getCell(1).font = { size: 13, bold: true };
  s2.addRow([isi.rentangTeks]);
  s2.addRow([
    akhir
      ? "Sumbu tegak: jarak tiap prisma dari acuan R0, milimeter."
      : "Sumbu tegak: gerak tiap prisma dari posisinya sendiri di awal rentang, milimeter.",
  ]);
  s2.addRow(["Garis tebal gelap adalah rata-rata kelompok."]);

  if (isi.grafik) {
    const id = wb.addImage({ base64: isi.grafik.dataUrl, extension: "png" });
    s2.addImage(id, {
      tl: { col: 0, row: 5 },
      ext: { width: isi.grafik.lebar, height: isi.grafik.tinggi },
    });
    s2.addRow([]);
    // Baris kosong setinggi gambar supaya catatan di bawah tidak tertimpa.
    const sisip = Math.ceil(isi.grafik.tinggi / 20) + 2;
    for (let i = 0; i < sisip; i++) s2.addRow([]);
    const ket = s2.addRow([
      "Grafik ini GAMBAR, bukan grafik Excel: ia tidak ikut berubah kalau angkanya disunting. Deret angkanya ada di lembar \"Deret waktu\" — sorot kolomnya lalu Insert > Chart untuk membuat grafik Excel yang hidup.",
    ]);
    ket.getCell(1).alignment = { wrapText: true, vertical: "top" };
    ket.getCell(1).font = { italic: true, size: 10 };
    ket.height = 32;
  } else {
    const kosong = s2.addRow([
      "Grafik tidak ikut terekam — saat Unduh ditekan grafiknya belum tergambar di layar. Deret angkanya tetap lengkap di lembar \"Deret waktu\".",
    ]);
    kosong.getCell(1).alignment = { wrapText: true };
    kosong.getCell(1).font = { italic: true };
  }

  // ── Lembar 3: Deret waktu ─────────────────────────────────────────────────
  const s3 = wb.addWorksheet("Deret waktu");
  s3.columns = [
    { width: 20 },
    ...seri.prisma.map(() => ({ width: 14 })),
    { width: 14 },
    { width: 14 },
  ];
  const k3 = s3.addRow([
    "Waktu",
    ...seri.prisma.map((p) => p.nama.replace(/_/g, " ")),
    "Rata-rata",
    "Prisma terbaca",
  ]);
  k3.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = BORDER;
  });

  seri.baris.forEach((b, i) => {
    // Waktu ditulis sebagai TEKS, bukan tanggal Excel. Stempel di basis data
    // adalah jam dinding WIB tanpa zona; menuliskannya sebagai tanggal membuat
    // Excel dan penampilnya bebas menafsirkan ulang zonanya, dan jam yang
    // bergeser tujuh jam di lampiran laporan lebih buruk daripada teks polos.
    const r = s3.addRow([
      isi.waktuBaris[i] ?? "",
      ...seri.prisma.map((p) => {
        const v = b[p.kunci];
        return typeof v === "number" ? v : null;
      }),
      b.rata,
      b.jumlah,
    ]);
    r.eachCell((cell, c) => {
      if (c > 1) cell.numFmt = c === seri.prisma.length + 3 ? "0" : "0.00";
      cell.alignment = { horizontal: c === 1 ? "left" : "right" };
      cell.border = BORDER;
    });
  });

  s3.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];

  if (seri.tidakLengkap > 0) {
    s3.addRow([]);
    const p = s3.addRow([
      `${seri.tidakLengkap} dari ${seri.baris.length} baris tidak memuat seluruh prisma terpilih (lihat kolom "Prisma terbaca"). Rata-rata pada baris itu dihitung dari prisma yang terbaca saja, jadi lompatannya bisa berasal dari anggotanya yang berubah — bukan dari gerakan.`,
    ]);
    p.getCell(1).font = { italic: true, size: 10 };
  }

  // ── Lembar 4: Per prisma ──────────────────────────────────────────────────
  const s4 = wb.addWorksheet("Per prisma");
  s4.columns = [
    { width: 18 },
    { width: 16 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
  ];
  const k4 = s4.addRow([
    "Prisma",
    `${kataBesar} (mm)`,
    "Arah (°)",
    "Beda arah (°)",
    "Laju (mm/hari)",
    "Status",
    "Status laju",
  ]);
  k4.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = BORDER;
  });

  for (const p of hasil.dipakai) {
    const dx = p.dxMm ?? 0;
    const dy = p.dyMm ?? 0;
    let beda: number | null = null;
    if (p.bearing !== null && hasil.vektorRata.bearing !== null) {
      let d = p.bearing - hasil.vektorRata.bearing;
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      beda = d;
    }
    const r = s4.addRow([
      p.nama.replace(/_/g, " "),
      Math.hypot(dx, dy),
      p.bearing,
      beda,
      p.lajuMmd,
      p.status ?? "—",
      p.statusLaju ?? "—",
    ]);
    r.eachCell((cell, c) => {
      if (c >= 2 && c <= 5) cell.numFmt = c === 2 || c === 5 ? "0.00" : "0.0";
      cell.alignment = { horizontal: c === 1 ? "left" : c >= 6 ? "center" : "right" };
      cell.border = BORDER;
    });
  }

  if (hasil.diabaikan.length > 0) {
    s4.addRow([]);
    const p = s4.addRow([
      `Tidak ikut dihitung karena tidak terbaca pada rentang ini atau acuan R0-nya tidak sah: ${hasil.diabaikan
        .map((n) => n.replace(/_/g, " "))
        .join(", ")}. Prisma seperti itu TIDAK dimasukkan sebagai nol — keadaannya tidak diketahui, bukan diam.`,
    ]);
    p.getCell(1).font = { italic: true, size: 10 };
  }

  s4.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** "Analisa_Gabungan_kolam_bpp_17-09-2026_0600_1259.xlsx". */
export function namaBerkasGabungan(site: string, rentangTeks: string): string {
  const bersih = rentangTeks.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "");
  return `Analisa_Gabungan_${site}_${bersih}.xlsx`;
}
