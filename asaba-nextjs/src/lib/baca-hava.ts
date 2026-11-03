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
