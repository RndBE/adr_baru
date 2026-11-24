/**
 * Pergeseran satu prisma terhadap acuannya — dipakai evaluasi-siklus.ts dan
 * acuan-prisma.ts. Dipisah dari evaluasi-siklus.ts supaya acuan-prisma.ts bisa
 * memakainya tanpa impor melingkar.
 */
import { nfloat, rotateEN } from "@/lib/coordinates";

/** Satu baris `rts`. sensor7 = jarak miring (m), dipakai menghitung toleransi akurasi RTS. */
export type BarisRts = { sensor1: string; sensor7?: string; sensor8: string; sensor9: string; sensor10: string };

/**
 * Pergeseran linier 2D terhadap acuan, dalam mm. Null bila salah satu bacaan
 * tidak sah.
 *
 * Penjagaan nol bukan kehati-hatian berlebih. Di temp_prisma, status_get = 1
 * dengan N1/E1/Z1 semuanya nol berarti "Failed / Not Found" — prisma dibidik
 * tapi tidak ketemu. Tanpa penjagaan ini, satu prisma berkabut menghasilkan
 * jarak sebesar koordinat UTM penuh (ratusan kilometer dalam mm) dan langsung
 * jadi "Awas" palsu. /api/deformasi menjaga hal yang sama lewat `valid1`.
 */
export function pergeseranMm(
  sekarang: BarisRts | undefined,
  acuan: BarisRts | undefined,
  rotasi: Parameters<typeof rotateEN>[2] | null
): number | null {
  if (!sekarang || !acuan) return null;

  let N1 = nfloat(sekarang.sensor8);
  let E1 = nfloat(sekarang.sensor9);
  const Z1 = nfloat(sekarang.sensor10);
  let N0 = nfloat(acuan.sensor8);
  let E0 = nfloat(acuan.sensor9);
  const Z0 = nfloat(acuan.sensor10);

  const sah1 = N1 !== 0 || E1 !== 0 || Z1 !== 0;
  const sah0 = N0 !== 0 || E0 !== 0 || Z0 !== 0;
  if (!sah1 || !sah0) return null;

  if (rotasi) {
    [E1, N1] = rotateEN(E1, N1, rotasi);
    [E0, N0] = rotateEN(E0, N0, rotasi);
  }

  const dE = E1 - E0;
  const dN = N1 - N0;
  // Koordinat UTM dalam meter; ambang t_site dalam mm.
  return Math.sqrt(dE * dE + dN * dN) * 1000;
}
