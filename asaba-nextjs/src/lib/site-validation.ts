/**
 * Normalisasi + validasi payload site.
 * Dipakai bersama oleh POST /api/sites dan PUT /api/sites/[id].
 *
 * Ditaruh di lib, bukan di route.ts, karena App Router membatasi export apa
 * saja yang boleh ada di sebuah route handler.
 */
import { hitungTerkalibrasi } from "@/lib/sites";

/** Angka opsional: "" dan null → null, sisanya divalidasi sebagai angka. */
function optNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Angka wajib dengan nilai default bila kosong. */
function reqNum(v: unknown, fallback: number): number {
  const n = optNum(v);
  return n === null ? fallback : n;
}

/** Slug harus cocok dengan nilai `log_kontrol.site`: huruf kecil, angka, - dan _. */
const SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/;

export type SitePayload = ReturnType<typeof normalizeBody>;

export function normalizeBody(body: Record<string, unknown>) {
  const rts_e = optNum(body.rts_e);
  const rts_n = optNum(body.rts_n);
  const rts_z = optNum(body.rts_z);
  const map_lat = optNum(body.map_lat);
  const map_lng = optNum(body.map_lng);
  const nama = String(body.nama ?? "").trim();

  return {
    slug: String(body.slug ?? "").trim().toLowerCase(),
    nama,
    badge_label: String(body.badge_label ?? "").trim() || nama.slice(0, 6),
    badge_color: String(body.badge_color ?? "").trim() || "#8D93A4",

    geser_normal_max: reqNum(body.geser_normal_max, 50),
    geser_waspada_max: reqNum(body.geser_waspada_max, 100),
    geser_siaga_max: reqNum(body.geser_siaga_max, 200),
    laju_waspada_min: reqNum(body.laju_waspada_min, 40),
    laju_siaga_min: reqNum(body.laju_siaga_min, 80),
    laju_awas_min: reqNum(body.laju_awas_min, 120),

    rts_e,
    rts_n,
    rts_z,
    utm_zone: reqNum(body.utm_zone, 50),
    utm_north: body.utm_north === undefined ? true : Boolean(body.utm_north),
    map_lat,
    map_lng,
    map_zoom: reqNum(body.map_zoom, 16),

    rotasi_deg: optNum(body.rotasi_deg),
    pivot_e: optNum(body.pivot_e),
    pivot_n: optNum(body.pivot_n),
    ukur_e: optNum(body.ukur_e),
    ukur_n: optNum(body.ukur_n),
    pivot_lat: optNum(body.pivot_lat),
    pivot_lng: optNum(body.pivot_lng),
    ukur_lat: optNum(body.ukur_lat),
    ukur_lng: optNum(body.ukur_lng),

    // Selalu dihitung server-side — tidak boleh diset manual dari client.
    terkalibrasi: hitungTerkalibrasi({ rts_e, rts_n, rts_z, map_lat, map_lng }),
    // Ini justru harus manual: hanya operator yang tahu apakah angka yang
    // diisinya hasil survei atau sekadar nilai contoh.
    data_dummy: Boolean(body.data_dummy),
    aktif: body.aktif === undefined ? true : Boolean(body.aktif),
    urutan: reqNum(body.urutan, 0),
    catatan: body.catatan ? String(body.catatan) : null,
  };
}

/** Validasi yang berlaku untuk create maupun update. Null = lolos. */
export function validate(d: SitePayload): string | null {
  if (!d.slug) return "Slug wajib diisi";
  if (!SLUG_RE.test(d.slug))
    return "Slug hanya boleh huruf kecil, angka, tanda hubung, dan garis bawah";
  if (!d.nama) return "Nama site wajib diisi";

  if (!(d.geser_normal_max < d.geser_waspada_max && d.geser_waspada_max < d.geser_siaga_max))
    return "Ambang pergeseran harus menaik: Normal < Waspada < Siaga";
  if (!(d.laju_waspada_min < d.laju_siaga_min && d.laju_siaga_min < d.laju_awas_min))
    return "Ambang kecepatan harus menaik: Waspada < Siaga < Awas";

  if (d.utm_zone < 1 || d.utm_zone > 60) return "Zona UTM harus antara 1 dan 60";
  if (d.map_lat !== null && (d.map_lat < -90 || d.map_lat > 90))
    return "Latitude harus antara -90 dan 90";
  if (d.map_lng !== null && (d.map_lng < -180 || d.map_lng > 180))
    return "Longitude harus antara -180 dan 180";

  // Rotasi hanya berarti kalau sudut dan keempat pivot UTM terisi lengkap —
  // rotasi setengah jadi menghasilkan koordinat salah tanpa error apa pun.
  const rotasiTerisi = [d.rotasi_deg, d.pivot_e, d.pivot_n, d.ukur_e, d.ukur_n].filter(
    (v) => v !== null
  ).length;
  if (rotasiTerisi > 0 && rotasiTerisi < 5)
    return "Parameter rotasi harus lengkap: sudut, pivot E/N, dan hasil ukur E/N";

  return null;
}
