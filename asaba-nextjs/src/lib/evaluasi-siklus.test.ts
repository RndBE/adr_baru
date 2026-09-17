/**
 * Pemeriksaan perhitungan pergeseran dan bentuk pesan.
 * Jalankan: npx tsx src/lib/evaluasi-siklus.test.ts
 *
 * Yang diuji di sini adalah bagian yang paling mahal kalau salah: penjagaan
 * koordinat nol. Di temp_prisma, status_get = 1 dengan N1/E1/Z1 semuanya nol
 * berarti "Failed / Not Found" — prisma dibidik tapi tidak ketemu. Tanpa
 * penjagaan, satu prisma berkabut menghasilkan jarak sebesar koordinat UTM
 * penuh dan langsung jadi "Awas" palsu yang membangunkan orang tengah malam.
 */
import { pergeseranMm } from "./evaluasi-siklus";
import { susunTeks, chatUntukSite } from "./kirim-peringatan";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`);
}

/** sensor8 = N, sensor9 = E, sensor10 = Z — urutan seperti di tabel rts. */
const b = (N: string, E: string, Z: string) => ({ sensor1: "P1", sensor8: N, sensor9: E, sensor10: Z });

// Koordinat UTM khas zona 50S.
const ACUAN = b("9135000.000", "430000.000", "120.000");

// ── Penjagaan nol ────────────────────────────────────────────────────────────
cek("bacaan sekarang nol -> null, bukan jarak raksasa",
  pergeseranMm(b("0", "0", "0"), ACUAN, null), null);
cek("acuan nol -> null",
  pergeseranMm(ACUAN, b("0", "0", "0"), null), null);
cek("keduanya nol -> null",
  pergeseranMm(b("0", "0", "0"), b("0", "0", "0"), null), null);
cek("bacaan hilang -> null", pergeseranMm(undefined, ACUAN, null), null);
cek("acuan hilang -> null", pergeseranMm(ACUAN, undefined, null), null);

// Nol pada SEBAGIAN sumbu tetap sah: Z = 0 bisa berarti ketinggian acuan lokal,
// dan aturannya sama dengan `valid1` di /api/deformasi — sah bila ADA satu
// sumbu yang bukan nol.
cek("Z nol saja tetap dihitung",
  Math.round(pergeseranMm(b("9135000.100", "430000.000", "0"), b("9135000.000", "430000.000", "0"), null) ?? -1),
  100);

// ── Satuan: UTM meter -> mm ──────────────────────────────────────────────────
cek("geser 1 mm di utara", Math.round(pergeseranMm(b("9135000.001", "430000.000", "120"), ACUAN, null) ?? -1), 1);
cek("geser 50 mm di timur", Math.round(pergeseranMm(b("9135000.000", "430000.050", "120"), ACUAN, null) ?? -1), 50);
cek("diagonal 3-4-5", Math.round(pergeseranMm(b("9135000.030", "430000.040", "120"), ACUAN, null) ?? -1), 50);
cek("tidak bergerak -> 0", Math.round(pergeseranMm(ACUAN, ACUAN, null) ?? -1), 0);

// Z sengaja TIDAK ikut: yang dipakai ambang t_site adalah pergeseran linier 2D,
// sama dengan linier2d di /api/deformasi.
cek("naik-turun murni tidak dihitung sebagai pergeseran",
  Math.round(pergeseranMm(b("9135000.000", "430000.000", "125"), ACUAN, null) ?? -1), 0);

// ── Rotasi: dua titik dirotasi bersama, jaraknya kekal ───────────────────────
{
  const rot = { degree: 30, pivotE: 430000, pivotN: 9135000, ukurE: 430000, ukurN: 9135000 };
  const tanpa = pergeseranMm(b("9135000.030", "430000.040", "120"), ACUAN, null);
  const dengan = pergeseranMm(b("9135000.030", "430000.040", "120"), ACUAN, rot);
  cek("rotasi tidak mengubah besar pergeseran",
    Math.round((dengan ?? 0) * 1000) === Math.round((tanpa ?? 0) * 1000), true);
}

// ── Bentuk pesan ─────────────────────────────────────────────────────────────
{
  const teks = susunTeks({
    namaSite: "Politeknik PU",
    waktu: "2026-09-13 14:05:00",
    naik: [
      { idPrisma: "P3", dari: "Waspada", ke: "Siaga", nilaiMm: 128.4 },
      { idPrisma: "P7", dari: "Normal", ke: "Waspada", nilaiMm: 61.9 },
    ],
    pulih: [],
    hilang: [{ idPrisma: "P9", siklus: 3 }],
    semua: [
      { idPrisma: "P3", tingkat: "Siaga", nilaiMm: 128.4 },
      { idPrisma: "P7", tingkat: "Waspada", nilaiMm: 61.9 },
      { idPrisma: "P9", tingkat: "Normal", nilaiMm: null },
    ],
    acuanR0: "101109",
    waktuAcuanR0: "2025-11-21",
  });
  cek("menyebut nama site", teks.includes("Politeknik PU"), true);
  cek("mm dibulatkan", teks.includes("128 mm"), true);
  // Dulu berbunyi "7 prisma lain tidak berubah tingkat". Kalimat hitungan itu
  // diganti daftar penuh — tiap prisma disebut tingkat dan angkanya.
  cek("memuat daftar keadaan seluruh prisma", teks.includes("Keadaan seluruh prisma:"), true);
  cek("prisma tak terbaca disebut apa adanya", /P9\s+Normal\s+tidak terbaca/.test(teks), true);
  cek("menyebut prisma hilang", teks.includes("P9"), true);
  // Penerima harus tahu angkanya diukur terhadap apa.
  cek("menyebut acuan R0", teks.includes("101109"), true);
}

// ── Chat per site ────────────────────────────────────────────────────────────
process.env.TELEGRAM_CHAT_ID = "-100umum";
process.env.TELEGRAM_CHAT_ID_POLITEKNIK_PU = "-100politeknik";
cek("slug dengan tanda hubung jadi garis bawah", chatUntukSite("politeknik-pu"), "-100politeknik");
cek("site tanpa chat sendiri pakai cadangan", chatUntukSite("ccp"), "-100umum");
delete process.env.TELEGRAM_CHAT_ID;
cek("tanpa cadangan -> null", chatUntukSite("ccp"), null);

console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
