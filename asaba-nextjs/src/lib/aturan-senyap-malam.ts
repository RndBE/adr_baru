/**
 * Bunyi alarm dimatikan otomatis pada jam malam — aturan murni.
 *
 * Diminta 26 Nov 2026. Alarm yang berbunyi pada jam malam site (bawaan
 * 17:00–08:00) dan tidak dikonfirmasi dalam N menit (bawaan 10) dibungkam:
 * sirene + lampu EWS diberi level 0 dan suara di peramban berhenti. Yang mati
 * hanya BUNYI — kejadian tetap "belum dikonfirmasi", jadi banner, modal, dan
 * lencana Riwayat Alarm tetap tampil sampai ada yang menekan Konfirmasi.
 *
 * Bunyi menyala lagi dengan aturan yang sama dengan sesudah konfirmasi
 * (kejadian-alarm.ts): tingkat naik melewati yang dibungkam, prisma lain
 * menyusul naik, atau prisma bergeser lagi dari posisinya saat dibungkam.
 * Pergeseran sungguhan yang terus berjalan tetap membangunkan orang; yang
 * diredam hanya alarm yang angkanya diam di tempat.
 *
 * Pengaturannya per site (t_site.senyap_malam*, migrasi 027), keadaannya per
 * kejadian (kejadian_alarm.dibungkam*). Dijalankan cron tiap menit lewat
 * POST /api/jadwal-running/senyap-malam.
 *
 * Semua waktu di sini jam dinding lokal site dalam ms "seolah UTC" — sama
 * dengan cara kolom DATETIME dibaca Prisma (medan UTC-nya = jam dinding).
 */
import type { StatusLabel } from "@/lib/ambang";
import { fmtWaktuPendek, type HasilEws } from "@/lib/aturan-kejadian";

export interface SenyapMalam {
  aktif: boolean;
  /** "HH:MM" */
  mulai: string;
  /** "HH:MM"; lebih kecil dari mulai = melewati tengah malam. */
  selesai: string;
  /** Menit tanpa konfirmasi sebelum bunyi dimatikan. */
  menit: number;
}

export const SENYAP_MALAM_BAWAAN: SenyapMalam = { aktif: false, mulai: "17:00", selesai: "08:00", menit: 10 };

export const MENIT_SENYAP_MIN = 1;
export const MENIT_SENYAP_MAKS = 120;

