/**
 * Status untuk sisi klien: warna, dan pembacaan ambang dari baris site.
 *
 * Aturan perbandingannya sendiri TIDAK lagi ada di sini — ia pindah ke
 * `@/lib/ambang` supaya server, klien, dan jalur peringatan membaca satu
 * sumber yang sama. Berkas ini dulu memuat salinan aturan itu beserta komentar
 * "kalau aturannya berubah di sana, ubah di sini juga"; salinan itulah yang
 * dihapus. Ekspor ulang di bawah dipertahankan supaya pemanggil lama tidak
 * perlu ikut berubah.
 */
import type { SiteRow } from "@/hooks/use-sites";
import { type AmbangSite, type StatusLabel } from "@/lib/ambang";

export {
  URUTAN_STATUS,
  statusPergeseran,
  statusKecepatan,
  asStatusLabel,
  statusTerburuk,
  ambangBerikutnya,
} from "@/lib/ambang";
export type { StatusLabel, AmbangSite } from "@/lib/ambang";

/**
 * Warna status sebagai token CSS (didefinisikan pada `.tema-monitoring`
 * di globals.css) supaya SVG dan DOM membaca nilai yang sama. Warna ini HANYA
 * untuk status — tidak pernah dipakai mewarnai seri data lain, dan tidak pernah
 * tampil tanpa teks pendampingnya.
 */
export const WARNA_STATUS: Record<StatusLabel, string> = {
  Normal: "var(--st-normal)",
  Waspada: "var(--st-waspada)",
  Siaga: "var(--st-siaga)",
  Awas: "var(--st-awas)",
};

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
