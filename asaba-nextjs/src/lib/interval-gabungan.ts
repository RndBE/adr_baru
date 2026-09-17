/**
 * Serapat apa pembacaan dirapatkan sebelum digambar di Analisa Gabungan.
 *
 * Ada di modul sendiri karena dipakai dua sisi yang tidak boleh berbeda
 * pendapat: /api/analisa-gabungan menyusun SQL-nya dari sini, halaman
 * menyusun tombol pilihannya dari sini. Sebelum ini aturannya hanya hidup
 * sebagai satu baris `rentangHari > 2` di dalam rute — tidak bisa dipilih
 * operator, dan tidak bisa dites.
 *
 * Jalankan tes: npx tsx src/lib/interval-gabungan.test.ts
 */

/** Pilihan yang boleh diminta. "auto" diputuskan dari panjang rentang. */
export const INTERVAL = ["auto", "mentah", "jam", "hari"] as const;
export type IntervalGabungan = (typeof INTERVAL)[number];

/** Hasil keputusan — "auto" tidak pernah sampai ke SQL. */
export type IntervalRapat = Exclude<IntervalGabungan, "auto">;

/**
 * Ambang keputusan mode otomatis, dalam hari.
 *
 * `AUTO_JAM` sudah dipakai sejak rute ini ada, dan disamakan dengan
 * /api/analisa supaya grafik di dua halaman tidak merapatkan titik pada
 * rentang yang sama dengan cara berbeda.
 *
 * `AUTO_HARI` baru. Sebelumnya mode otomatis berhenti di "per jam" untuk
 * rentang sepanjang apa pun, jadi rentang setahun meminta ~8.800 titik per
 * prisma dan terpotong di batas baris — grafiknya lalu berakhir di tengah
 * rentang tanpa ada yang salah di layar selain bendera "terpotong".
 */
export const AUTO_JAM = 2;
export const AUTO_HARI = 60;

/** Nama pilihan di layar. */
export const LABEL_INTERVAL: Record<IntervalGabungan, string> = {
  auto: "Otomatis",
  mentah: "Data mentah",
  jam: "Per jam",
  hari: "Per hari",
};

/** Keterangan tombol saat ditunjuk kursor. */
export const JUDUL_INTERVAL: Record<IntervalGabungan, string> = {
  auto: `Dipilihkan dari panjang rentang: sampai ${AUTO_JAM} hari data mentah, sampai ${AUTO_HARI} hari per jam, lebih panjang dari itu per hari`,
  mentah: "Setiap pembacaan apa adanya, tanpa dirata-rata",
  jam: "Pembacaan dalam satu jam dirata-rata jadi satu titik",
  hari: "Pembacaan dalam satu hari dirata-rata jadi satu titik",
};

/** Keterangan cara pembacaan dirapatkan — untuk kaki grafik dan lembar Excel. */
export const KETERANGAN_RAPAT: Record<IntervalRapat, string> = {
  mentah: "tiap pembacaan",
  jam: "dirata-rata per jam",
  hari: "dirata-rata per hari",
};

/** Parameter URL → pilihan; null bila tidak dikenali. */
export function bacaInterval(v: string | null | undefined): IntervalGabungan | null {
  if (v === null || v === undefined || v === "") return "auto";
  return (INTERVAL as readonly string[]).includes(v) ? (v as IntervalGabungan) : null;
}

/**
 * Pilihan operator + panjang rentang → mode yang benar-benar dipakai SQL.
 *
 * Pilihan yang disebut operator SELALU dituruti, sepanjang apa pun rentangnya.
 * Meminta data mentah setahun memang akan terpotong di batas baris, dan itu
 * dilaporkan lewat bendera `terpotong` — lebih jujur daripada diam-diam
 * mengirim rata-rata per jam sambil diberi label "mentah".
 */
export function resolusiInterval(
  pilihan: IntervalGabungan,
  rentangHari: number
): IntervalRapat {
  if (pilihan !== "auto") return pilihan;
  if (rentangHari > AUTO_HARI) return "hari";
  if (rentangHari > AUTO_JAM) return "jam";
  return "mentah";
}

/**
 * Format DATE_FORMAT MySQL yang memberi seluruh pembacaan dalam satu ember
 * stempel yang PERSIS sama.
 *
 * Kesamaan persis itu bukan kebetulan yang boleh hilang: seriGabungan()
 * mengelompokkan titik jadi satu "running" lewat jarak antar stempel, jadi
 * seluruh prisma pada ember yang sama harus berbagi stempel yang identik agar
 * jatuh pada satu baris grafik.
 */
export const FORMAT_STEMPEL: Record<IntervalRapat, string> = {
  mentah: "%Y-%m-%d %H:%i:%s",
  jam: "%Y-%m-%d %H:00:00",
  hari: "%Y-%m-%d 00:00:00",
};
