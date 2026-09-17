/**
 * Site registry — satu-satunya sumber kebenaran untuk perilaku per-site.
 *
 * Sebelumnya setiap perilaku per-site ditulis sebagai percabangan biner
 * `if (site === 'ccp') { ... } else { ... }` yang tersebar di 6 file, sehingga
 * site ketiga selalu jatuh ke cabang `else` dan diam-diam diperlakukan sebagai
 * Viewpoint. Sekarang semuanya dibaca dari tabel `t_site`.
 *
 * `slug` harus sama persis dengan nilai kolom `log_kontrol.site`.
 */
import { prisma } from "@/lib/prisma";
import { ZONA_BAWAAN_MENIT } from "@/components/monitoring/format";
import {
  type AmbangSite,
  type StatusLabel,
  statusPergeseran as aturanPergeseran,
  statusKecepatan as aturanKecepatan,
} from "@/lib/ambang";

// ─── Tipe ───────────────────────────────────────────────────────────────────

/**
 * Bentuknya sama persis dengan AmbangSite di `@/lib/ambang` — dijadikan alias,
 * bukan disalin, supaya tidak ada dua definisi yang bisa bergeser sendiri.
 */
export type SiteThresholds = AmbangSite;

export interface SiteRotation {
  /** Sudut rotasi dalam derajat. */
  degree: number;
  /** Pivot sebenarnya (GNSS) dalam UTM. */
  pivotE: number;
  pivotN: number;
  /** Posisi pivot yang terukur oleh RTS (posisi keliru yang dikoreksi). */
  ukurE: number;
  ukurN: number;
  /** Padanan pivot dalam lat/lng, untuk rotateCoordinate(). */
  pivotLat: number | null;
  pivotLng: number | null;
  ukurLat: number | null;
  ukurLng: number | null;
}

/**
 * Ortofoto yang dipakai sebagai lantai scene Visualisasi 3D.
 *
 * Kotak batasnya METER UTM pada zona `SiteConfig.utm` — bukan lat/lng, karena
 * seluruh scene 3D memang bekerja di UTM dan mengubahnya bolak-balik cuma
 * menambah tempat untuk keliru. Gambarnya north-up tanpa rotasi, jadi empat
 * sudut sudah menentukan seluruh georeferensinya.
 */
export interface SiteBasemap {
  url: string;
  /** PNG 1-bit penanda bagian bergambar; null bila ortofotonya persegi penuh. */
  nodataUrl: string | null;
  minE: number;
  maxE: number;
  minN: number;
  maxN: number;
  /** Elevasi bidangnya, meter. Null = biarkan penampil menurunkannya dari data. */
  z: number | null;
}

export interface SiteConfig {
  id: number;
  slug: string;
  nama: string;
  badgeLabel: string;
  badgeColor: string;
  thresholds: SiteThresholds;
  /** Koordinat referensi RTS. Null bila site belum dikalibrasi. */
  rts: { E: number; N: number; Z: number } | null;
  utm: { zone: number; north: boolean };
  /** Center + zoom peta. Null bila site belum dikalibrasi. */
  map: { lat: number; lng: number; zoom: number } | null;
  /** Ortofoto untuk Visualisasi 3D. Null bila site ini belum punya. */
  basemap: SiteBasemap | null;
  /**
   * Perbaikan azimut tembakan RTS. Null bila site ini tidak memerlukannya.
   *
   * Dipakai `/api/datamasuk/adr` saat data masuk dan oleh
   * `scripts/perbaiki-azimut-rts.ts` untuk riwayat. Lihat
   * `@/lib/koreksi-azimut` untuk duduk perkaranya.
   */
  koreksiAzimut: { faktorDerajat: number; orientasiDeg: number } | null;
  /** Null bila site tidak memerlukan koreksi rotasi. */
  rotation: SiteRotation | null;
  /** Kode logger yang melayani site ini. Null bila belum dipilih. */
  idLogger: string | null;
  terkalibrasi: boolean;
  /** True bila koordinat/ambang site ini masih nilai contoh, bukan hasil survei. */
  dataDummy: boolean;
  aktif: boolean;
  urutan: number;
  catatan: string | null;
  /** True bila site tidak ada di `t_site` dan ini hasil fallback. */
  tidakDikenal: boolean;
}

// ─── Fallback ───────────────────────────────────────────────────────────────

/**
 * Dipakai saat `log_kontrol.site` berisi slug yang tidak ada di `t_site`.
 * Sengaja memakai ambang paling ketat dan tanpa rotasi, agar site yang belum
 * terdaftar cenderung memicu peringatan lebih awal, bukan lebih lambat.
 */
