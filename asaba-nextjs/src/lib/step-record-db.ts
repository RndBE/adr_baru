import type { Prisma } from "@prisma/client";
import { sendRtsStepRecord } from "@/lib/mqtt";
import { getLoggerForSite } from "@/lib/sites";
import {
  nomorSlot,
  rencanaStepRecord,
  type HasilStepRecord,
  type RencanaStepRecord,
} from "@/lib/step-record";

/**
 * Sisi database + MQTT dari stepRecord, dipakai bersama oleh Hapus dan Isi
 * slot di Prism Config. Aturannya sengaja di satu tempat: dua jalur yang
 * menghitung jumlah prisma sendiri-sendiri pasti akhirnya berbeda pendapat.
 */

export type CatatanStepRecord = { rencana: RencanaStepRecord; adaConfig: boolean };

/**
 * Hitung stepRecord dari t_prisma site ini dan tulis ke config_adr.
 *
 * Menerima klien transaksi supaya pemanggil bisa menyatukannya dengan
 * perubahan t_prisma — RTS Config tidak boleh menampilkan jumlah yang
 * membantah daftar slot, walau sesaat.
 */
export async function catatStepRecord(
  tx: Prisma.TransactionClient,
  site: string
): Promise<CatatanStepRecord> {
  const sisa = await tx.$queryRaw<Array<{ id_prisma: string }>>`
    SELECT id_prisma FROM t_prisma WHERE site = ${site}
  `;
  const rencana = rencanaStepRecord(
    sisa.map((r) => nomorSlot(String(r.id_prisma))).filter((n): n is number => n !== null)
  );

  // Dicek lewat SELECT, bukan jumlah baris hasil UPDATE: MySQL menghitung
  // 0 baris berubah bila step_record-nya kebetulan sudah sama.
  const config = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM config_adr WHERE site = ${site} LIMIT 1
  `;
  const adaConfig = config.length > 0;

  // 0 tidak ditulis. RTS Config mengirimnya sebagai `parseInt(...) || 5`,
  // jadi angka 0 di sini justru berubah jadi 5 saat Simpan berikutnya.
  if (adaConfig && rencana.jumlah > 0) {
    await tx.$executeRaw`UPDATE config_adr SET step_record = ${rencana.jumlah} WHERE site = ${site}`;
  }
  return { rencana, adaConfig };
}

/**
 * Kirim stepRecord hasil catatStepRecord() ke logger site ini.
 *
 * Dipanggil SESUDAH transaksinya commit: perintah ke perangkat tidak bisa
 * di-rollback. `kirimLogger` false saat logger terputus — angkanya tetap
 * tercatat, dan Simpan berikutnya di RTS Config yang mengirimnya.
 */
export async function kirimStepRecord(
  site: string,
  { rencana, adaConfig }: CatatanStepRecord,
  kirimLogger: boolean
): Promise<HasilStepRecord> {
  const dicatat = adaConfig && rencana.jumlah > 0;
  const hasil = (dikirim: boolean, alasan: string | null): HasilStepRecord => ({
    ...rencana,
    dicatat,
    dikirim,
    alasan,
  });

  if (rencana.jumlah === 0) {
    return hasil(
      false,
      "Tidak ada prisma tersisa di site ini. Step record tidak diubah karena 0 belum tentu " +
        "diterima firmware — hentikan jadwal pengukuran dari Kontrol ADR."
    );
  }
  if (!adaConfig) {
    return hasil(
      false,
      "Konfigurasi RTS site ini belum ada, jadi step record tidak bisa dicatat. " +
        "Isi dulu di Kontrol ADR → RTS Config."
    );
  }
  if (!kirimLogger) {
    return hasil(
      false,
      `Logger terputus. Step record ${rencana.jumlah} baru dicatat di aplikasi — ` +
        "kirim lewat Simpan di RTS Config setelah logger terhubung."
    );
  }

  // Logger diturunkan dari SITE, tanpa fallback ke "logger ADR pertama":
  // perintah yang nyasar mengubah jumlah tembakan RTS milik site lain.
  const idLogger = await getLoggerForSite(site);
  if (!idLogger) {
    return hasil(false, `Logger untuk site "${site}" tidak ditemukan, step record tidak dikirim.`);
  }

  const dikirim = await sendRtsStepRecord(idLogger, rencana.jumlah);
  return hasil(
    dikirim,
    dikirim
      ? null
      : "Perintah tidak sampai ke broker MQTT. Step record sudah dicatat di aplikasi — " +
          "kirim ulang lewat Simpan di RTS Config."
  );
}
