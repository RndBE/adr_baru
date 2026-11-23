/**
 * Apakah RTS sedang menjalankan sesi, dibaca dari basis data.
 *
 * Dipakai perintah yang tidak boleh menyela sesi berjalan: rekam ulang arah
 * bidik (memutar teleskop) dan pelaksana jadwal running (memulai sesi baru).
 * Aturannya — termasuk mengabaikan tanda yang lebih tua dari 10 menit — ada di
 * alasanRtsSibuk() dan dikunci rekam-arah.test.ts.
 */
import { prisma } from "@/lib/prisma";
import { offsetLogger } from "@/lib/sites";
import { waktuDbLokal } from "@/components/monitoring/format";
import { alasanRtsSibuk } from "@/lib/rekam-arah";

/** Alasan RTS tidak boleh diganggu sekarang, atau null bila bebas. */
export async function rtsSibuk(idLogger: string): Promise<string | null> {
  const [kontrol, temp] = await Promise.all([
    prisma.$queryRaw<Array<{ status: number; status_manual: number; mulai: string | null }>>`
      SELECT status, status_manual, DATE_FORMAT(datetime, '%Y-%m-%d %H:%i:%s') AS mulai
      FROM set_tempkontrol WHERE id_logger = ${idLogger} LIMIT 1
    `,
    prisma.$queryRaw<Array<{ sensor16: unknown; waktu: string | null }>>`
      SELECT sensor16, DATE_FORMAT(waktu, '%Y-%m-%d %H:%i:%s') AS waktu
      FROM temp_rts WHERE code_logger = ${idLogger} LIMIT 1
    `,
  ]);
  const sekarang = waktuDbLokal(new Date(), await offsetLogger(idLogger));
  const kt = kontrol[0];
  return alasanRtsSibuk(
    kt ? { status: kt.status, statusManual: kt.status_manual, mulai: kt.mulai } : null,
    temp[0] ?? null,
    sekarang
  );
}
