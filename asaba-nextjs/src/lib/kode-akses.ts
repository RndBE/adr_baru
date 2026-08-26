/**
 * Kode akses — kredensial yang membuka perintah kontrol RTS.
 *
 * Disimpan sebagai hash MD5 (skema warisan, dipakai bersama app lama). Kode
 * aslinya tidak pernah tersimpan dan tidak bisa dibaca kembali — mengganti kode
 * berarti menimpanya, bukan "melihat yang lama".
 */
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

/** Hash yang dipakai untuk mencocokkan kode akses. */
export function hashKode(kode: string): string {
  return createHash("md5").update(kode).digest("hex");
}

export type StatusKode = "aktif" | "belum-berlaku" | "kedaluwarsa";

/** Status berdasarkan rentang berlaku, dibandingkan terhadap tanggal (bukan jam). */
export function statusKode(
  mulai: Date,
  selesai: Date,
  sekarang: Date = new Date()
): StatusKode {
  const hariIni = tanggalSaja(sekarang);
  if (hariIni < tanggalSaja(mulai)) return "belum-berlaku";
  if (hariIni > tanggalSaja(selesai)) return "kedaluwarsa";
  return "aktif";
}

/** Buang komponen jam supaya perbandingan murni per tanggal. */
function tanggalSaja(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export interface HasilVerifikasi {
  valid: boolean;
  /** Alasan penolakan, siap ditampilkan ke operator. */
  alasan?: string;
}

/**
 * Verifikasi kode akses BESERTA masa berlakunya.
 *
 * Sebelumnya pemeriksaan hanya mencocokkan hash — kolom tanggal_mulai dan
 * tanggal_selesai ada tapi tidak pernah dibaca, sehingga kode yang sudah lewat
 * masa berlakunya tetap membuka kontrol perangkat. Rentang tanggal itu satu-
 * satunya alasan kolomnya ada, jadi di sinilah tempat menegakkannya.
 */
export async function verifikasiKodeAkses(kode: string): Promise<HasilVerifikasi> {
  if (!kode || !kode.trim()) {
    return { valid: false, alasan: "Kode akses wajib diisi" };
  }

  const baris = await prisma.kodeAkses.findFirst({
    where: { kode_akses: hashKode(kode) },
  });

  if (!baris) return { valid: false, alasan: "Kode akses salah" };

  const status = statusKode(baris.tanggal_mulai, baris.tanggal_selesai);
  if (status === "belum-berlaku") {
    return {
      valid: false,
      alasan: `Kode akses baru berlaku mulai ${fmtTanggal(baris.tanggal_mulai)}`,
    };
  }
  if (status === "kedaluwarsa") {
    return {
      valid: false,
      alasan: `Kode akses sudah kedaluwarsa sejak ${fmtTanggal(baris.tanggal_selesai)}`,
    };
  }

  return { valid: true };
}

function fmtTanggal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}-${p(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
}
