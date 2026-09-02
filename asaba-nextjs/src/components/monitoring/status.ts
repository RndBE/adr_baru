import type { SiteRow } from "@/hooks/use-sites";

export type StatusLabel = "Normal" | "Waspada" | "Siaga" | "Awas";

/** Urutan tingkat bahaya, dari yang paling ringan. */
export const URUTAN_STATUS: readonly StatusLabel[] = ["Normal", "Waspada", "Siaga", "Awas"];

/**
 * Warna status sebagai token CSS (didefinisikan pada `.tema-monitoring`
 * di globals.css)
 * supaya SVG dan DOM membaca nilai yang sama. Warna ini HANYA untuk status —
 * tidak pernah dipakai mewarnai seri data lain, dan tidak pernah tampil tanpa
 * teks pendampingnya.
 */
export const WARNA_STATUS: Record<StatusLabel, string> = {
  Normal: "var(--st-normal)",
  Waspada: "var(--st-waspada)",
  Siaga: "var(--st-siaga)",
  Awas: "var(--st-awas)",
};

export interface AmbangSite {
  /** Batas atas tiap tingkat pergeseran (mm). */
  geser: { normalMax: number; waspadaMax: number; siagaMax: number };
  /** Batas bawah tiap tingkat kecepatan (mm/hari). */
  laju: { waspadaMin: number; siagaMin: number; awasMin: number };
}

export function ambangDariSite(site: SiteRow | null | undefined): AmbangSite | null {
  if (!site) return null;
  return {
    geser: {
      normalMax: Number(site.geser_normal_max),
      waspadaMax: Number(site.geser_waspada_max),
      siagaMax: Number(site.geser_siaga_max),
    },
    laju: {
      waspadaMin: Number(site.laju_waspada_min),
      siagaMin: Number(site.laju_siaga_min),
      awasMin: Number(site.laju_awas_min),
    },
  };
}

/**
 * Aturan yang sama dengan statusPergeseran()/statusKecepatan() di
 * src/lib/sites.ts. Disalin karena modul itu mengimpor Prisma dan tidak bisa
 * dibundel ke klien — kalau aturannya berubah di sana, ubah di sini juga.
 */
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

/**
 * Label status yang datang dari server (`daily.status_*.label`) sebagai teks
 * bebas. Dikembalikan hanya bila cocok dengan salah satu tingkat yang dikenal,
 * supaya nilai tak terduga tidak lolos jadi warna atau teks yang salah.
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
    if (!terburuk || URUTAN_STATUS.indexOf(s) > URUTAN_STATUS.indexOf(terburuk)) {
      terburuk = s;
    }
  }
  return terburuk;
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
    case "Normal":
      return { label: "Waspada", nilai: a.geser.normalMax };
    case "Waspada":
      return { label: "Siaga", nilai: a.geser.waspadaMax };
    case "Siaga":
      return { label: "Awas", nilai: a.geser.siagaMax };
    default:
      return null;
  }
}
