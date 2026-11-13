import { redirect } from "next/navigation";

/**
 * Ambang Batas sempat punya menu dan tab sendiri; sekarang kembali menjadi
 * bagian form Master Data → Site. Rute lama dipertahankan sebagai pengalih
 * supaya tautan yang sudah tersimpan tetap sampai.
 */
export default function AmbangBatasPage() {
  redirect("/master-data");
}