export function fallbackSite(slug: string): SiteConfig {
  return {
    id: -1,
    slug,
    nama: slug || "Tidak dikenal",
    badgeLabel: (slug || "?").slice(0, 4).toUpperCase(),
    badgeColor: "#8D93A4",
    thresholds: {
      geser: { normalMax: 50, waspadaMax: 100, siagaMax: 200 },
      laju: { waspadaMin: 40, siagaMin: 80, awasMin: 120 },
    },
    rts: null,
    utm: { zone: 50, north: true },
    map: null,
    basemap: null,
    koreksiAzimut: null,
    rotation: null,
    idLogger: null,
    terkalibrasi: false,
    dataDummy: false,
    aktif: true,
    urutan: 999,
    catatan: null,
    tidakDikenal: true,
  };
}

// ─── Pemetaan baris DB → SiteConfig ─────────────────────────────────────────

type SiteRow = {
  id: number;
  slug: string;
  nama: string;
  badge_label: string;
  badge_color: string;
  geser_normal_max: number;
  geser_waspada_max: number;
  geser_siaga_max: number;
  laju_waspada_min: number;
  laju_siaga_min: number;
  laju_awas_min: number;
  rts_e: number | null;
  rts_n: number | null;
  rts_z: number | null;
  utm_zone: number;
  utm_north: boolean;
  map_lat: number | null;
  map_lng: number | null;
  map_zoom: number;
  basemap_url: string | null;
  basemap_nodata_url: string | null;
  basemap_min_e: number | null;
  basemap_max_e: number | null;
  basemap_min_n: number | null;
  basemap_max_n: number | null;
  basemap_z: number | null;
  ha_faktor_derajat: number | null;
  ha_orientasi_deg: number | null;
  rotasi_deg: number | null;
  pivot_e: number | null;
  pivot_n: number | null;
  ukur_e: number | null;
  ukur_n: number | null;
  pivot_lat: number | null;
  pivot_lng: number | null;
  ukur_lat: number | null;
  ukur_lng: number | null;
  id_logger: string | null;
  terkalibrasi: boolean;
  data_dummy: boolean;
  aktif: boolean;
  urutan: number;
  catatan: string | null;
};

export function toSiteConfig(row: SiteRow): SiteConfig {
  // Rotasi hanya aktif kalau sudut DAN kedua pasang pivot UTM terisi —
  // rotateEN() tanpa pivot lengkap akan menghasilkan koordinat yang salah diam-diam.
  const rotasiLengkap =
    row.rotasi_deg !== null &&
    row.pivot_e !== null &&
    row.pivot_n !== null &&
    row.ukur_e !== null &&
    row.ukur_n !== null;

  // Base map menuntut KEEMPAT sisi kotaknya, bukan sekadar berkasnya. Satu sisi
  // null berarti gambarnya akan diregangkan ke batas yang dikarang, dan
  // ortofoto yang melenceng beberapa ratus meter jauh lebih menyesatkan
  // daripada tidak ada ortofoto sama sekali — prisma akan terlihat duduk di
  // tanggul yang salah.
  const kotakLengkap =
    row.basemap_min_e !== null &&
    row.basemap_max_e !== null &&
    row.basemap_min_n !== null &&
    row.basemap_max_n !== null;

  return {
    id: row.id,
    slug: row.slug,
    nama: row.nama,
    badgeLabel: row.badge_label,
    badgeColor: row.badge_color,
    thresholds: {
      geser: {
        normalMax: row.geser_normal_max,
        waspadaMax: row.geser_waspada_max,
        siagaMax: row.geser_siaga_max,
      },
      laju: {
        waspadaMin: row.laju_waspada_min,
        siagaMin: row.laju_siaga_min,
        awasMin: row.laju_awas_min,
      },
    },
    rts:
      row.rts_e !== null && row.rts_n !== null && row.rts_z !== null
        ? { E: row.rts_e, N: row.rts_n, Z: row.rts_z }
        : null,
    utm: { zone: row.utm_zone, north: row.utm_north },
    map:
      row.map_lat !== null && row.map_lng !== null
        ? { lat: row.map_lat, lng: row.map_lng, zoom: row.map_zoom }
        : null,
    basemap:
      row.basemap_url && kotakLengkap
        ? {
            url: row.basemap_url,
            nodataUrl: row.basemap_nodata_url,
            minE: row.basemap_min_e as number,
            maxE: row.basemap_max_e as number,
            minN: row.basemap_min_n as number,
            maxN: row.basemap_max_n as number,
            z: row.basemap_z,
          }
        : null,
    // Koreksi azimut menuntut KEDUA angkanya. Satu saja terisi berarti
    // separuh rumus — dan separuh rumus menghasilkan koordinat yang keliru
    // dengan cara yang baru, bukan koordinat yang belum dikoreksi.
    koreksiAzimut:
      row.ha_faktor_derajat !== null && row.ha_orientasi_deg !== null
        ? { faktorDerajat: row.ha_faktor_derajat, orientasiDeg: row.ha_orientasi_deg }
        : null,
    rotation: rotasiLengkap
      ? {
          degree: row.rotasi_deg as number,
          pivotE: row.pivot_e as number,
          pivotN: row.pivot_n as number,
          ukurE: row.ukur_e as number,
          ukurN: row.ukur_n as number,
          pivotLat: row.pivot_lat,
          pivotLng: row.pivot_lng,
          ukurLat: row.ukur_lat,
          ukurLng: row.ukur_lng,
        }
      : null,
    idLogger: row.id_logger,
    terkalibrasi: row.terkalibrasi,
    dataDummy: row.data_dummy,
    aktif: row.aktif,
    urutan: row.urutan,
    catatan: row.catatan,
    tidakDikenal: false,
  };
}

