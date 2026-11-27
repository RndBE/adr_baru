/**
 * Membaca satu kiriman telemetri ADR — aturan murni, tanpa I/O.
 *
 * Firmware BL1100-v2.9.1 (OTA logger 30002, akhir November 2026) mengubah tiga
 * hal yang menyentuh pemrosesan data masuk (datamasuk-adr.ts):
 *
 *   1. Laporan menit TIDAK lagi mengulang tembakan terakhir. Di laporan menit
 *      ID target (sensor1), IH, PN, TH, SD, N, E, Z bernilai "0". Baris ber-ID
 *      "0" bukan tembakan: tetap disimpan (membawa sensor16 dan telemetri
 *      logger), tapi tidak boleh menyentuh prisma, sesi, atau penilaian.
 *   2. SD = 0 berarti target GAGAL. Dikirim sekali, dan tidak boleh dipakai
 *      untuk pergeseran maupun orientasi BS — koordinatnya dipaksa nol supaya
 *      seluruh pembaca lama (yang mengenali gagal dari N/E/Z nol) ikut benar.
 *   3. Sudut desimal: ADR.HA_des / ADR.VA_des, angka dalam GON (89.9822 =
 *      teks "089,98,22"). Dipakai lebih dulu; teks HA/VA tetap jadi cadangan
 *      untuk firmware lama. Label satuan ("dms"/"gon") tidak dipakai sama
 *      sekali — firmware lama menulis "dms" padahal isinya gon.
 *
 * Aturan 1 dan 2 aman untuk firmware lama: di sana laporan menit di luar
 * siklus juga ber-ID "0", dan tembakan gagal juga tidak membawa jarak.
 */

export type JenisKiriman = "bukan-tembakan" | "gagal" | "tembakan";

/**
 * Jenis kiriman dari ID target (sensor1) dan jarak miring (sensor7).
 * ID kosong atau "0" = bukan tembakan. SD bukan angka positif = gagal.
 */
export function jenisKiriman(idTarget: unknown, sd: unknown): JenisKiriman {
  const id = String(idTarget ?? "").trim();
  if (id === "" || id === "0") return "bukan-tembakan";
  const jarak = Number(String(sd ?? "").trim().replace(",", "."));
  if (!Number.isFinite(jarak) || jarak <= 0) return "gagal";
  return "tembakan";
}

/**
 * Sudut desimal (gon) dari ADR.HA_des / ADR.VA_des. Null bila kosong, bukan
 * angka, nol (cara firmware menandai sudut tak terisi), atau di luar 0–400.
 */
export function sudutDesimal(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n >= 400) return null;
  return n;
}

/** Selisih (gon) di atas mana teks dan desimal dianggap tidak cocok. */
export const BEDA_SUDUT_GON = 0.0002;

/**
 * Sudut yang dipakai menghitung koordinat: desimal bila ada, selain itu teks
 * apa adanya (dibaca bacaSudut() di koreksi-azimut.ts).
 *
 * `beda` diisi bila keduanya ada tapi berselisih lebih dari BEDA_SUDUT_GON —
 * tanda format teksnya dibaca lain oleh firmware. Desimal tetap yang dipakai.
 */
export function pilihSudut(
  teks: unknown,
  desimal: unknown,
  bacaTeks: (v: unknown) => number | null
): { nilai: unknown; dari: "desimal" | "teks"; beda: number | null } {
  const d = sudutDesimal(desimal);
  if (d === null) return { nilai: teks, dari: "teks", beda: null };
  const t = bacaTeks(teks);
  const beda = t !== null && t !== 0 && Math.abs(t - d) > BEDA_SUDUT_GON ? t - d : null;
  return { nilai: d, dari: "desimal", beda };
}
