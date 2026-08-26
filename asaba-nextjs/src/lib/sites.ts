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

// ─── Tipe ───────────────────────────────────────────────────────────────────

export interface SiteThresholds {
  /** Batas atas tiap level status pergeseran, dalam mm. */
  geser: { normalMax: number; waspadaMax: number; siagaMax: number };
  /** Batas bawah tiap level status kecepatan, dalam mm/hari. */
  laju: { waspadaMin: number; siagaMin: number; awasMin: number };
}

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
  /** Null bila site tidak memerlukan koreksi rotasi. */
  rotation: SiteRotation | null;
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
    rotation: null,
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
  rotasi_deg: number | null;
  pivot_e: number | null;
  pivot_n: number | null;
  ukur_e: number | null;
  ukur_n: number | null;
  pivot_lat: number | null;
  pivot_lng: number | null;
  ukur_lat: number | null;
  ukur_lng: number | null;
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
 * Sumbernya `config_adr` yang kini satu baris per site. Kalau belum ada, jatuh
 * ke logger yang dipakai prisma site tersebut.
 */
export async function getLoggerForSite(slug: string): Promise<string | null> {
  const dariConfig = await prisma.$queryRaw<Array<{ id_logger: number }>>`
    SELECT id_logger FROM config_adr WHERE site = ${slug} LIMIT 1
  `;
  if (dariConfig[0]?.id_logger != null) return String(dariConfig[0].id_logger);

  const dariPrisma = await prisma.$queryRaw<Array<{ id_logger: number }>>`
    SELECT id_logger FROM t_prisma WHERE site = ${slug} LIMIT 1
  `;
  return dariPrisma[0]?.id_logger != null ? String(dariPrisma[0].id_logger) : null;
}

// ─── Penentuan status ───────────────────────────────────────────────────────

export type StatusLabel = "Normal" | "Waspada" | "Siaga" | "Awas";

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

/** Status pergeseran berdasarkan nilai mm dan ambang milik site. */
export function statusPergeseran(mm: number, site: SiteConfig): StatusResult {
  const { normalMax, waspadaMax, siagaMax } = site.thresholds.geser;
  if (mm < normalMax) return hasil("Normal");
  if (mm < waspadaMax) return hasil("Waspada");
  if (mm < siagaMax) return hasil("Siaga");
  return hasil("Awas");
}

/** Status kecepatan berdasarkan nilai mm/hari dan ambang milik site. */
export function statusKecepatan(mmPerDay: number, site: SiteConfig): StatusResult {
  const { waspadaMin, siagaMin, awasMin } = site.thresholds.laju;
  if (mmPerDay > awasMin) return hasil("Awas");
  if (mmPerDay > siagaMin) return hasil("Siaga");
  if (mmPerDay > waspadaMin) return hasil("Waspada");
  return hasil("Normal");
}
