/**
 * Kolom ambang t_site — nama, urutan, dan validasinya.
 *
 * Murni (tanpa Prisma) supaya tab Ambang Batas (Master Data) bisa memakai
 * validasi yang SAMA dengan server untuk umpan balik seketika, tanpa menyalin
 * aturannya. Dipakai juga oleh site-validation.ts (POST/PUT site) dan
 * PUT /api/sites/[id]/ambang.
 *
 * Ambang punya halaman dan endpoint sendiri, terpisah dari form Data Site.
 * Angka inilah yang memutuskan pesan WhatsApp dan alarm dasbor, jadi
 * mengubahnya tidak boleh ikut terseret saat orang hanya membetulkan koordinat
 * atau warna badge.
 */

import type { StatusLabel } from "./ambang";

/** Kolom ambang di t_site, urut seperti ditampilkan. */
export const KOLOM_AMBANG = [
  "geser_normal_max",
  "geser_waspada_max",
  "geser_siaga_max",
  "laju_waspada_min",
  "laju_siaga_min",
  "laju_awas_min",
] as const;

export type KolomAmbang = (typeof KOLOM_AMBANG)[number];
export type AmbangPayload = Record<KolomAmbang, number>;

/**
 * Nama kolom dalam bahasa halaman ambang. Di sana `geser_normal_max` dibaca
 * sebagai "Waspada mulai" — batas atas Normal adalah tempat Waspada dimulai.
 */
const LABEL_AMBANG: Record<KolomAmbang, string> = {
  geser_normal_max: "Waspada mulai (pergeseran)",
  geser_waspada_max: "Siaga mulai (pergeseran)",
  geser_siaga_max: "Awas mulai (pergeseran)",
  laju_waspada_min: "Waspada mulai (kecepatan)",
  laju_siaga_min: "Siaga mulai (kecepatan)",
  laju_awas_min: "Awas mulai (kecepatan)",
};

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

/**
 * Ambang dari body PUT /api/sites/[id]/ambang. Setiap kolom WAJIB angka.
 *
 * Sengaja tanpa nilai bawaan, beda dengan normalizeBody(): kolom yang kosong di
 * halaman ambang harus ditolak, bukan diam-diam direset ke 50/100/200 mm.
 */
export function bacaAmbang(
  body: Record<string, unknown>
): { data: AmbangPayload; error?: undefined } | { data?: undefined; error: string } {
  const data = {} as AmbangPayload;
  for (const k of KOLOM_AMBANG) {
    const v = body[k];
    const n = v === null || v === undefined || v === "" ? NaN : Number(v);
    if (!Number.isFinite(n)) return { error: `${LABEL_AMBANG[k]} wajib diisi angka` };
    data[k] = n;
  }
  const error = validasiAmbang(data);
  return error ? { error } : { data };
}

// ─── Detail per site (GET /api/sites/[id]/ambang) ───────────────────────────

/** Satu prisma site beserta keadaan peringatannya yang terakhir. */
export interface PrismaAmbang {
  idPrisma: string;
  /** "bs" (backsight) atau "fs" (foresight). Keduanya ikut dinilai. */
  jenis: string;
  /** Tingkat yang DIAKUI jalur peringatan. Null = belum pernah dinilai. */
  tingkat: StatusLabel | null;
  /** Pergeseran terhadap acuan R0 pada siklus terakhir (mm). Null = tak terbaca. */
  nilaiMm: number | null;
  /** Siklus beruntun prisma ini gagal ditembak. */
  gagalBeruntun: number;
}

export interface KanalPeringatan {
  nama: "WhatsApp" | "Telegram" | "Email";
  aktif: boolean;
  /** Ringkasan tujuan tanpa nomor/ID, mis. "Grup Kolam BPP 1-4" atau "Belum disetel". */
  rincian: string;
}

export interface DetailAmbangSite {
  prisma: PrismaAmbang[];
  /** Waktu siklus terakhir yang dinilai, "YYYY-MM-DD HH:mm:ss" waktu lokal logger. */
  siklusTerakhir: string | null;
  /** Waktu sesi acuan R0. Null = belum ada; site tanpa R0 tidak dinilai sama sekali. */
  acuanR0: string | null;
  kanal: KanalPeringatan[];
}
