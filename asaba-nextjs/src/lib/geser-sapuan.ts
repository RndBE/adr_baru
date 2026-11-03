/**
 * Titik tengah sapuan custom — baca sudut sekarang, geser, baru sapu.
 *
 * Firmware tidak punya parameter geseran untuk sapuan: titik tengahnya selalu
 * arah bidik saat perintah dijalankan, dan sapuannya simetris di sekitar titik
 * itu. Menggeser titik tengah berarti menggeser ARAH BIDIK dulu (jog, relatif
 * dari sudut sekarang), menunggu `done`, baru mengirim sapuan.
 *
 * Reducer murni di atas `bacaManualHaVa()` dan `bacaBalasanJog()`, dipisah dari
 * komponen supaya urutan balasannya bisa diputar ulang di tes tanpa instrumen.
 * Keadaannya dipegang halaman, bukan modal, dengan alasan yang sama dengan
 * `KeadaanSapuan`: balasan tidak boleh hilang karena modalnya ditutup.
 *
 * Jalankan tes: npx tsx src/lib/geser-sapuan.test.ts
 */
import {
  MAKS_JOG_DERAJAT,
  SEBAB_TOLAK_JOG,
  uraiSudutSapuan,
  validasiJog,
  type BacaanHaVa,
  type BalasanJog,
} from "./protokol-rts";

/** manual_hava: 5 detik di dokumen, dilonggarkan — balasan bisa terlambat beberapa detik. */
export const BATAS_BACA_HAVA_MS = 15_000;

/** jog: 20 detik di dokumen, dengan margin yang sama dengan arahkan-modal. */
export const BATAS_GESER_MS = 25_000;

export type KeadaanGeser = {
  baca: {
    fase: "diam" | "menunggu" | "ada" | "gagal";
    /** Apa adanya dari instrumen; bentuknya mirip DMS tapi BUKAN DMS (lihat bacaManualHaVa). */
    HA: string;
    VA: string;
    waktuMs: number | null;
    pesan: string | null;
  };
  geser: {
    fase: "diam" | "menunggu" | "selesai" | "gagal";
    /** Selisih yang diminta, derajat desimal (satuan jog). */
    ha: number | null;
    va: number | null;
    /** Dari balasan `target`: titik awal (desimal) dan tujuan (DMS), apa adanya. */
    dariHA?: string;
    dariVA?: string;
    keHA?: string;
    keVA?: string;
    pesan: string | null;
    mulaiMs: number | null;
  };
};

const BACA_DIAM: KeadaanGeser["baca"] = { fase: "diam", HA: "", VA: "", waktuMs: null, pesan: null };
const GESER_DIAM: KeadaanGeser["geser"] = { fase: "diam", ha: null, va: null, pesan: null, mulaiMs: null };

export function keadaanGeserAwal(): KeadaanGeser {
  return { baca: BACA_DIAM, geser: GESER_DIAM };
}

// ── Baca sudut ──────────────────────────────────────────────────────────────

export function mulaiBaca(k: KeadaanGeser): KeadaanGeser {
  return { ...k, baca: { ...BACA_DIAM, fase: "menunggu" } };
}

/**
 * Balasan `ManualHAVA`. Hanya diterapkan saat panel memang menunggu bacaan:
 * balasan yang sama juga dipicu halaman lain, dan angka yang muncul tanpa
 * diminta terlihat seperti sudut sekarang padahal mungkin sudah basi.
 */
export function terapkanBacaan(k: KeadaanGeser, b: BacaanHaVa, nowMs: number): KeadaanGeser {
  if (k.baca.fase !== "menunggu" || !b.ada) return k;
  if (b.gagal) {
    return {
      ...k,
      baca: {
        ...BACA_DIAM,
        fase: "gagal",
        pesan: "Instrumen tidak menjawab (000,00,00). Pastikan instrumen menyala, lalu baca lagi.",
      },
    };
  }
  return { ...k, baca: { fase: "ada", HA: b.HA, VA: b.VA, waktuMs: nowMs, pesan: null } };
}

export function tutupBacaTanpaJawaban(k: KeadaanGeser, pesan: string): KeadaanGeser {
  if (k.baca.fase !== "menunggu") return k;
  return { ...k, baca: { ...BACA_DIAM, fase: "gagal", pesan } };
}

/** Sudut yang terpampang tidak berlaku lagi begitu instrumen bergerak. */
export function kosongkanBacaan(k: KeadaanGeser): KeadaanGeser {
  return k.baca.fase === "diam" ? k : { ...k, baca: BACA_DIAM };
}

// ── Geser ───────────────────────────────────────────────────────────────────

