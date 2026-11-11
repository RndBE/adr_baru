/**
 * Pemeriksaan kunci API untuk pintu masuk yang dipanggil server lain
 * (mis. Integration be-stesy.cloud ke `/api/datamasuk/adr-json`).
 *
 * Kedua sisi di-hash dulu supaya panjangnya selalu sama: timingSafeEqual
 * melempar galat untuk buffer berbeda panjang, dan membandingkan panjang lebih
 * dulu justru membocorkan panjang kunci lewat waktu respons.
 *
 * Kunci yang belum disetel di server SELALU menolak — pintu masuk yang lupa
 * dikonfigurasi tidak boleh berubah jadi pintu terbuka.
 *
 * Jalankan tes: npx tsx src/lib/kunci-api.test.ts
 */
import { createHash, timingSafeEqual } from "node:crypto";

function sidik(teks: string): Buffer {
  return createHash("sha256").update(teks, "utf8").digest();
}

export function kunciApiCocok(
  diberikan: string | null | undefined,
  seharusnya: string | null | undefined
): boolean {
  if (!seharusnya || !diberikan) return false;
  return timingSafeEqual(sidik(diberikan), sidik(seharusnya));
}
