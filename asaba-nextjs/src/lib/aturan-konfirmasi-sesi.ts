/**
 * Konfirmasi beberapa sesi: tingkat baru diakui hanya bila N tembakan
 * berturut-turut prisma itu semuanya mencapainya — aturan murni.
 *
 * Masukan dari lapangan 27 Nov 2026. Pada uji Kolam BPP hari itu (R0 125815,
 * sesi tiap ±7 menit) P4 terbaca 46,9 → 37,9 → 27,1 → 52,3 → 32,4 → 52,3 mm,
 * berganti-ganti Waspada dan Normal. Dengan satu sesi per keputusan (sejak 23 Nov),
 * tiap loncatan menyalakan sirene dan mengirim WhatsApp, lalu sesi berikutnya
 * memadamkannya lagi.
 *
 * Aturannya: nilai yang dibandingkan dengan ambang = pergeseran TERKECIL dari N
 * tembakan sah terakhir prisma itu (sesi ini dan N−1 sebelumnya). Jadi untuk
 * naik ke Waspada, semua N harus Waspada atau lebih. Waspada lalu Siaga diakui
 * Waspada; Siaga baru diakui sesudah N tembakan Siaga beruntun. Turun tidak
 * ditahan: satu tembakan Normal sudah cukup (histeresis di peredam.ts tetap
 * berlaku).
 *
 * Sesi yang tidak menembak prisma itu (sesi terhenti, gagal bidik, bacaan tak
 * wajar) dilewati — di uji 27 Nov tiga dari sepuluh sesi hanya menembak P1/P2.
 * Bila sejak R0, atau sejak acuan prisma itu berganti, belum ada N−1 tembakan
 * sah sebelumnya, kenaikan belum bisa dipastikan dan tingkatnya ditahan di
 * yang sudah diakui.
 *
 * Harganya: pergeseran sungguhan baru berbunyi di tembakan ke-N yang melewati
 * ambang, terlambat N−1 sesi. Pada jadwal ±7 menit itu ±7 menit per sesi.
 *
 * Diputar ulang pada data 27 Nov (R0 125815, 10 sesi): N = 1 menghasilkan 14
 * perubahan tingkat (sama dengan produksi), N = 2 hanya 5. P4 tinggal sekali
 * Waspada (46,9 lalu 37,9 — dua tembakan beruntun yang memang sama-sama
 * Waspada) dan 52,3 → 32,4 → 52,3 sesudahnya tidak memicu lagi.
 *
 * Disetel per site (t_site.konfirmasi_sesi, migrasi 028), bawaan 2. Nilai 1 =
 * perilaku 23–27 Nov: tiap sesi langsung menentukan.
 */

export const KONFIRMASI_SESI_BAWAAN = 2;
export const KONFIRMASI_SESI_MIN = 1;
export const KONFIRMASI_SESI_MAKS = 5;

/** Galat pengaturan, atau null bila sah. */
export function validasiKonfirmasiSesi(n: number): string | null {
  if (!Number.isInteger(n) || n < KONFIRMASI_SESI_MIN || n > KONFIRMASI_SESI_MAKS) {
    return `Konfirmasi sesi harus bilangan bulat ${KONFIRMASI_SESI_MIN}–${KONFIRMASI_SESI_MAKS}`;
  }
  return null;
}

/** Banyak sesi SEBELUM sesi ini yang ikut menentukan. */
export function sesiSebelumnyaPerlu(sesi: number): number {
  return Math.max(0, Math.floor(sesi) - 1);
}

export interface Pemicu {
  /** Nilai yang dibandingkan dengan ambang: terkecil dari bacaan yang ada. */
  nilaiMm: number;
  /** False bila belum ada N−1 tembakan sah sebelumnya: kenaikan ditahan. */
  bolehNaik: boolean;
}

/**
 * Nilai pemicu satu prisma.
 *
 * @param sekarang    pergeseran sesi ini (sudah sah), mm
 * @param sebelumnya  N−1 tembakan sah sebelumnya prisma ini, TERBARU dulu;
 *                    null = tidak ada (belum cukup tembakan). Hanya N−1 pertama dipakai.
 * @param sesi        N, dari pengaturan site
 */
export function pemicuKonfirmasi(
  sekarang: number,
  sebelumnya: ReadonlyArray<number | null>,
  sesi: number
): Pemicu {
  const perlu = sesiSebelumnyaPerlu(sesi);
  const dipakai = sebelumnya.slice(0, perlu);
  const sah = dipakai.filter((v): v is number => v !== null && Number.isFinite(v));
  return { nilaiMm: Math.min(sekarang, ...sah), bolehNaik: sah.length === perlu };
}

/**
 * Jarak "bergeser lagi" sesudah konfirmasi atau sesudah bunyi dimatikan, dengan
 * aturan yang sama: terkecil dari N tembakan. Null bila tembakan ini atau salah
 * satu dari N−1 sebelumnya tidak punya jarak — bunyi tidak dinyalakan lagi
 * dari satu tembakan saja.
 *
 * Tembakan sebelumnya yang lebih tua dari posisi saat konfirmasi dianggap tidak
 * punya jarak (pemanggil yang menyaring), jadi bunyi menyala lagi hanya bila N
 * tembakan SESUDAH konfirmasi semuanya bergeser.
 */
export function geserTerkonfirmasi(
  sekarang: number | null,
  sebelumnya: ReadonlyArray<number | null>,
  sesi: number
): number | null {
  if (sekarang === null) return null;
  const perlu = sesiSebelumnyaPerlu(sesi);
  const dipakai = sebelumnya.slice(0, perlu);
  if (dipakai.length < perlu || dipakai.some((v) => v === null)) return null;
  return Math.min(sekarang, ...(dipakai as number[]));
}
