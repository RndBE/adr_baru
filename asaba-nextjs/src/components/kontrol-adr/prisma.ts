/**
 * Baris temp_prisma dari /api/prisma-data.
 *
 * Dipindahkan keluar dari halaman supaya tabel hasil dan penerjemah statusnya
 * memakai satu definisi yang sama — sebelumnya keduanya hidup di berkas
 * halaman, dan aturan "nilai 0 berarti belum diukur" bisa menyimpang antara
 * yang menghitung status dan yang menampilkannya.
 */
export type TempPrisma = {
  id: number;
  id_prisma: string;
  waktu: string;
  N1: string;
  E1: string;
  Z1: string;
  N0: string;
  E0: string;
  Z0: string;
  status_get: number; // 1=success, 0=failed, 2=running
  HA: number | null;
  VA: number | null;
  SlopDis: number | null;
};

/**
 * "Running..."    – sesi kontrol sedang berjalan, menunggu hasil tembakan
 * "Menunggu"      – status di-reset tapi tidak ada sesi berjalan
 * "Belum diukur"  – prisma terdaftar tapi belum pernah ditembak sama sekali
 */
export type PrismaStatus = "Success" | "Failed" | "Running..." | "Menunggu" | "Belum diukur";

export type PrismaCard = {
  name: string;
  status: PrismaStatus;
  y: string;
  x: string;
  z: string;
  waktu?: string;
};

/**
 * Prisma yang belum pernah diukur menyimpan '0' di temp_prisma. Menampilkannya
 * apa adanya membuatnya terbaca seperti koordinat nol yang sah, padahal artinya
 * "tidak ada data" — jadi ditampilkan sebagai tanda hubung.
 */
export function nilaiPrisma(status: PrismaStatus, nilai: string): string {
  if (status === "Belum diukur" || status === "Menunggu") return "–";
  return nilai;
}

/**
 * Terjemahkan baris temp_prisma menjadi status kartu.
 *
 * `status_get = 0` di DB mencampur DUA keadaan yang berbeda: "sedang menunggu
 * hasil tembakan" dan "belum pernah diukur sama sekali". Dulu keduanya
 * diterjemahkan jadi "Running...", sehingga prisma yang tidak pernah tertembak
 * berputar selamanya meski tidak ada kontrol yang berjalan.
 *
 * Pembedanya dua hal yang memang tersedia:
 *   - `kontrolBerjalan` — apakah RTS sedang menjalankan sesi (sensor16).
 *   - `waktu` — prisma yang belum pernah diukur nilainya '-' atau kosong.
 */
export function mapStatus(
  status_get: number | string,
  n1: string,
  e1: string,
  z1: string,
  kontrolBerjalan: boolean,
  waktu?: string | null
): PrismaStatus {
  // Gunakan String() karena dari raw query Prisma bisa berupa number atau string
  if (String(status_get) === "0") {
    if (kontrolBerjalan) return "Running...";
    const pernahDiukur = !!waktu && waktu !== "-" && waktu.trim() !== "";
    return pernahDiukur ? "Menunggu" : "Belum diukur";
  }

  // Jika sudah Done (1) tapi nilainya 0 semua, berarti Failed / Not Found
  if (Number(n1) === 0 && Number(e1) === 0 && Number(z1) === 0) {
    return "Failed";
  }

  return "Success";
}

/**
 * Warna dan label per status kartu prisma.
 *
 * "Success"/"Failed" memakai token status yang sama dengan seluruh aplikasi.
 * Tiga keadaan lainnya BUKAN penilaian atas hasil ukur — mereka keadaan proses,
 * jadi diberi warna tinta netral supaya tidak tertukar dengan Normal/Awas yang
 * berarti tingkat bahaya pergeseran.
 */
export const RUPA_STATUS: Record<
  PrismaStatus,
  { label: string; warna: string; berputar?: boolean }
> = {
  Success: { label: "Berhasil", warna: "var(--st-normal)" },
  Failed: { label: "Gagal", warna: "var(--st-awas)" },
  "Running...": { label: "Mengukur", warna: "var(--navy)", berputar: true },
  Menunggu: { label: "Menunggu", warna: "var(--ink-3)" },
  "Belum diukur": { label: "Belum diukur", warna: "var(--ink-3)" },
};
