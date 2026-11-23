/**
 * Jadwal running: kapan sebuah baris `scheduling_task` harus memulai sesi.
 *
 * Aplikasi CI3 lama menjalankannya lewat cron tiap menit yang memanggil
 * `Kontrol/tes_cronjob`: cocokkan `days = date('N')` dan `time = date('H:i')`,
 * lalu kirim AutoTrackingStart. Saat pindah ke Next.js hanya layar
 * pengaturannya yang ikut, sehingga sejak itu tidak ada jadwal yang pernah
 * jalan. Pelaksananya sekarang POST /api/jadwal-running/jalankan, dipanggil
 * cron server tiap menit; berkas ini memutuskan apa yang jatuh tempo.
 *
 * Bedanya dengan aplikasi lama: cocok persis satu menit berarti satu cron yang
 * terlambat (server sibuk, restart) membuang jadwalnya. Di sini jadwal tetap
 * jatuh tempo selama JENDELA_TELAT_MENIT sesudah jamnya, dan pemanggil
 * memastikan sesinya dibuat sekali saja (belum ada sesi site itu sejak jam
 * jadwal).
 */

export interface BarisJadwal {
  id: string;
  nama: string;
  /** Hari ISO: Senin 1 … Minggu 7, sama dengan date('N') PHP aplikasi lama. */
  days: number;
  /** "HH:MM", jam dinding zona logger. */
  time: string;
  status: number;
}

export const JENDELA_TELAT_MENIT = 3;

export const NAMA_HARI = ["", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"] as const;

/** Hari ISO dari tanggal "YYYY-MM-DD". Null bila tanggalnya tidak sah. */
export function hariIso(tanggal: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(tanggal.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  const minggu0 = d.getUTCDay(); // 0 = Minggu
  return minggu0 === 0 ? 7 : minggu0;
}

/** "H:MM" / "HH:MM" / "HH:MM:SS" → menit sejak 00:00. Null bila rusak. */
export function menitDariJam(teks: string | null | undefined): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*$/.exec(teks ?? "");
  if (!m) return null;
  const j = Number(m[1]);
  const n = Number(m[2]);
  if (j > 23 || n > 59) return null;
  return j * 60 + n;
}

function duaDigit(n: number): string {
  return String(n).padStart(2, "0");
}

export type JatuhTempo = {
  baris: BarisJadwal;
  /** Awal menit jadwalnya, "YYYY-MM-DD HH:MM:00" — batas "sudah ada sesi sejak". */
  sejakDb: string;
};

/**
 * Jadwal aktif yang jatuh tempo pada `sekarang` (jam dinding zona logger,
 * "YYYY-MM-DD HH:mm:ss"): harinya hari ini dan jamnya di antara
 * (sekarang − JENDELA_TELAT_MENIT, sekarang]. Bila lebih dari satu, yang
 * jamnya paling akhir — yang lebih awal sudah diwakili sesi yang sama.
 *
 * Jendela tidak melintasi tengah malam: jadwal 23:59 yang telat ke 00:01
 * dilewatkan, karena harinya sudah berganti dan baris hari itu bukan lagi
 * "hari ini".
 */
export function jadwalJatuhTempo(daftar: BarisJadwal[], sekarang: string): JatuhTempo | null {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(sekarang.trim());
  if (!m) return null;
  const tanggal = m[1];
  const hari = hariIso(tanggal);
  const kini = Number(m[2]) * 60 + Number(m[3]);
  if (hari === null) return null;

  let pilih: { baris: BarisJadwal; menit: number } | null = null;
  for (const b of daftar) {
    if (Number(b.status) !== 1 || Number(b.days) !== hari) continue;
    const t = menitDariJam(b.time);
    if (t === null) continue;
    const telat = kini - t;
    if (telat < 0 || telat >= JENDELA_TELAT_MENIT) continue;
    if (!pilih || t > pilih.menit) pilih = { baris: b, menit: t };
  }
  if (!pilih) return null;
  return {
    baris: pilih.baris,
    sejakDb: `${tanggal} ${duaDigit(Math.floor(pilih.menit / 60))}:${duaDigit(pilih.menit % 60)}:00`,
  };
}
