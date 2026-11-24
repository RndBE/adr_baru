/**
 * Acuan baru per prisma sesudah arah bidiknya diperbarui — aturan murni.
 *
 * Pergeseran dihitung terhadap sesi acuan R0 site. Sesudah pergeseran sebuah
 * prisma diverifikasi BENAR dan arah bidiknya ditulis ulang ke slot RTS
 * (rekam-arah.ts), posisi barunya diterima: tembakan yang sudutnya ditulis ke
 * slot jadi acuan prisma itu sendiri (tabel acuan_prisma, migrasi 025). Prisma
 * lain tetap dihitung terhadap R0. Diminta 24 Nov 2026: P2 kolam BPP sudah
 * dibidik ulang, tapi tetap Awas 239 mm di siklus 16:59 dan di pesan WhatsApp
 * waktu P1 menyusul naik.
 *
 * Acuan baru berlaku untuk sesi yang dimulai SESUDAH sesi tembakannya. Sesi
 * tembakan itu sendiri dan sebelumnya tetap dihitung terhadap acuan lama, jadi
 * pergeseran yang memicu alarm tetap terbaca di riwayat. Status prisma
 * sekarang (status_prisma) disetel ulang saat acuannya ditetapkan.
 *
 * Mengganti R0 menghapus seluruh acuan prisma site itu.
 */
import type { StatusLabel } from "@/lib/ambang";
import { fmtWaktuPendek, tambahCatatan } from "@/lib/aturan-kejadian";

export interface AcuanTercatat {
  /** acuan_prisma.id — yang lebih besar lebih baru. */
  id: number;
  idPrisma: string;
}

/** Acuan terbaru tiap prisma. */
export function acuanTerbaru<T extends AcuanTercatat>(daftar: readonly T[]): Map<string, T> {
  const hasil = new Map<string, T>();
  for (const a of daftar) {
    const lama = hasil.get(a.idPrisma);
    if (!lama || a.id > lama.id) hasil.set(a.idPrisma, a);
  }
  return hasil;
}

/**
 * Baris kaki pesan siklus: prisma mana yang angkanya diukur terhadap acuan
 * baru, bukan terhadap R0. Null bila tidak ada.
 */
export function teksAcuanPrisma(daftar: ReadonlyArray<{ idPrisma: string; waktuTembakan: string }>): string | null {
  if (daftar.length === 0) return null;
  const isi = [...daftar]
    .sort((a, b) => a.idPrisma.localeCompare(b.idPrisma, undefined, { numeric: true }))
    .map((a) => `${a.idPrisma} sejak ${fmtWaktuPendek(a.waktuTembakan)}`)
    .join(", ");
  return `Acuan baru (arah bidik diperbarui): ${isi}`;
}

/** Bahan pesan dan catatan saat acuan baru ditetapkan. */
export interface AcuanBaru {
  namaSite: string;
  idPrisma: string;
  oleh: string;
  /** Kapan ditetapkan, "YYYY-MM-DD HH:mm:ss". */
  waktu: string;
  /** Waktu tembakan yang jadi acuan, "YYYY-MM-DD HH:mm:ss". */
  waktuTembakan: string;
  /** Pergeseran tembakan itu terhadap acuan lamanya — yang sekarang diterima. */
  geserDiterimaMm: number | null;
  dari: StatusLabel;
  ke: StatusLabel;
  /** Pergeseran sekarang terhadap acuan baru. */
  nilaiMm: number;
  /** Tingkat site sesudahnya dan prisma yang masih di atas Normal. */
  tingkatSite: StatusLabel;
  masihAlarm: ReadonlyArray<{ idPrisma: string; tingkat: StatusLabel; nilaiMm: number | null }>;
}

const mm = (v: number | null) => (v === null ? "—" : `${Math.round(v)} mm`);

/** Kabar WhatsApp/Telegram. Penerima sebelumnya diberi tahu prisma ini Awas; ini yang menutupnya. */
export function teksAcuanBaru(o: AcuanBaru): string {
  const site =
    o.tingkatSite === "Normal"
      ? "Semua prisma Normal — alarm selesai."
      : `Site masih ${o.tingkatSite}: ${o.masihAlarm.map((p) => `${p.idPrisma} ${p.tingkat} ${mm(p.nilaiMm)}`).join(", ")}.`;
  return [
    `*[Acuan baru] ${o.namaSite}*`,
    `Arah bidik ${o.idPrisma} diperbarui oleh ${o.oleh}, ${fmtWaktuPendek(o.waktu)}.`,
    `Posisi tembakan ${fmtWaktuPendek(o.waktuTembakan)}` +
      (o.geserDiterimaMm !== null ? ` (bergeser ${mm(o.geserDiterimaMm)} dari acuan sebelumnya)` : "") +
      ` sekarang jadi acuan ${o.idPrisma}.`,
    `${o.idPrisma}: ${o.dari} → ${o.ke} (${mm(o.nilaiMm)})`,
    site,
  ].join("\n");
}

/** Baris catatan kejadian, supaya riwayatnya tahu kenapa prisma itu turun. */
export function catatanAcuanBaru(catatan: string | null, o: AcuanBaru): string {
  const geser = o.geserDiterimaMm !== null ? ` ${mm(o.geserDiterimaMm)}` : "";
  return tambahCatatan(
    catatan,
    `[${fmtWaktuPendek(o.waktu)}] Acuan baru ${o.idPrisma}: arah bidik diperbarui oleh ${o.oleh}, ` +
      `pergeseran${geser} diterima sebagai posisi baru. ${o.idPrisma} ${o.dari} → ${o.ke}.`
  );
}
