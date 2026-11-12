/**
 * stepRecord = jumlah prisma yang ditembak RTS dalam satu siklus.
 *
 * Nilainya diturunkan dari slot yang terdaftar di t_prisma, bukan diketik
 * tangan di RTS Config. Dulu menghapus prisma di Prism Config hanya menghapus
 * baris di database — stepRecord di logger tetap angka lama, jadi RTS terus
 * menembak slot yang sudah tidak dipakai aplikasi sampai operator ingat
 * mengubahnya sendiri di RTS Config.
 *
 * Sengaja murni dan tanpa impor supaya bisa diuji tanpa database:
 *   npx tsx src/lib/step-record.test.ts
 */

export type RencanaStepRecord = {
  /** Nilai stepRecord yang seharusnya: banyaknya slot terisi. */
  jumlah: number;
  /** true bila slot terisi tepat 1..jumlah tanpa lubang. */
  berurutan: boolean;
  /** Slot di dalam 1..jumlah yang kosong. */
  kosong: number[];
  /** Slot terisi yang nomornya melebihi jumlah. */
  diLuar: number[];
};

/** Jawaban server setelah stepRecord dihitung ulang (lib/step-record-db.ts). */
export type HasilStepRecord = RencanaStepRecord & {
  /** config_adr.step_record sudah ditulis. */
  dicatat: boolean;
  /** Sampai ke broker MQTT — BUKAN bukti logger menerimanya; itu ack `updated`. */
  dikirim: boolean;
  /** Kenapa tidak dicatat atau tidak dikirim; null bila keduanya jalan. */
  alasan: string | null;
};

/** Nomor slot dari id_prisma "P7" → 7; selain itu null. */
export function nomorSlot(idPrisma: string): number | null {
  const m = /^P(\d+)$/i.exec(idPrisma.trim());
  return m ? Number(m[1]) : null;
}

/**
 * Hitung stepRecord dari slot yang masih terisi, dan laporkan bila slotnya
 * tidak berurutan dari 1.
 *
 * Urutan penting karena menghapus prisma di aplikasi TIDAK mengosongkan slot
 * di RTS — tidak ada perintah firmware untuk itu, hanya `recordTarget` untuk
 * mengisi. Kalau P1 dan P2 terisi lalu P1 dihapus, stepRecord menjadi 1 dan
 * RTS masih menyimpan target lama di slot 1, sementara P2 yang tersisa ada di
 * luar jangkauan. Jumlahnya benar, slot yang ditembak salah — dan itu hanya
 * terlihat dari datanya berhari-hari kemudian.
 */
export function rencanaStepRecord(slotTerisi: number[]): RencanaStepRecord {
  const unik = [...new Set(slotTerisi.filter((n) => Number.isInteger(n) && n > 0))].sort(
    (a, b) => a - b
  );
  const jumlah = unik.length;
  const ada = new Set(unik);
  const kosong: number[] = [];
  for (let i = 1; i <= jumlah; i++) if (!ada.has(i)) kosong.push(i);
  const diLuar = unik.filter((n) => n > jumlah);
  return { jumlah, berurutan: kosong.length === 0, kosong, diLuar };
}
