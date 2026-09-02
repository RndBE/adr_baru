/**
 * Font aplikasi — satu sumber untuk seluruh proyek.
 *
 * Modul terpisah karena selain dipasang di <html> lewat CSS variable, nama
 * family-nya juga dibutuhkan sebagai STRING oleh pustaka yang menggambar teks
 * sendiri dan tidak ikut mewarisi CSS:
 *   - deck.gl  : merender teks ke atlas canvas
 *   - Plotly   : mengukur teks untuk menata sumbu dan legenda
 *
 * Untuk kasus itu pakai `fontSans.style.fontFamily`, bukan `var(--font-sans)` —
 * canvas tidak bisa meresolusi CSS variable.
 *
 * Geist adalah variable font (100–900), jadi `weight` tidak perlu disebut.
 * Ia hanya punya style normal; teks ber-`italic` dimiringkan browser.
 */
import { Barlow_Semi_Condensed, Geist, Geist_Mono } from "next/font/google";

// Nama variabelnya SENGAJA bukan --font-sans. Token Tailwind di globals.css
// bernama --font-sans, dan dulu isinya `var(--font-sans)` — merujuk dirinya
// sendiri. Itu hanya bekerja karena deklarasi next/font tidak berlapis sehingga
// menang atas @layer theme; begitu urutan lapisannya berubah, custom property-nya
// jadi guaranteed-invalid dan seluruh font-family ikut gugur. Nama terpisah
// membuat arahnya satu arah: --font-sans (token) → --font-geist-sans (nilai).
export const fontSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const fontMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Wajah display untuk Beranda — judul panel, eyebrow, dan kata status.
 *
 * Barlow Semi Condensed dipilih karena bentuknya diturunkan dari rambu dan
 * pelat nama industri: cocok untuk panel instrumen pemantauan, dan lebar
 * hurufnya yang rapat menyisakan ruang di layar 1366. Bukan variable font,
 * jadi bobotnya harus disebut eksplisit. Teks tubuh tetap Geist supaya
 * halaman ini masih terasa satu aplikasi dengan halaman lainnya.
 *
 * Variabelnya dipasang di root halaman Beranda (bukan di <html>) supaya font
 * ini hanya dimuat di halaman yang memakainya. Token Tailwind `--font-display`
 * di globals.css merujuk ke variabel ini.
 */
export const fontDisplay = Barlow_Semi_Condensed({
  variable: "--font-barlow-sc",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});
