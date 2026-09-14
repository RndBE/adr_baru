/**
 * Aturan ambang bahaya — SATU-SATUNYA tempat perbandingannya ditulis.
 *
 * Sebelum berkas ini ada, aturan yang sama ditulis dua kali: `src/lib/sites.ts`
 * untuk server, dan disalin ke `src/components/monitoring/status.ts` karena
 * modul itu mengimpor Prisma dan tidak bisa dibundel ke klien. Komentarnya
 * memperingatkan agar keduanya diubah bersamaan, tapi tidak ada yang menjaganya.
 *
 * Jalur peringatan (`evaluasi-siklus.ts`) jadi pembaca ketiga. Menyalin sekali
 * lagi berarti tiga tempat yang bisa lepas sinkron — dan yang ketiga ini yang
 * memutuskan apakah orang dibangunkan tengah malam. Kalau angka di pesan tidak
 * sama dengan angka di layar, operator berhenti mempercayai keduanya.
 *
 * Karena itu berkas ini TIDAK BOLEH mengimpor apa pun yang menyeret Prisma atau
 * API server. Ia harus bisa dibundel ke browser apa adanya.
 */

export type StatusLabel = "Normal" | "Waspada" | "Siaga" | "Awas";

/** Urutan tingkat bahaya, dari yang paling ringan. */
export const URUTAN_STATUS: readonly StatusLabel[] = ["Normal", "Waspada", "Siaga", "Awas"];

export interface AmbangSite {
  /** Batas atas tiap tingkat pergeseran (mm). */
  geser: { normalMax: number; waspadaMax: number; siagaMax: number };
  /** Batas bawah tiap tingkat kecepatan (mm/hari). */
  laju: { waspadaMin: number; siagaMin: number; awasMin: number };
}

export function statusPergeseran(mm: number, a: AmbangSite): StatusLabel {
  if (mm < a.geser.normalMax) return "Normal";
  if (mm < a.geser.waspadaMax) return "Waspada";
  if (mm < a.geser.siagaMax) return "Siaga";
  return "Awas";
}

export function statusKecepatan(mmPerHari: number, a: AmbangSite): StatusLabel {
  if (mmPerHari > a.laju.awasMin) return "Awas";
  if (mmPerHari > a.laju.siagaMin) return "Siaga";
  if (mmPerHari > a.laju.waspadaMin) return "Waspada";
  return "Normal";
}

/** Posisi tingkat pada URUTAN_STATUS. -1 bila bukan tingkat yang dikenal. */
export function indeksStatus(s: StatusLabel): number {
  return URUTAN_STATUS.indexOf(s);
}

export function lebihGawat(a: StatusLabel, b: StatusLabel): boolean {
  return indeksStatus(a) > indeksStatus(b);
}

/**
 * Label status dari server (`daily.status_*.label`) yang datang sebagai teks
 * bebas. Dikembalikan hanya bila cocok dengan tingkat yang dikenal, supaya
 * nilai tak terduga tidak lolos jadi warna atau teks yang salah.
 */
export function asStatusLabel(s: unknown): StatusLabel | null {
  return typeof s === "string" && (URUTAN_STATUS as readonly string[]).includes(s)
    ? (s as StatusLabel)
    : null;
}

export function statusTerburuk(
  daftar: ReadonlyArray<StatusLabel | null | undefined>
): StatusLabel | null {
  let terburuk: StatusLabel | null = null;
  for (const s of daftar) {
    if (!s) continue;
    if (!terburuk || lebihGawat(s, terburuk)) terburuk = s;
  }
  return terburuk;
}

/**
 * Nilai pergeseran (mm) di mana sebuah tingkat MULAI berlaku.
 *
 * "Normal" tidak punya batas masuk — ia keadaan awal, bukan sesuatu yang
 * dimasuki dari bawah — jadi null. Dipakai peredam untuk histeresis: turun
 * tingkat baru diakui setelah nilainya cukup jauh di bawah batas masuk tingkat
 * yang sedang berlaku.
 */
export function batasMasuk(tingkat: StatusLabel, a: AmbangSite): number | null {
  switch (tingkat) {
    case "Waspada": return a.geser.normalMax;
    case "Siaga":   return a.geser.waspadaMax;
    case "Awas":    return a.geser.siagaMax;
    default:        return null;
  }
}

/**
 * Ambang berikutnya yang akan dilewati: pada "Normal" itu batas masuk Waspada,
 * dan seterusnya. Null bila sudah Awas — tidak ada tingkat di atasnya.
 */
export function ambangBerikutnya(
  status: StatusLabel,
  a: AmbangSite
): { label: StatusLabel; nilai: number } | null {
  switch (status) {
    case "Normal":  return { label: "Waspada", nilai: a.geser.normalMax };
    case "Waspada": return { label: "Siaga",   nilai: a.geser.waspadaMax };
    case "Siaga":   return { label: "Awas",    nilai: a.geser.siagaMax };
    default:        return null;
  }
}
