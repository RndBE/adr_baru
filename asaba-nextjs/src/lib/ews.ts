/**
 * Perintah level ke logger EWS (sirene/lampu peringatan di lapangan).
 *
 * Murni dan tanpa dependensi supaya tabelnya bisa dikunci oleh ews.test.ts —
 * aliran MQTT-nya sendiri tidak bisa diuji tanpa perangkat.
 *
 * ── Angka level mengikuti urutan keparahan ──────────────────────────────────
 *
 *   {"EWS":{"cmd":"CTRL","level":1}}  Waspada
 *   {"EWS":{"cmd":"CTRL","level":2}}  Siaga
 *   {"EWS":{"cmd":"CTRL","level":3}}  Awas
 *   {"EWS":{"cmd":"CTRL","level":0}}  Aman
 *
 * Makin GAWAT statusnya, makin BESAR angkanya; 0 = aman. Dulu tabel ini
 * tertulis terbalik (Waspada 3, Awas 1); operator perangkat mengoreksinya
 * pada 2026-11-17. Kalau perangkat kelak
 * diganti, cocokkan dulu dengan firmware-nya: salah angka berarti sirene
 * membunyikan tingkat yang keliru.
 *
 * Payload ini TIDAK dibungkus `set_<idLogger>` seperti perintah RTS — kunci
 * paling luarnya `EWS`. Topiknya tetap `sub_<idLoggerEws>`.
 */
import { type StatusLabel, statusTerburuk } from "@/lib/ambang";
import { senyapBerlaku } from "@/lib/aturan-kejadian";

export type LevelEws = 0 | 1 | 2 | 3;

export const LEVEL_EWS: Readonly<Record<StatusLabel, LevelEws>> = {
  Normal: 0,
  Waspada: 1,
  Siaga: 2,
  Awas: 3,
};

export function levelEws(tingkat: StatusLabel): LevelEws {
  return LEVEL_EWS[tingkat];
}

export function payloadEws(tingkat: StatusLabel): { EWS: { cmd: "CTRL"; level: LevelEws } } {
  return { EWS: { cmd: "CTRL", level: levelEws(tingkat) } };
}

/**
 * Tingkat satu site = yang TERBURUK di antara prisma-prismanya. Satu prisma
 * Awas sudah cukup untuk membunyikan sirene walau sembilan lainnya normal.
 * Daftar kosong berarti Normal — tidak ada bukti bahaya, dan "Aman" adalah
 * keadaan awal perangkat.
 */
export function tingkatSite(daftar: ReadonlyArray<StatusLabel | null | undefined>): StatusLabel {
  return statusTerburuk(daftar) ?? "Normal";
}

/**
 * Tingkat yang dikirim ke perangkat: tingkat site, KECUALI sedang disenyapkan
 * oleh konfirmasi operator — maka Normal (level 0, sirene + lampu mati).
 * Naik melewati tingkat yang dikonfirmasi membunyikannya lagi. Lihat
 * senyapBerlaku() di aturan-kejadian.ts.
 */
export function tingkatUntukEws(
  tingkat: StatusLabel,
  tingkatDikonfirmasi: StatusLabel | null
): StatusLabel {
  return senyapBerlaku(tingkat, tingkatDikonfirmasi) ? "Normal" : tingkat;
}

/** Yang terakhir BERHASIL diterbitkan ke perangkat (tabel status_ews). */
export interface EwsTerkirim {
  idLoggerEws: string;
  tingkat: StatusLabel;
}

/**
 * Perlu kirim perintah level? Dibandingkan dengan yang terakhir BENAR-BENAR
 * terkirim ke perangkat — bukan dengan tingkat site siklus sebelumnya.
 *
 * Membandingkan dengan tingkat sebelumnya (dari status_prisma) membuat sirene
 * bisa nyangkut: R0 diganti menghapus status_prisma sehingga "sebelum" terbaca
 * Normal, prisma yang dihapus ikut menurunkan "sebelum", dan terbit yang gagal
 * tidak pernah diulang — di ketiganya perintah "Aman" tidak berangkat.
 *
 *   belum pernah terkirim    → kirim (perangkat diberi keadaan awal, walau Aman)
 *   logger EWS site diganti  → kirim (perangkat baru belum tahu apa-apa)
 *   tingkat berbeda          → kirim
 *   sama persis              → diam, supaya sirene tidak dibunyikan ulang
 */
export function perluKirimEws(
  terakhir: EwsTerkirim | null,
  idLoggerEws: string,
  tingkat: StatusLabel
): boolean {
  if (!terakhir) return true;
  return terakhir.idLoggerEws !== idLoggerEws || terakhir.tingkat !== tingkat;
}
