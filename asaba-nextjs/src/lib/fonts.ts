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
import { Geist, Geist_Mono } from "next/font/google";

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
