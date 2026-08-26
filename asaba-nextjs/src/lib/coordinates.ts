/**
 * Coordinate utility functions ported from CI3 PHP helpers.
 * Handles UTM ↔ LatLng conversion, coordinate rotation, and compass bearing.
 */

// ─── UTM to Lat/Lng Conversion ─────────────────────────────────────────

interface LatLng {
  lat: number;
  lon: number;
}

/**
 * Convert UTM coordinates to Latitude/Longitude.
 * Ported from PHP utm2ll() helper.
 */
export function utm2ll(
  easting: number,
  northing: number,
  zone: number,
  northern: boolean
): LatLng {
  const a = 6378137.0; // WGS-84 semi-major axis
  const f = 1 / 298.257223563; // WGS-84 flattening
  const e = Math.sqrt(2 * f - f * f);
  const e2 = e * e;
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const k0 = 0.9996;

  const x = easting - 500000.0;
  let y = northing;
  if (!northern) y -= 10000000.0;

  const M = y / k0;
  const mu =
    M /
    (a *
      (1 -
        e2 / 4 -
        (3 * e2 * e2) / 64 -
        (5 * e2 * e2 * e2) / 256));

  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 * e1 * e1) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 * e1 * e1 * e1) / 32) *
      Math.sin(4 * mu) +
    ((151 * e1 * e1 * e1) / 96) * Math.sin(6 * mu);

  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) * Math.sin(phi1));
  const T1 = Math.tan(phi1) * Math.tan(phi1);
  const C1 =
    (e2 / (1 - e2)) * Math.cos(phi1) * Math.cos(phi1);
  const R1 =
    (a * (1 - e2)) /
    Math.pow(1 - e2 * Math.sin(phi1) * Math.sin(phi1), 1.5);
  const D = x / (N1 * k0);

  const lat =
    phi1 -
    ((N1 * Math.tan(phi1)) / R1) *
      (D * D / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * (e2 / (1 - e2))) *
          D * D * D * D) /
          24 +
        ((61 +
          90 * T1 +
          298 * C1 +
          45 * T1 * T1 -
          252 * (e2 / (1 - e2)) -
          3 * C1 * C1) *
          D * D * D * D * D * D) /
          720);

  const lon =
    ((D -
      ((1 + 2 * T1 + C1) * D * D * D) / 6 +
      ((5 -
        2 * C1 +
        28 * T1 -
        3 * C1 * C1 +
        8 * (e2 / (1 - e2)) +
        24 * T1 * T1) *
        D * D * D * D * D) /
        120) /
      Math.cos(phi1)) +
    ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180);

  return {
    lat: lat * (180 / Math.PI),
    lon: lon * (180 / Math.PI),
  };
}

// ─── Coordinate Rotation ────────────────────────────────────────────────

/** Parameter rotasi UTM milik satu site. Dipenuhi oleh SiteRotation di lib/sites.ts. */
export interface RotationParams {
  /** Sudut rotasi dalam derajat. */
  degree: number;
  /** Pivot sebenarnya (koordinat GNSS). */
  pivotE: number;
  pivotN: number;
  /** Posisi pivot yang terukur RTS (posisi keliru yang dikoreksi). */
  ukurE: number;
  ukurN: number;
}

/**
 * Rotate Easting/Northing coordinates around a site's pivot point.
 * Ported from PHP Beranda::rotateEN().
 *
 * Pivot dulu di-hardcode ke nilai milik CCP, sehingga site lain yang memanggil
 * fungsi ini akan dikoreksi memakai pivot site yang salah. Sekarang pivot
 * datang dari konfigurasi site.
 */
export function rotateEN(
  E: number,
  N: number,
  rot: RotationParams
): [number, number] {
  const { degree, pivotE, pivotN, ukurE: measE, ukurN: measN } = rot;

  // Relative vector from measured pivot
  const x = E - measE;
  const y = N - measN;

  // Rotation
  const theta = (degree * Math.PI) / 180;
  const xr = x * Math.cos(theta) - y * Math.sin(theta);
  const yr = x * Math.sin(theta) + y * Math.cos(theta);

  // Apply to GNSS pivot
  const newE = pivotE + xr;
  const newN = pivotN + yr;

  return [newE, newN];
}

/** Parameter rotasi dalam lat/lng milik satu site. */
export interface RotationParamsLL {
  degree: number;
  pivotLat: number;
  pivotLng: number;
  ukurLat: number;
  ukurLng: number;
}

/**
 * Rotate Lat/Lng coordinates around a site's pivot point.
 * Ported from PHP Beranda::rotateCoordinate().
 */
export function rotateCoordinate(
  lat: number,
  lng: number,
  rot: RotationParamsLL
): [number, number] {
  const {
    degree,
    pivotLat,
    pivotLng,
    ukurLat: bs1MeasLat,
    ukurLng: bs1MeasLng,
  } = rot;

  const theta = (degree * Math.PI) / 180;
  const R = 6378137.0;

  const x =
    ((lng - bs1MeasLng) * Math.PI / 180) *
    R *
    Math.cos((bs1MeasLat * Math.PI) / 180);
  const y = ((lat - bs1MeasLat) * Math.PI / 180) * R;

  const xr = x * Math.cos(theta) - y * Math.sin(theta);
  const yr = x * Math.sin(theta) + y * Math.cos(theta);

  const newLat =
    (yr / R + (pivotLat * Math.PI) / 180) * (180 / Math.PI);
  const newLng =
    (xr / (R * Math.cos((pivotLat * Math.PI) / 180)) +
      (pivotLng * Math.PI) / 180) *
    (180 / Math.PI);

  return [newLat, newLng];
}

// ─── Compass Bearing ────────────────────────────────────────────────────

const COMPASS_DIRS = [
  "Utara",
  "Timur Laut",
  "Timur",
  "Tenggara",
  "Selatan",
  "Barat Daya",
  "Barat",
  "Barat Laut",
] as const;

/**
 * Calculate 8-point compass bearing from delta E/N.
 * Ported from PHP Beranda::arah8ID().
 */
export function arah8ID(DE: number, DN: number) {
  let deg = (Math.atan2(DE, DN) * 180) / Math.PI;
  deg = ((deg % 360) + 360) % 360;
  const index = Math.floor((deg + 22.5) / 45) % 8;
  return {
    bearing: deg,
    arah_id: COMPASS_DIRS[index],
  };
}

// ─── Helper ─────────────────────────────────────────────────────────────

/**
 * Safely parse a sensor value to float.
 * Handles null, empty, malformed strings like '000,00,00'.
 */
export function nfloat(v: unknown): number {
  if (v === null || v === undefined) return 0.0;
  if (typeof v === "number") return v;
  let s = String(v).trim();
  if (s === "" || s === "000,00,00" || s === "000.00.00") return 0.0;
  s = s.replace(/,/g, ".");
  s = s.replace(/[^0-9.\-]/g, "");
  if (s === "" || s === "-" || s === "." || s === "-.") return 0.0;
  return parseFloat(s);
}

/**
 * Format a number with fixed decimal places.
 */
export function fmt(v: number, d: number = 3): string {
  return v.toFixed(d);
}
