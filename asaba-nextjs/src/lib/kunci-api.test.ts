/**
 * Pemeriksaan kunci API.
 * Jalankan: npx tsx src/lib/kunci-api.test.ts
 */
import { kunciApiCocok } from "./kunci-api";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = dapat === harus;
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : ` (dapat ${String(dapat)}, harus ${String(harus)})`}`);
}

cek("kunci sama → cocok", kunciApiCocok("rahasia-123", "rahasia-123"), true);
cek("kunci beda → tolak", kunciApiCocok("rahasia-124", "rahasia-123"), false);
cek("panjang beda tidak melempar galat", kunciApiCocok("x", "rahasia-123"), false);
cek("huruf besar/kecil dibedakan", kunciApiCocok("RAHASIA-123", "rahasia-123"), false);
cek("header kosong → tolak", kunciApiCocok("", "rahasia-123"), false);
cek("header tidak ada → tolak", kunciApiCocok(null, "rahasia-123"), false);
cek("kunci server belum disetel → selalu tolak", kunciApiCocok("apa saja", undefined), false);
cek("kunci server kosong → tolak walau header kosong", kunciApiCocok("", ""), false);

if (gagal) {
  console.log(`\n${gagal} GAGAL`);
  process.exit(1);
}
console.log("\nsemua lolos");