/**
 * Site dianggap terkalibrasi hanya bila koordinat referensi RTS dan center peta
 * sudah terisi. Dihitung di server saat simpan, bukan diisi manual, supaya
 * flag ini tidak bisa berbohong.
 */
export function hitungTerkalibrasi(row: {
  rts_e: number | null;
  rts_n: number | null;
  rts_z: number | null;
  map_lat: number | null;
  map_lng: number | null;
}): boolean {
  return (
    row.rts_e !== null &&
    row.rts_n !== null &&
    row.rts_z !== null &&
    row.map_lat !== null &&
    row.map_lng !== null
  );
}

// ─── Cache ──────────────────────────────────────────────────────────────────

const TTL_MS = 60_000;
let cache: { at: number; byslug: Map<string, SiteConfig> } | null = null;

/** Kosongkan cache — dipanggil setelah create/update/delete site. */
export function invalidateSiteCache() {
  cache = null;
}

async function loadAll(): Promise<Map<string, SiteConfig>> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.byslug;

  const rows = (await prisma.site.findMany({
    orderBy: [{ urutan: "asc" }, { nama: "asc" }],
  })) as unknown as SiteRow[];

  const byslug = new Map<string, SiteConfig>();
  for (const row of rows) byslug.set(row.slug, toSiteConfig(row));

  cache = { at: now, byslug };
  return byslug;
}

// ─── API publik ─────────────────────────────────────────────────────────────

/** Semua site aktif, terurut. */
export async function getSites(includeInactive = false): Promise<SiteConfig[]> {
  const all = [...(await loadAll()).values()];
  return includeInactive ? all : all.filter((s) => s.aktif);
}

/**
 * Ambil config satu site. Selalu mengembalikan objek — slug yang tidak
 * terdaftar menghasilkan fallback dengan `tidakDikenal: true`, bukan null,
 * supaya pemanggil tidak perlu menangani null di mana-mana.
 */
export async function getSite(slug: string | null | undefined): Promise<SiteConfig> {
  const key = (slug || "").trim();
  if (!key) return fallbackSite("unknown");
  return (await loadAll()).get(key) ?? fallbackSite(key);
}

// ─── Logger milik sebuah site ───────────────────────────────────────────────

/**
 * Logger (unit RTS) yang melayani sebuah site.
 *
 * PENTING untuk perintah MQTT: payload-nya berbentuk `{ set_<id_logger>: … }`,
 * jadi salah logger berarti perintah dikirim ke perangkat yang salah. Beberapa
 * route dulu memakai "logger ADR pertama" (`LIMIT 1` tanpa ORDER BY) — aman
 * ketika hanya ada satu unit, tapi tidak deterministik begitu ada lebih dari satu.
 *
 * Sumbernya `t_site.id_logger` — SATU-SATUNYA tempat relasi ini dinyatakan,
 * dan satu-satunya yang juga berlaku untuk site yang belum punya konfigurasi
 * maupun prisma. Dua sumber lama dipertahankan sebagai cadangan untuk baris
 * lawas yang kolomnya belum terisi, bukan sebagai sumber setara.
 */
export async function getLoggerForSite(slug: string): Promise<string | null> {
  const site = await prisma.site.findUnique({
    where: { slug },
    select: { id_logger: true },
  });
  if (site?.id_logger) return site.id_logger;

  const dariConfig = await prisma.$queryRaw<Array<{ id_logger: number }>>`
    SELECT id_logger FROM config_adr WHERE site = ${slug} LIMIT 1
  `;
  if (dariConfig[0]?.id_logger != null) return String(dariConfig[0].id_logger);

  const dariPrisma = await prisma.$queryRaw<Array<{ id_logger: number }>>`
    SELECT id_logger FROM t_prisma WHERE site = ${slug} LIMIT 1
  `;
  return dariPrisma[0]?.id_logger != null ? String(dariPrisma[0].id_logger) : null;
}

