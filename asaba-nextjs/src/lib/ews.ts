/**
 * Perintah level ke logger EWS (sirene/lampu peringatan di lapangan).
 *
 * Murni dan tanpa dependensi supaya tabelnya bisa dikunci oleh ews.test.ts —
 * aliran MQTT-nya sendiri tidak bisa diuji tanpa perangkat.
 *
 * ── Angka level TERBALIK dari urutan keparahan ──────────────────────────────
 *
 * Dari protokol perangkat EWS:
 *
 *   {"EWS":{"cmd":"CTRL","level":3}}  Waspada
 *   {"EWS":{"cmd":"CTRL","level":2}}  Siaga
 *   {"EWS":{"cmd":"CTRL","level":1}}  Awas
 *   {"EWS":{"cmd":"CTRL","level":0}}  Aman
 *
 * Makin GAWAT statusnya, makin KECIL angkanya (kecuali 0 = aman). Jangan
 * "merapikan" ini jadi indeksStatus(): Awas = 3 di sana, dan perangkat akan
 * membunyikan tingkat Waspada untuk kejadian Awas.
 *
 * Payload ini TIDAK dibungkus `set_<idLogger>` seperti perintah RTS — kunci
 * paling luarnya `EWS`. Topiknya tetap `sub_<idLoggerEws>`.
 */
import { type StatusLabel, statusTerburuk } from "@/lib/ambang";

export type LevelEws = 0 | 1 | 2 | 3;

export const LEVEL_EWS: Readonly<Record<StatusLabel, LevelEws>> = {
  Normal: 0,
  Waspada: 3,
  Siaga: 2,
  Awas: 1,
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
