/**
 * Toleransi pemicu ambang dari akurasi RTS yang melayani site.
 *
 * RTS tidak mengirim ukuran mutu per tembakan — tidak ada simpangan baku atau
 * sejenisnya di payload. Yang bisa dipakai adalah spesifikasi alatnya, yang
 * diisi per site di Master Data → Site (`t_site.rts_akurasi_*`, migrasi 021):
 *
 *   sudut  σθ  detik busur      (mis. 2″)
 *   jarak  a + b·ppm            (mis. 2 mm + 2 ppm)
 *
 * Galat posisi satu tembakan pada jarak D (meter):
 *
 *   melintang  D · σθ          (sudut × jarak; dominan untuk prisma jauh)
 *   membujur   a + b · D / 1000 (ppm: 1 ppm dari 1 km = 1 mm)
 *   posisi     √(melintang² + membujur²)
 *
 * Pergeseran adalah SELISIH dua tembakan (sekarang dan acuan R0), masing-masing
 * dengan galat itu, jadi toleransinya √2 × galat posisi. Ini satu simpangan baku
 * — sama dengan cara pabrik menuliskan spesifikasi (ISO 17123).
 *
 * Toleransi DITAMBAHKAN ke ambang pergeseran prisma itu: Waspada 35 mm untuk
 * prisma 1,1 km dari alat 2″ (toleransi ± 17 mm) baru terpicu di atas ± 52 mm.
 * Prisma dekat hampir tidak terpengaruh — 200 m dari alat yang sama ± 4 mm.
 *
 * Murni: tanpa Prisma, bisa dibundel ke peramban (form Site memakainya untuk
 * menampilkan contoh toleransi).
 */
import type { AmbangSite } from "@/lib/ambang";

export interface AkurasiRts {
  /** Akurasi sudut, detik busur. */
  sudutDetik: number;
  /** Akurasi jarak, bagian tetap (mm). */
  jarakMm: number;
  /** Akurasi jarak, bagian sebanding jarak (ppm). */
  jarakPpm: number;
}

/**
 * Dipakai bila spesifikasi alatnya belum diisi: kelas robotic total station 2″
 * yang umum. Sengaja tidak yang paling teliti — menebak alat lebih teliti dari
 * aslinya justru mengembalikan alarm palsu yang hendak disaring.
 */
export const AKURASI_BAWAAN: AkurasiRts = { sudutDetik: 2, jarakMm: 2, jarakPpm: 2 };

/** Detik busur per radian. */
const DETIK_PER_RADIAN = 206_264.806;

/** Toleransi pergeseran (mm) untuk prisma sejauh `jarakM` meter dari RTS. */
export function toleransiMm(jarakM: number, a: AkurasiRts): number {
  if (!Number.isFinite(jarakM) || jarakM <= 0) return 0;
  const melintang = jarakM * 1000 * (a.sudutDetik / DETIK_PER_RADIAN);
  const membujur = a.jarakMm + (a.jarakPpm * jarakM) / 1000;
  return Math.SQRT2 * Math.hypot(melintang, membujur);
}

/**
 * Ambang pergeseran prisma ini: ambang site ditambah toleransinya. Ambang
 * kecepatan tidak disentuh — ia tidak ikut memicu peringatan.
 */
export function ambangDenganToleransi(ambang: AmbangSite, toleransi: number): AmbangSite {
  const t = Math.max(0, toleransi);
  return {
    geser: {
      normalMax: ambang.geser.normalMax + t,
      waspadaMax: ambang.geser.waspadaMax + t,
      siagaMax: ambang.geser.siagaMax + t,
    },
    laju: ambang.laju,
  };
}

/** Validasi isian akurasi di form Site. Null = lolos. */
export function validasiAkurasi(a: AkurasiRts): string | null {
  if (!(a.sudutDetik > 0 && a.sudutDetik <= 30)) return "Akurasi sudut RTS harus antara 0 dan 30 detik";
  if (!(a.jarakMm >= 0 && a.jarakMm <= 50)) return "Akurasi jarak RTS (mm) harus antara 0 dan 50";
  if (!(a.jarakPpm >= 0 && a.jarakPpm <= 50)) return "Akurasi jarak RTS (ppm) harus antara 0 dan 50";
  return null;
}
