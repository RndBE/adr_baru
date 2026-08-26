/**
 * Deformation calculation utilities.
 * Ported from CI3 Beranda controller business logic.
 *
 * Ambang status dan koordinat referensi RTS dulu ditulis di sini sebagai
 * percabangan `if (site === "ccp")`. Keduanya sekarang berasal dari tabel
 * `t_site` lewat `@/lib/sites` — lihat file itu untuk statusPergeseran(),
 * statusKecepatan(), dan SiteConfig.rts.
 */
import { arah8ID } from "./coordinates";

export type { SiteConfig, StatusResult } from "./sites";
export { statusPergeseran, statusKecepatan, getSite, getSites } from "./sites";

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
      const tmp = arah8ID(DE, DN);
      arah = `${tmp.bearing.toFixed(2)} (${tmp.arah_id})`;
    }

    return { DN, DE, DZ, linear3d, linear2d, arah };
  }

  return { DN: 0, DE: 0, DZ: 0, linear3d: 0, linear2d: 0, arah: "-" };
}