const JAM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "22:00" → 1320. Null bila bukan HH:MM 24 jam. */
export function jamKeMenit(jam: string): number | null {
  const m = JAM_RE.exec(jam.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Menit ke berapa dalam hari, dari ms jam dinding. */
export function menitHari(ms: number): number {
  const d = new Date(ms);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/**
 * Apakah `menit` (menit dalam hari) di dalam jam malam [mulai, selesai).
 * Mulai > selesai = melewati tengah malam. Mulai = selesai = tidak pernah.
 */
export function dalamJamMalam(menit: number, mulai: string, selesai: string): boolean {
  const a = jamKeMenit(mulai);
  const b = jamKeMenit(selesai);
  if (a === null || b === null || a === b) return false;
  return a < b ? menit >= a && menit < b : menit >= a || menit < b;
}

/** Galat pengaturan, atau null bila sah. */
export function validasiSenyapMalam(s: SenyapMalam): string | null {
  if (jamKeMenit(s.mulai) === null) return "Jam mulai senyap malam harus berformat HH:MM";
  if (jamKeMenit(s.selesai) === null) return "Jam selesai senyap malam harus berformat HH:MM";
  if (s.mulai === s.selesai) return "Jam mulai dan selesai senyap malam tidak boleh sama";
  if (!Number.isInteger(s.menit) || s.menit < MENIT_SENYAP_MIN || s.menit > MENIT_SENYAP_MAKS) {
    return `Menit senyap malam harus bilangan bulat ${MENIT_SENYAP_MIN}–${MENIT_SENYAP_MAKS}`;
  }
  return null;
}

/** Yang diperlukan dari satu kejadian untuk memutuskan bungkam. */
export interface KejadianBerbunyi {
  /** Kejadian masih aktif. */
  aktif: boolean;
  tingkatTerakhir: StatusLabel;
  dikonfirmasi: boolean;
  dibungkam: boolean;
  /** Bunyi menyala sejak (ms jam dinding). */
  berbunyiSejakMs: number;
}

/**
 * Bunyi kejadian ini harus dimatikan sekarang: site memakai senyap malam,
 * sekarang jam malam, kejadiannya masih berbunyi (aktif, di atas Normal, belum
 * dikonfirmasi, belum dibungkam), dan sudah berbunyi selama `menit` atau lebih.
 */
export function perluBungkamMalam(k: KejadianBerbunyi, s: SenyapMalam, sekarangMs: number): boolean {
  if (!s.aktif || !k.aktif || k.dikonfirmasi || k.dibungkam || k.tingkatTerakhir === "Normal") return false;
  if (!dalamJamMalam(menitHari(sekarangMs), s.mulai, s.selesai)) return false;
  return sekarangMs - k.berbunyiSejakMs >= s.menit * 60_000;
}

/**
 * Tingkat yang tidak lagi dibunyikan untuk kejadian ini: yang dikonfirmasi,
 * atau bila belum dikonfirmasi, yang dibungkam jam malam.
 */
export function tingkatTersenyap(k: {
  tingkatDikonfirmasi: StatusLabel | null;
  tingkatDibungkam: StatusLabel | null;
}): StatusLabel | null {
  return k.tingkatDikonfirmasi ?? k.tingkatDibungkam;
}

/** Baris catatan kejadian saat bunyi dimatikan. */
export function barisCatatanBungkam(waktu: string, menit: number): string {
  return `[${fmtWaktuPendek(waktu)}] Bunyi dimatikan otomatis (jam malam, ${menit} menit tanpa konfirmasi). Alarm belum dikonfirmasi.`;
}

/** Baris catatan kejadian saat bunyi menyala lagi karena keadaannya memburuk. */
export function barisCatatanBunyiLagi(
  waktu: string,
  naik: ReadonlyArray<{ idPrisma: string; tingkat: StatusLabel }>,
  bergeser: ReadonlyArray<{ idPrisma: string; geserMm: number | null }>
): string {
  const sebab = [
    ...naik.map((p) => `${p.idPrisma} naik ke ${p.tingkat}`),
    ...bergeser.map((p) => `${p.idPrisma} bergeser lagi${p.geserMm === null ? "" : ` ${Math.round(p.geserMm)} mm`}`),
  ].join(", ");
  return `[${fmtWaktuPendek(waktu)}] Bunyi menyala lagi: ${sebab}.`;
}

/** Kabar WhatsApp/Telegram saat bunyi dimatikan. */
export function teksBungkamMalam(o: {
  namaSite: string;
  tingkat: StatusLabel;
  mulai: string;
  waktu: string;
  menit: number;
  ews: HasilEws;
}): string {
  const sirene: Record<HasilEws, string | null> = {
    terkirim: "Sirene dan lampu EWS dimatikan (level 0).",
    sudah: "Sirene dan lampu EWS sudah dalam keadaan mati.",
    gagal: "Perintah mematikan sirene GAGAL terkirim — diulang di siklus berikutnya.",
    "tanpa-ews": null,
  };
  return [
    `*[Bunyi dimatikan otomatis] ${o.namaSite}*`,
    `Alarm ${o.tingkat} sejak ${fmtWaktuPendek(o.mulai)} belum dikonfirmasi ${o.menit} menit pada jam malam.`,
    sirene[o.ews],
    "Bunyi di website juga berhenti, tapi alarm tetap tampil dan masih MENUNGGU KONFIRMASI.",
    "Bunyi menyala lagi bila tingkatnya naik, ada prisma lain yang menyusul naik, atau prisma bergeser lagi.",
  ]
    .filter((b): b is string => b !== null)
    .join("\n");
}
