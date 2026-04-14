/**
 * Deformation calculation utilities.
 * Ported from CI3 Beranda controller business logic.
 */

// ─── Status Thresholds ──────────────────────────────────────────────────

interface StatusResult {
  label: string;
  class: string;
}

/**
 * Determine displacement status based on mm value and site.
 * Ported from PHP Beranda::status_pergeseran().
 */
export function statusPergeseran(mm: number, site: string): StatusResult {
  if (site === "ccp") {
    if (mm < 100) return { label: "Normal", class: "bg-success-lt text-dark" };
    if (mm < 200) return { label: "Waspada", class: "bg-warning-lt text-dark" };
    if (mm < 400) return { label: "Siaga", class: "bg-orange-lt text-dark" };
    return { label: "Awas", class: "bg-danger-lt text-white" };
  }
  if (mm < 50) return { label: "Normal", class: "bg-success-lt text-dark" };
  if (mm < 100) return { label: "Waspada", class: "bg-warning-lt text-dark" };
  if (mm < 200) return { label: "Siaga", class: "bg-orange-lt text-dark" };
  return { label: "Awas", class: "bg-danger-lt text-white" };
}

/**
 * Determine velocity status based on mm/day value and site.
 * Ported from PHP Beranda::status_kecepatan().
 */
export function statusKecepatan(mmPerDay: number, site: string): StatusResult {
  let levelD = 0;
  if (site === "ccp") {
    if (mmPerDay > 150) levelD = 3;
    else if (mmPerDay > 100) levelD = 2;
    else if (mmPerDay > 50) levelD = 1;
  } else {
    if (mmPerDay > 120) levelD = 3;
    else if (mmPerDay > 80) levelD = 2;
    else if (mmPerDay > 40) levelD = 1;
  }

  if (levelD === 0) return { label: "Normal", class: "bg-success-lt text-dark" };
  if (levelD === 1) return { label: "Waspada", class: "bg-warning-lt text-dark" };
  if (levelD === 2) return { label: "Siaga", class: "bg-orange-lt text-dark" };
  return { label: "Awas", class: "bg-danger-lt text-white" };
}

// ─── RTS Site Coordinates ───────────────────────────────────────────────

interface RTSPosition {
  E: number;
  N: number;
  Z: number;
}

/**
 * Get RTS reference coordinates by site name.
 */
export function getRtsBySite(site: string): RTSPosition {
  if (site === "ccp") {
    return { E: 525952.0, N: 401320.988, Z: 62.559 };
  }
  return { E: 526904.411, N: 402826.049, Z: 53.751 };
}

// ─── Deformation Calculation ────────────────────────────────────────────

export interface DeformationResult {
  DN: number;
  DE: number;
  DZ: number;
  linear3d: number;
  linear2d: number;
  arah: string;
}

/**
 * Calculate deformation between two coordinate sets.
 */
export function calculateDeformation(
  N1: number,
  E1: number,
  Z1: number,
  N0: number,
  E0: number,
  Z0: number
): DeformationResult {
  const valid1 = N1 !== 0 || E1 !== 0 || Z1 !== 0;
  const valid0 = N0 !== 0 || E0 !== 0 || Z0 !== 0;

  if (valid1 && valid0) {
    const DN = N1 - N0;
    const DE = E1 - E0;
    const DZ = Z1 - Z0;
    const linear3d = Math.sqrt(DE * DE + DN * DN + DZ * DZ);
    const linear2d = Math.sqrt(DE * DE + DN * DN);

    let arah = "-";
    if (linear2d > 0) {
      // Import dynamically to avoid circular deps
      const { arah8ID } = require("./coordinates");
      const tmp = arah8ID(DE, DN);
      arah = `${tmp.bearing.toFixed(2)} (${tmp.arah_id})`;
    }

    return { DN, DE, DZ, linear3d, linear2d, arah };
  }

  return { DN: 0, DE: 0, DZ: 0, linear3d: 0, linear2d: 0, arah: "-" };
}