/**
 * Logger tujuan sebuah perintah MQTT, dengan `site` OPSIONAL.
 *
 * - `site` diisi  → diturunkan dari site lewat getLoggerForSite().
 * - `site` kosong → jatuh ke perilaku lama: "logger ADR/RTS pertama". Query ini
 *   disalin apa adanya dari versi sebelum refactor supaya pemanggil yang belum
 *   mengirim `site` berperilaku sama persis seperti dulu, bukan ditolak 400.
 *
 * PERINGATAN: `LIMIT 1` tanpa `ORDER BY` tidak menjamin urutan. Selama hanya ada
 * satu unit ADR/RTS terdaftar hasilnya selalu unit itu, jadi identik dengan
 * perilaku lama. Begitu unit kedua didaftarkan, jalur fallback ini bisa memilih
 * perangkat yang salah — dan perintah seperti PowerOff atau go-to-target akan
 * mendarat di site lain. Pemanggil wajib mulai mengirim `site` sebelum itu.
 */
export async function getLoggerForCommand(site?: string | null): Promise<string | null> {
  const slug = (site ?? "").trim();
  if (slug) return getLoggerForSite(slug);

  const rows = await prisma.$queryRaw<Array<{ id_logger: string }>>`
    SELECT l.id_logger FROM t_logger l
    JOIN kategori_logger kl ON l.kategori_log = kl.id_katlogger
    WHERE kl.nama_kategori LIKE '%ADR%' OR kl.nama_kategori LIKE '%RTS%' LIMIT 1
  `;
  return rows?.[0]?.id_logger ?? null;
}

/**
 * Zona waktu yang dilaporkan satu logger, dalam menit dari UTC.
 *
 * Dipakai hanya oleh penulis yang MENGARANG cap waktu dari jam server — tombol
 * Mulai, dan cadangan di /api/datamasuk/adr saat logger tidak menyebut waktunya
 * sendiri. Payload yang membawa waktunya sendiri tidak lewat sini sama sekali,
 * jadi jalur ingestion yang normal tidak membayar satu kueri pun.
 *
 * Tidak di-cache dengan sengaja: pemanggilnya jarang (tekan tombol, atau payload
 * yang kehilangan medan waktu), dan cache yang basi sesudah operator membetulkan
 * zona di Master Data lebih merepotkan daripada satu SELECT yang murah.
 *
 * Logger tak dikenal jatuh ke bawaan, bukan galat: perintahnya tetap harus
 * berangkat, dan yang meleset paling jauh cuma jam yang tertulis.
 */
export async function offsetLogger(idLogger: string | null | undefined): Promise<number> {
  if (!idLogger) return ZONA_BAWAAN_MENIT;
  const rows = await prisma.$queryRaw<Array<{ utc_offset_menit: number }>>`
    SELECT utc_offset_menit FROM t_logger WHERE id_logger = ${idLogger} LIMIT 1
  `;
  const menit = Number(rows?.[0]?.utc_offset_menit);
  return Number.isFinite(menit) ? menit : ZONA_BAWAAN_MENIT;
}

// ─── Penentuan status ───────────────────────────────────────────────────────

export type { StatusLabel } from "@/lib/ambang";

export interface StatusResult {
  label: StatusLabel;
  /** Kelas Tailwind untuk badge. */
  class: string;
}

const STATUS_CLASS: Record<StatusLabel, string> = {
  Normal: "bg-emerald-100 text-emerald-700",
  Waspada: "bg-yellow-100 text-yellow-700",
  Siaga: "bg-orange-100 text-orange-700",
  Awas: "bg-red-100 text-red-700",
};

function hasil(label: StatusLabel): StatusResult {
  return { label, class: STATUS_CLASS[label] };
}

/**
 * Status pergeseran berdasarkan nilai mm dan ambang milik site.
 *
 * Perbandingannya sendiri ada di `@/lib/ambang`; di sini hanya ditambahkan
 * kelas Tailwind untuk badge. Dulu aturannya ditulis ulang di sini DAN di
 * components/monitoring/status.ts — dua salinan yang bisa lepas sinkron tanpa
 * ada yang menyadarinya.
 */
export function statusPergeseran(mm: number, site: SiteConfig): StatusResult {
  return hasil(aturanPergeseran(mm, site.thresholds));
}

/** Status kecepatan berdasarkan nilai mm/hari dan ambang milik site. */
export function statusKecepatan(mmPerDay: number, site: SiteConfig): StatusResult {
  return hasil(aturanKecepatan(mmPerDay, site.thresholds));
}
