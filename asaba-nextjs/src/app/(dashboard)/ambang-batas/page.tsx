import { redirect } from "next/navigation";

/**
 * Ambang Batas sempat punya menu sendiri di sidebar; sekarang ia tab di Master
 * Data. Rute lama dipertahankan sebagai pengalih supaya tautan yang sudah
 * tersimpan tetap sampai, termasuk pilihan site-nya.
 */
export default async function AmbangBatasPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string | string[] }>;
}) {
  const { site } = await searchParams;
  const q = new URLSearchParams({ tab: "ambang" });
  if (typeof site === "string" && site) q.set("site", site);
  redirect(`/master-data?${q}`);
}
