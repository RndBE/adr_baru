import { bearingDari, parseArah, parseNum } from "./format";
import {
  statusKecepatan,
  statusPergeseran,
  type AmbangSite,
  type StatusLabel,
} from "./status";

/** Baris log_kontrol dari /api/log-kontrol. */
export interface LogKontrolRow {
  id_log: string;
  datetime?: string | Date | null;
  site?: string | null;
  r0?: number | string | null;
  prisma?: string | null;
  /** Jumlah prisma BERBEDA yang ditembak pada sesi ini. */
  prisma_count?: number;
  /** Jumlah prisma yang pembacaannya sah (E/N/Z tidak nol). */
  success_count?: number;
}

/**
 * Satu prisma dalam data_pengukuran dari /api/deformasi.
 *
 * Semua field opsional: Dashboard hanya memakai selisih dan status hariannya,
 * sedangkan Hasil Pengukuran juga menampilkan koordinat mentah dan sudut
 * bidiknya. Satuan mengikuti server — koordinat dan selisih dalam METER,
 * sedangkan angka di blok `daily` sudah dalam milimeter.
 */
export interface PengukuranRow {
  id_prisma: string | number;
  nama_prisma?: string;
  waktu?: string;
  temp_tembak?: {
    /** Pembacaan acuan R0. */
    E0?: number;
    N0?: number;
    Z0?: number;
    HA0?: string;
    VA0?: string;
    SD0?: string;
    /** Pembacaan sesi ini. */
    E1?: number;
    N1?: number;
    Z1?: number;
    HA1?: string;
    VA1?: string;
    SD1?: string;
    DE?: string | number;
    DN?: string | number;
    DZ?: string | number;
    linear?: number;
    arah_pergeseran?: string;
    /** Prismanya ketemu pada sesi ini. Lihat catatan di ringkasPrisma(). */
    tertembak?: boolean;
    /** Bacaan acuan R0-nya sah. */
    acuan_sah?: boolean;
    /**
     * Koordinat UTM MENTAH sebelum koreksi rotasi site. Dipakai halaman detail
     * prisma sebagai acuan untuk riwayat dari /api/analisa, yang juga mentah.
     */
    raw_E0?: number;
    raw_N0?: number;
    raw_E1?: number;
    raw_N1?: number;
    /** Lat/lon hasil utm2ll() di server, untuk peta. */
    map_lat0?: number | null;
    map_lon0?: number | null;
    map_lat1?: number | null;
    map_lon1?: number | null;
  };
  daily?: {
    count?: number;
    first_time?: string | null;
    last_time?: string | null;
    pergeseran_mm?: number | null;
    kecepatan_mmd?: number | null;
    /** Label status dari server; kelas Tailwind-nya tidak dipakai di sini. */
    status_pergeseran?: { label?: string } | null;
    status_kecepatan?: { label?: string } | null;
    series?: { t: string; mm: number }[];
  };
}

/** Bentuk siap-tampil. Semua jarak dalam MILIMETER. */
export interface PrismaRingkas {
  /** Nomor slot RTS (P1, P2, …) — unik di dalam satu site. */
  id: string;
  nama: string;
  dxMm: number | null;
  dyMm: number | null;
  dzMm: number | null;
  /** Resultan 3D. */
  linierMm: number | null;
  /**
   * Pergeseran horizontal 2D terhadap acuan R0 — dasar penentuan status,
   * rumus yang sama dengan `pergeseran_mm` di server.
   */
  geserMm: number | null;
  bearing: number | null;
  arahTeks: string | null;
  /** Kecepatan harian (mm/hari) dari server; null bila belum ada data harian. */
  lajuMmd: number | null;
  status: StatusLabel | null;
  statusLaju: StatusLabel | null;
  /** Koordinat UTM terkoreksi untuk denah. */
  e: number | null;
  n: number | null;
  /**
   * Prismanya ketemu pada sesi ini, dan acuannya sah. Bila false, SELURUH angka
   * di atas null — bukan nol.
   */
  tertembak: boolean;
}

const keMm = (v: unknown): number | null => {
  const n = parseNum(v);
  return n === null ? null : n * 1000;
};

/**
 * Bacaan sah bila tidak SELURUH sumbunya nol.
 *
 * Di temp_prisma, status_get = 1 dengan N/E/Z semuanya nol berarti
 * "Failed / Not Found" — prisma dibidik tapi tidak ketemu. Aturan yang sama
 * dipakai `valid1`/`valid0` di /api/deformasi dan pergeseranMm() di
 * lib/evaluasi-siklus.ts.
 */
const bacaanSah = (...sumbu: Array<unknown>): boolean =>
  !sumbu.every((v) => (parseNum(v) ?? 0) === 0);

export function ringkasPrisma(
  rows: PengukuranRow[],
  ambang: AmbangSite | null
): PrismaRingkas[] {
  return rows.map((row) => {
    const t = row.temp_tembak ?? {};

    // Prisma yang gagal ditembak menghasilkan DN/DE/DZ nol, persis seperti
    // prisma yang sempurna diam. Tanpa pemisahan ini keduanya tampil "0,0 mm"
    // lalu dinilai "Normal" — layar menyatakan AMAN untuk prisma yang sebenarnya
    // tidak diketahui keadaannya. Itu kebalikan dari yang harus disampaikan
    // sebuah sistem pemantauan deformasi.
    //
    // Penanda dari server dipakai kalau ada; kalau tidak (respons lama yang
    // masih tersimpan SWR, atau server yang belum diperbarui), disimpulkan dari
    // koordinatnya sendiri supaya tidak bergantung pada urutan penyebaran.
    const tertembak =
      (t.tertembak ?? bacaanSah(t.E1, t.N1, t.Z1)) &&
      (t.acuan_sah ?? bacaanSah(t.E0, t.N0, t.Z0));

    const dxMm = tertembak ? keMm(t.DE) : null;
    const dyMm = tertembak ? keMm(t.DN) : null;
    const dzMm = tertembak ? keMm(t.DZ) : null;
    const linierMm = tertembak ? keMm(t.linear) : null;
    const geserMm =
      dxMm !== null && dyMm !== null ? Math.hypot(dxMm, dyMm) : null;

    const arah = tertembak ? parseArah(t.arah_pergeseran) : null;
    const bearing =
      arah?.bearing ??
      (geserMm !== null && geserMm > 0 && dxMm !== null && dyMm !== null
        ? bearingDari(dxMm, dyMm)
        : null);

    const lajuMmd = parseNum(row.daily?.kecepatan_mmd);

    return {
      id: String(row.id_prisma),
      nama: String(row.nama_prisma || row.id_prisma || "—"),
      dxMm,
      dyMm,
      dzMm,
      linierMm,
      geserMm,
      bearing,
      arahTeks: arah?.teks || null,
      lajuMmd,
      status: ambang && geserMm !== null ? statusPergeseran(geserMm, ambang) : null,
      statusLaju: ambang && lajuMmd !== null ? statusKecepatan(lajuMmd, ambang) : null,
      e: tertembak ? parseNum(t.E1) : null,
      n: tertembak ? parseNum(t.N1) : null,
      tertembak,
    };
  });
}
