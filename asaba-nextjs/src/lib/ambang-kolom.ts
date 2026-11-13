/**
 * Kolom ambang dan akurasi RTS di t_site — nama dan validasinya.
 *
 * Murni (tanpa Prisma). Dipakai site-validation.ts (POST/PUT site) dan
 * PUT /api/sites/[id], yang mengisi kolom-kolom ini dengan nilai lamanya bila
 * tidak ikut dikirim: angka inilah yang memutuskan pesan WhatsApp dan alarm
 * dasbor, jadi pemanggil yang tidak tahu-menahu soal ambang tidak boleh diam-diam
 * mereset-nya ke bawaan normalizeBody().
 */

/** Kolom ambang di t_site. */
export const KOLOM_AMBANG = [
  "geser_normal_max",
  "geser_waspada_max",
  "geser_siaga_max",
  "laju_waspada_min",
  "laju_siaga_min",
  "laju_awas_min",
] as const;

/** Kolom akurasi RTS di t_site (migrasi 021). */
export const KOLOM_AKURASI = [
  "rts_akurasi_sudut_detik",
  "rts_akurasi_jarak_mm",
  "rts_akurasi_jarak_ppm",
] as const;

export type KolomAmbang = (typeof KOLOM_AMBANG)[number];
export type AmbangPayload = Record<KolomAmbang, number>;

/** Urutan dan tanda ambang. Null = lolos. */
export function validasiAmbang(d: AmbangPayload): string | null {
  if (!(d.geser_normal_max > 0)) return "Batas Waspada pergeseran harus lebih dari 0 mm";
  if (!(d.geser_normal_max < d.geser_waspada_max && d.geser_waspada_max < d.geser_siaga_max))
    return "Ambang pergeseran harus menaik: Waspada < Siaga < Awas";
  if (!(d.laju_waspada_min >= 0)) return "Batas Waspada kecepatan tidak boleh negatif";
  if (!(d.laju_waspada_min < d.laju_siaga_min && d.laju_siaga_min < d.laju_awas_min))
    return "Ambang kecepatan harus menaik: Waspada < Siaga < Awas";
  return null;
}
