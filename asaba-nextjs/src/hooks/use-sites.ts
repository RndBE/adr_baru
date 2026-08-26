"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface SiteRow {
  id: number;
  slug: string;
  nama: string;
  badge_label: string;
  badge_color: string;
  geser_normal_max: number;
  geser_waspada_max: number;
  geser_siaga_max: number;
  laju_waspada_min: number;
  laju_siaga_min: number;
  laju_awas_min: number;
  rts_e: number | null;
  rts_n: number | null;
  rts_z: number | null;
  utm_zone: number;
  utm_north: boolean;
  map_lat: number | null;
  map_lng: number | null;
  map_zoom: number;
  rotasi_deg: number | null;
  pivot_e: number | null;
  pivot_n: number | null;
  ukur_e: number | null;
  ukur_n: number | null;
  pivot_lat: number | null;
  pivot_lng: number | null;
  ukur_lat: number | null;
  ukur_lng: number | null;
  terkalibrasi: boolean;
  data_dummy: boolean;
  aktif: boolean;
  urutan: number;
  catatan: string | null;
  /** Diturunkan dari log_kontrol — hanya ada bila diminta with_logger=1. */
  id_logger?: string | null;
  jumlah_sesi?: number;
}

export interface SiteBadge {
  label: string;
  /** Warna hex — dipakai sebagai inline style, bukan kelas Tailwind, karena
   *  warna site sekarang datang dari data dan tidak bisa di-scan Tailwind. */
  color: string;
  nama: string;
  terkalibrasi: boolean;
  dataDummy: boolean;
  /** null bila site sehat; berisi alasan bila datanya belum bisa dipercaya. */
  peringatan: string | null;
}

/** Alasan kenapa angka sebuah site belum bisa dipercaya. */
function alasanPeringatan(
  nama: string,
  terkalibrasi: boolean,
  dataDummy: boolean,
  terdaftar: boolean
): string | null {
  if (!terdaftar) return `Site "${nama}" belum terdaftar di Master Data`;
  if (!terkalibrasi) return `${nama} — belum dikalibrasi`;
  if (dataDummy) return `${nama} — DATA CONTOH, bukan hasil survei`;
  return null;
}

/** Badge untuk slug yang tidak ada di master data. */
export function fallbackBadge(slug: string | null | undefined): SiteBadge {
  const s = (slug || "").trim();
  const nama = s || "Tidak dikenal";
  return {
    label: s ? s.slice(0, 4).toUpperCase() : "?",
    color: "#8D93A4",
    nama,
    terkalibrasi: false,
    dataDummy: false,
    peringatan: alasanPeringatan(nama, false, false, false),
  };
}

/**
 * Daftar site + helper badge.
 *
 * Menggantikan tiga helper badge yang dulu di-hardcode terpisah di
 * beranda, hasil-pengukuran, dan visualisasi-3d — masing-masing dengan
 * warna dan label yang sedikit berbeda untuk site yang sama.
 */
export function useSites(includeInactive = false, withLogger = false) {
  const q = new URLSearchParams();
  if (includeInactive) q.set("all", "1");
  if (withLogger) q.set("with_logger", "1");
  const url = q.toString() ? `/api/sites?${q}` : "/api/sites";
  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  // useMemo supaya identitas array stabil — tanpa ini `data?.data || []`
  // menghasilkan array baru tiap render dan membatalkan memoisasi di bawah.
  const sites: SiteRow[] = useMemo(() => data?.data ?? [], [data]);

  const badge = useCallback(
    (slug: string | null | undefined): SiteBadge => {
      const found = sites.find((s) => s.slug === slug);
      if (!found) return fallbackBadge(slug);
      return {
        label: found.badge_label,
        color: found.badge_color,
        nama: found.nama,
        terkalibrasi: found.terkalibrasi,
        dataDummy: found.data_dummy,
        peringatan: alasanPeringatan(
          found.nama,
          found.terkalibrasi,
          found.data_dummy,
          true
        ),
      };
    },
    [sites]
  );

  const bySlug = useCallback(
    (slug: string | null | undefined): SiteRow | null =>
      sites.find((s) => s.slug === slug) ?? null,
    [sites]
  );

  return {
    sites,
    badge,
    bySlug,
    isLoading,
    isError: !!error || data?.success === false,
    mutate,
  };
}
