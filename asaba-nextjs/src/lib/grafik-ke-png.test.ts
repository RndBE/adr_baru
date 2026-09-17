/**
 * Pemeriksaan penggantian var(--…) sebelum SVG dirasterkan.
 * Jalankan: npx tsx src/lib/grafik-ke-png.test.ts
 *
 * Bagian ini yang paling sunyi kalau salah. Grafik di aplikasi menulis warna
 * dan font sebagai custom property CSS; begitu SVG-nya dilepas dari dokumen dan
 * dimuat lewat <img>, tidak ada lagi yang menyelesaikan variabel itu. Kalau
 * penggantian ini meleset, ekspor Excel tetap jadi — hanya saja grafiknya
 * hitam polos, atau kosong sama sekali, dan tidak ada galat yang memberi tahu.
 */
import { FONT_EKSPOR, gantiVariabelCss, seragamkanFont } from "./grafik-ke-png";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`);
}

/** Meniru getPropertyValue: nilai berspasi di depan, dan "" bila tak dikenal. */
const TEMA: Record<string, string> = {
  "--ink": " #14173a",
  "--ink-3": " #6b6f8e",
  "--line": " rgba(20, 23, 58, 0.1)",
  "--st-waspada": " #fab219",
};
const resolusi = (nama: string) => TEMA[nama] ?? "";

// ── Penggantian dasar ───────────────────────────────────────────────────────
{
  cek(
    "atribut stroke diganti nilai temanya",
    gantiVariabelCss(`<line stroke="var(--ink)"/>`, resolusi),
    `<line stroke="#14173a"/>`
  );
  cek(
    "spasi di depan nilai ikut dipangkas",
    gantiVariabelCss(`<text fill="var(--ink-3)"/>`, resolusi),
    `<text fill="#6b6f8e"/>`
  );
  // rgba() punya koma DI DALAM kurungnya sendiri — nilai seperti ini yang
  // membuat pola var() naif ikut melahap kurung tutup yang salah.
  cek(
    "nilai rgba() utuh, tidak terpotong di komanya",
    gantiVariabelCss(`<line stroke="var(--line)"/>`, resolusi),
    `<line stroke="rgba(20, 23, 58, 0.1)"/>`
  );
  cek(
    "beberapa variabel berbeda dalam satu markup",
    gantiVariabelCss(`<a fill="var(--ink)"/><b fill="var(--st-waspada)"/>`, resolusi),
    `<a fill="#14173a"/><b fill="#fab219"/>`
  );
  cek(
    "variabel yang sama berulang tetap diganti seluruhnya",
    gantiVariabelCss(`<a fill="var(--ink)"/><b fill="var(--ink)"/>`, resolusi),
    `<a fill="#14173a"/><b fill="#14173a"/>`
  );
  cek(
    "spasi di dalam var() ditoleransi",
    gantiVariabelCss(`<a fill="var( --ink )"/>`, resolusi),
    `<a fill="#14173a"/>`
  );
}

// ── Variabel yang tidak dikenal ─────────────────────────────────────────────
{
  // Dibiarkan utuh, BUKAN dikosongkan: atribut kosong membuat seluruh SVG
  // ditolak saat dimuat sebagai gambar, jadi satu variabel yang luput akan
  // menghilangkan grafiknya sama sekali alih-alih satu garis saja.
  cek(
    "variabel tak dikenal dibiarkan apa adanya",
    gantiVariabelCss(`<a fill="var(--entah)"/>`, resolusi),
    `<a fill="var(--entah)"/>`
  );
  cek(
    "nilai cadangan di dalam var() dipakai bila ada",
    gantiVariabelCss(`<a fill="var(--entah, #ff0000)"/>`, resolusi),
    `<a fill="#ff0000"/>`
  );
  cek(
    "variabel dikenal menang atas cadangannya",
    gantiVariabelCss(`<a fill="var(--ink, #ff0000)"/>`, resolusi),
    `<a fill="#14173a"/>`
  );
}

// ── Markup tanpa variabel ───────────────────────────────────────────────────
{
  const polos = `<polyline stroke="#303481" points="1,2 3,4"/>`;
  cek("markup tanpa var() tidak disentuh", gantiVariabelCss(polos, resolusi), polos);
}

// ── Font diseragamkan ───────────────────────────────────────────────────────
{
  cek(
    "font-family atribut diganti tumpukan generik",
    seragamkanFont(`<text font-family="Geist Mono, monospace">x</text>`),
    `<text font-family="${FONT_EKSPOR}">x</text>`
  );
  // Bentuk deklarasi harus tetap jadi deklarasi. Kalau ditulis ulang jadi
  // bentuk atribut, hasilnya style="font-family="…"" — kutip bersarang, markup
  // rusak, dan grafiknya hilang dari Excel tanpa galat apa pun.
  cek(
    "font-family di dalam style tetap berbentuk deklarasi",
    seragamkanFont(`<text style="font-family:'Geist Mono'">x</text>`),
    `<text style="font-family:${FONT_EKSPOR}">x</text>`
  );
  cek(
    "deklarasi lain di sebelahnya tidak ikut termakan",
    seragamkanFont(`<text style="font-family:'X';fill:#123456">x</text>`),
    `<text style="font-family:${FONT_EKSPOR};fill:#123456">x</text>`
  );
  cek(
    "tidak ada kutip bersarang tersisa",
    /=\s*"[^"]*"[^"]*"/.test(seragamkanFont(`<text style="font-family:'X'">x</text>`)),
    false
  );
}

// ── Urutan pemakaian nyata: var() dulu, baru font ───────────────────────────
{
  const asli = `<text font-family="var(--font-geist-mono)" fill="var(--ink-3)">06:00</text>`;
  const hasil = seragamkanFont(gantiVariabelCss(asli, resolusi));
  cek("tidak ada var() tersisa", /var\(--/.test(hasil), false);
  cek("warna teks terselesaikan", hasil.includes("#6b6f8e"), true);
  cek("font jadi tumpukan generik", hasil.includes(FONT_EKSPOR), true);
}

console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