/** Dipanggil saat jog mulai dikirim. Bacaan lama dikosongkan: instrumen akan bergerak. */
export function mulaiGeser(k: KeadaanGeser, ha: number, va: number, nowMs: number): KeadaanGeser {
  return {
    baca: BACA_DIAM,
    geser: { ...GESER_DIAM, fase: "menunggu", ha, va, mulaiMs: nowMs },
  };
}

/**
 * Balasan `Jog`. Hanya diterapkan saat panel menunggu jog-nya sendiri: jog dari
 * halaman lain (Prism Config) menjawab di topik yang sama.
 */
export function terapkanJog(k: KeadaanGeser, b: BalasanJog): KeadaanGeser {
  if (k.geser.fase !== "menunggu" || b.jenis === "bukan") return k;

  switch (b.jenis) {
    case "ditolak":
      return {
        ...k,
        geser: {
          ...k.geser,
          fase: "gagal",
          pesan: SEBAB_TOLAK_JOG[b.nilai] ?? `Geseran ditolak: ${b.nilai}`,
          dariHA: b.HA ?? k.geser.dariHA,
          dariVA: b.VA ?? k.geser.dariVA,
        },
      };
    case "target":
      return {
        ...k,
        geser: { ...k.geser, dariHA: b.dariHA, dariVA: b.dariVA, keHA: b.keHA, keVA: b.keVA },
      };
    case "selesai":
      return { baca: BACA_DIAM, geser: { ...k.geser, fase: "selesai", pesan: null } };
    case "tahap":
      return k;
  }
}

export function tutupGeserTanpaJawaban(k: KeadaanGeser, pesan: string): KeadaanGeser {
  if (k.geser.fase !== "menunggu") return k;
  return { ...k, geser: { ...k.geser, fase: "gagal", pesan } };
}

// ── Isian operator ──────────────────────────────────────────────────────────

/**
 * Urai isian geseran ke derajat desimal. Bentuk yang diterima:
 *
 *   "0.5" / "-0,25"   desimal, titik atau koma
 *   "0,30,00"         d,m,s — DUA koma. Tanda minus di derajat berlaku untuk
 *                     seluruhnya ("-0,30,00" = −0,5°), bukan hanya derajatnya.
 *
 * Kosong → 0 (tidak digeser pada sumbu itu). Mengembalikan null kalau bentuknya
 * salah; bukan 0, supaya kesalahan ketik tidak lolos menjadi "tidak geser".
 *
 * Koma tunggal dibaca desimal ("0,5"), dua koma dibaca d,m,s ("0,30,00") —
 * keduanya lazim di sini dan tidak ambigu karena jumlah komanya.
 */
export function uraiGeseran(teks: string): number | null {
  const t = teks.trim();
  if (t === "") return 0;

  const negatif = t.startsWith("-");
  const tanpaTanda = negatif || t.startsWith("+") ? t.slice(1).trim() : t;

  const jumlahKoma = (tanpaTanda.match(/,/g) ?? []).length;
  let nilai: number | null;
  if (jumlahKoma >= 2) {
    // uraiSudutSapuan menolak menit/detik ≥ 60 dan bagian yang bukan angka.
    nilai = uraiSudutSapuan(tanpaTanda);
  } else {
    const desimal = tanpaTanda.replace(",", ".");
    nilai = /^\d+(\.\d+)?$/.test(desimal) ? Number(desimal) : null;
  }
  if (nilai === null) return null;
  return negatif ? -nilai : nilai;
}

export type HasilCekGeseran =
  | { ok: true; ha: number; va: number; ada: boolean }
  | { ok: false; galat: string };

/**
 * Periksa isian ΔHA/ΔVA. `ada: false` berarti keduanya kosong atau nol — bukan
 * galat, hanya "tidak ada yang digeser", dan sapuan jalan dari arah sekarang.
 */
export function cekGeseran(haTeks: string, vaTeks: string): HasilCekGeseran {
  const ha = uraiGeseran(haTeks);
  const va = uraiGeseran(vaTeks);
  if (ha === null || va === null) {
    return { ok: false, galat: "Geseran berbentuk derajat desimal (mis. 0,5) atau d,m,s (mis. 0,30,00); minus untuk arah sebaliknya" };
  }
  if (ha === 0 && va === 0) return { ok: true, ha: 0, va: 0, ada: false };

  // Aturan yang sama dengan route jog, supaya tombolnya mati di sini dan bukan
  // baru ditolak sesudah diklik.
  const galat = validasiJog(ha, va);
  if (galat) return { ok: false, galat };
  return { ok: true, ha, va, ada: true };
}

export { MAKS_JOG_DERAJAT };
