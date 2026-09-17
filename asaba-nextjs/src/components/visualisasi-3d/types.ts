/**
 * Bentuk data yang dipakai halaman Visualisasi 3D.
 *
 * Sebelumnya seluruh berkas halaman memakai `any` (38 pelanggaran lint), jadi
 * salah nama medan — mis. `temp_tembak.DE` vs `de` — baru ketahuan sebagai plot
 * kosong di layar, bukan sebagai galat tipe. Yang dideklarasikan di sini hanya
 * medan yang BENAR-BENAR dibaca; sisanya dibiarkan tak disebut supaya tipe ini
 * tidak berpura-pura mengenal seluruh respons server.
 */

/** Satu prisma setelah dinormalkan dari respons /api/deformasi. */
export interface Titik {
  id: string;
  name: string;
  /** Pembacaan acuan R0, meter UTM. */
  e0: number;
  n0: number;
  z0: number;
  /** Pembacaan sesi ini; NaN bila tembakannya gagal. */
  e1: number;
  n1: number;
  z1: number;
  /** Selisih terhadap acuan, meter; NaN bila tembakannya gagal. */
  de: number;
  dn: number;
  dz: number;
  /** Resultan 3D, meter; NaN bila tembakannya gagal. */
  lin: number;
  dirText: string;
  /** Tembakan sesi ini menghasilkan koordinat yang sah. */
  ok: boolean;
}

export interface PosisiRts {
  E?: unknown;
  N?: unknown;
  Z?: unknown;
  /** Bentuk lama: x = northing, y = easting. Lihat getRTSFromPayload(). */
  x?: unknown;
  y?: unknown;
}

export interface BarisPengukuran {
  id_prisma?: string | number;
  nama_prisma?: string;
  /** Medannya dibaca lewat toNum(); tipenya sengaja longgar. */
  temp_tembak?: Record<string, unknown>;
}

/**
 * Ortofoto site, apa adanya dari `/api/deformasi` → `data.site.basemap`.
 *
 * Bentuknya sama dengan SiteBasemap di `@/lib/sites`, tapi TIDAK di-import dari
 * sana: berkas itu menarik `@/lib/prisma`, dan berkas ini dipakai komponen
 * klien. Yang ditiru cuma bentuknya, bukan modulnya.
 */
export interface BasemapSite {
  url: string;
  nodataUrl: string | null;
  minE: number;
  maxE: number;
  minN: number;
  maxN: number;
  /** Elevasi bidangnya, meter. Null = turunkan dari data. */
  z: number | null;
  /** Relief dari kontur survei; null = lantainya bidang datar. */
  demUrl: string | null;
  demMinZ: number | null;
  demMaxZ: number | null;
}

export interface PayloadDeformasi {
  tanggal?: string;
  posisi_rts?: PosisiRts | null;
  data_pengukuran?: BarisPengukuran[];
  site?: {
    slug?: string;
    nama?: string;
    basemap?: BasemapSite | null;
  } | null;
}

/** Baris /api/log-kontrol yang dipakai pemilih sesi. */
export interface BarisLog {
  id_log: string;
  datetime: string;
  site: string | null;
  r0?: number | string | null;
}

/** Ringkasan hasil parsing, untuk pembacaan di panel — bukan untuk plot. */
export interface RingkasRender {
  tanggal: string | null;
  prisma: number;
  valid: number;
  gagal: number;
}

/**
 * Isi cache localStorage.
 *
 * Payload mentah dari server TIDAK disimpan — dulu seluruh objek `meta` ikut
 * masuk padahal yang dipakai hanya tanggalnya, dan pada sesi berisi puluhan
 * prisma itu membengkakkan cache tanpa guna. Yang disimpan sekarang titik yang
 * sudah dinormalkan plus ringkasan hitungnya.
 */
export interface CachePayload {
  id_log: string;
  rtsE: string;
  rtsN: string;
  rtsZ: string;
  coneScale: string;
  minLinear: string;
  points: Titik[];
  ringkas: RingkasRender;
  /**
   * Ortofoto site sesi ini. IKUT disimpan walau bukan hasil hitungan: pemulihan
   * dari cache sengaja tidak menembak server sama sekali, jadi tanpa ini
   * kunjungan pertama setelah reload akan menggambar scene tanpa lantai lalu
   * memunculkannya tiba-tiba saat sesi lain dipilih.
   */
  basemap?: BasemapSite | null;
}

/**
 * Bagian API Plotly yang dipakai halaman ini.
 *
 * Plotly dimuat sebagai <script> dari /plotly-2.33.0.min.js, bukan sebagai
 * modul, jadi tipenya tidak datang dari paket mana pun.
 */
export interface PlotlyGlobal {
  newPlot(
    el: HTMLElement,
    data: unknown[],
    layout: unknown,
    config?: unknown
  ): Promise<unknown>;
  Plots: { resize(el: HTMLElement): void };
}
