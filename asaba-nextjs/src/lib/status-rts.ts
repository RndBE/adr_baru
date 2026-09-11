/**
 * Status perangkat — satu rumus, dipakai semua halaman.
 *
 * Sebelumnya rumusnya ditulis ulang di dua tempat dan LABELNYA dipakai untuk
 * dua hal berbeda, sehingga halaman yang dibuka bersamaan bisa saling
 * membantah:
 *
 *   Beranda        "RTS terputus"    ← data segar DAN instrumen menyala
 *   Prism Config   "RTS terhubung"   ← data segar saja
 *   Kontrol ADR    "Logger terhubung" + "Tidak aktif"
 *
 * Ketiganya benar menurut rumusnya masing-masing, dan itulah masalahnya: kata
 * "RTS" dipakai untuk dua besaran yang berbeda. Operator tidak punya cara tahu
 * yang mana yang sedang dijawab.
 *
 * DUA FAKTA TERPISAH, dan keduanya perlu:
 *
 *   Logger terhubung — kotak logger masih mengirim data berkala. Kalau tidak,
 *                      aplikasi buta: tidak ada yang bisa dipercaya di layar.
 *   RTS menyala      — total station-nya sendiri hidup. Logger bisa terus
 *                      mengirim data sementara instrumennya mati; itu keadaan
 *                      yang lazim, bukan kelainan.
 *
 * Menyatukan keduanya jadi satu lampu akan menyembunyikan satu-satunya
 * perbedaan yang menentukan apakah perintah instrumen bisa dijalankan.
 */
import { waktuMsWib } from "@/components/monitoring/format";

/**
 * Batas data dianggap segar.
 *
 * Satu jam, bukan beberapa menit: selang kirim data (`send_data`) bisa disetel
 * sampai jam-jaman, jadi batas yang ketat akan menyebut logger sehat sebagai
 * terputus setiap kali selangnya dinaikkan.
 */
export const BATAS_DATA_SEGAR_MS = 60 * 60 * 1000;

export type StatusRts = {
  /** Data berkala terakhir masuk dalam BATAS_DATA_SEGAR_MS. */
  loggerTerhubung: boolean;
  /** Instrumen hidup — sensor14. */
  rtsMenyala: boolean;
  /** Instrumen sedang menjalankan siklus — sensor16. */
  rtsMengukur: boolean;
  /**
   * Instrumen bisa diperintah: menyala atau sedang mengukur, DAN loggernya
   * masih mengirim. Tanpa syarat terakhir, sensor14 yang basi dari kemarin
   * akan terbaca sebagai instrumen yang menyala sekarang.
   */
  rtsAktif: boolean;
  /** Label siap pakai, seragam di seluruh aplikasi. */
  labelRts: "Sedang mengukur" | "Menyala, siap" | "Tidak aktif";
};

export function hitungStatusRts(
  waktu: string | Date | null | undefined,
  sensor14: unknown,
  sensor16: unknown,
  nowMs: number = Date.now()
): StatusRts {
  const ms = waktuMsWib(waktu);
  const loggerTerhubung = ms !== null && ms >= nowMs - BATAS_DATA_SEGAR_MS;

  // Dibandingkan sebagai string: kolom sensor datang sebagai angka dari satu
  // jalur dan string dari jalur lain, dan Number("") yang menghasilkan 0
  // menyamarkan kolom kosong sebagai "mati" yang meyakinkan.
  const rtsMenyala = String(sensor14) === "1";
  const rtsMengukur = String(sensor16) === "1";
  const rtsAktif = loggerTerhubung && (rtsMenyala || rtsMengukur);

  return {
    loggerTerhubung,
    rtsMenyala,
    rtsMengukur,
    rtsAktif,
    labelRts: rtsMengukur && loggerTerhubung
      ? "Sedang mengukur"
      : rtsAktif
        ? "Menyala, siap"
        : "Tidak aktif",
  };
}
