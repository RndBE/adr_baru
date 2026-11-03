/**
 * Bacaan sudut HA/VA di panel Uji sapuan — reducer murni di atas
 * `bacaManualHaVa()`.
 *
 * Panel hanya MEMBACA sudut instrumen (manual_hava, tidak menggerakkan apa
 * pun). Menggeser titik tengah lewat jog pernah dicoba dan dicabut: firmware
 * menafsirkan sudut desimal sebagai d.mmss sehingga target jog meleset
 * (docs/bug-firmware-jog-sudut-desimal-dibaca-dmmss.md).
 *
 * Dipisah dari komponen supaya urutan balasannya bisa diputar ulang di tes
 * tanpa instrumen, dan dipegang halaman, bukan modal, dengan alasan yang sama
 * dengan `KeadaanSapuan`: balasan tidak boleh hilang karena modalnya ditutup.
 *
 * Jalankan tes: npx tsx src/lib/baca-hava.test.ts
 */
import type { BacaanHaVa } from "./protokol-rts";

/** manual_hava: 5 detik di dokumen, dilonggarkan — balasan bisa terlambat beberapa detik. */
export const BATAS_BACA_HAVA_MS = 15_000;

export type KeadaanBaca = {
  fase: "diam" | "menunggu" | "ada" | "gagal";
  /** Apa adanya dari instrumen; bentuknya mirip DMS tapi BUKAN DMS (lihat bacaManualHaVa). */
  HA: string;
  VA: string;
  waktuMs: number | null;
  pesan: string | null;
};

const DIAM: KeadaanBaca = { fase: "diam", HA: "", VA: "", waktuMs: null, pesan: null };

export function keadaanBacaAwal(): KeadaanBaca {
  return DIAM;
}

export function mulaiBaca(): KeadaanBaca {
  return { ...DIAM, fase: "menunggu" };
}

/**
 * Balasan `ManualHAVA`. Hanya diterapkan saat panel memang menunggu bacaan:
 * balasan yang sama juga dipicu halaman lain, dan angka yang muncul tanpa
 * diminta terlihat seperti sudut sekarang padahal mungkin sudah basi.
 */
export function terapkanBacaan(k: KeadaanBaca, b: BacaanHaVa, nowMs: number): KeadaanBaca {
  if (k.fase !== "menunggu" || !b.ada) return k;
  if (b.gagal) {
    return {
      ...DIAM,
      fase: "gagal",
      pesan: "Instrumen tidak menjawab (000,00,00). Pastikan instrumen menyala, lalu baca lagi.",
    };
  }
  return { fase: "ada", HA: b.HA, VA: b.VA, waktuMs: nowMs, pesan: null };
}

export function tutupBacaTanpaJawaban(k: KeadaanBaca, pesan: string): KeadaanBaca {
  if (k.fase !== "menunggu") return k;
  return { ...DIAM, fase: "gagal", pesan };
}

/** Sudut yang terpampang tidak berlaku lagi begitu instrumen bergerak. */
export function kosongkanBacaan(k: KeadaanBaca): KeadaanBaca {
  return k.fase === "diam" ? k : DIAM;
}

// ── Tampilan: desimal dan d,m,s ──────────────────────────────────────────────

/**
 * Cara membaca string HA/VA dari `manual_hava`.
 *
 * Firmware saat ini mengirim DERAJAT DESIMAL YANG DIPOTONG jadi tiga kelompok
 * ("208,21,20" adalah 208,2120°), bukan d,m,s. Buktinya: VA berisi menit 93
 * ("098,93,37"), dan jog membaca angka mentah yang sama sebagai 208.24052
 * untuk bacaan "208,24,05" (docs/bug-firmware-jog-sudut-desimal-dibaca-dmmss.md).
 *
 * Satu-satunya tempat yang menyimpan asumsi itu. Begitu firmware diperbaiki dan
 * string itu menjadi d,m,s sungguhan, ganti ke "dms" di sini; tanpa itu
 * konversi di bawah diam-diam salah tepat saat firmware membaik. Bacaan mentah
 * tetap ditampilkan berdampingan supaya selisihnya terlihat.
 */
export const FORMAT_STRING_HAVA: "desimal-terpotong" | "dms" = "desimal-terpotong";

export type SudutDua = {
  /** Derajat desimal, mis. 208.212. */
  derajat: number;
  /** Derajat desimal siap tampil, empat angka (ketelitian string asal). */
  desimalTeks: string;
  /** d° m′ s″, detik satu angka desimal. */
  dmsTeks: string;
};

function formatDms(derajat: number): string {
  // Dibulatkan ke 0,1″ SEKALI di awal, lalu dipecah: membulatkan detik terpisah
  // menghasilkan 60,0″ atau 60′ di tepi.
  const total = Math.round(derajat * 36000);
  const d = Math.floor(total / 36000);
  const sisa = total - d * 36000;
  const m = Math.floor(sisa / 600);
  const s = (sisa - m * 600) / 10;
  return `${d}° ${String(m).padStart(2, "0")}′ ${s.toFixed(1).padStart(4, "0")}″`;
}

/**
 * Ubah satu string sudut dari instrumen ke desimal dan d,m,s. Mengembalikan
 * null kalau bentuknya bukan tiga kelompok angka, supaya yang dipamerkan
 * hanyalah yang benar-benar bisa diurai.
 */
export function ubahSudutHaVa(teks: string): SudutDua | null {
  const bagian = teks.trim().split(",");
  if (bagian.length !== 3 || bagian.some((b) => !/^\d+$/.test(b.trim()))) return null;
  const [d, m, s] = bagian.map((b) => b.trim());

  let derajat: number;
  if (FORMAT_STRING_HAVA === "desimal-terpotong") {
    // Digit di belakang koma pertama dan kedua adalah pecahan desimal yang
    // dipenggal: "208,21,20" → 208 + 0,2120.
    derajat = Number(`${d}.${m}${s}`);
  } else {
    if (Number(m) >= 60 || Number(s) >= 60) return null;
    derajat = Number(d) + Number(m) / 60 + Number(s) / 3600;
  }
  if (!Number.isFinite(derajat)) return null;
  return { derajat, desimalTeks: derajat.toFixed(4), dmsTeks: formatDms(derajat) };
}
