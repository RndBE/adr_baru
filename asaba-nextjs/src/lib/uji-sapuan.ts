/**
 * Keadaan panel "Uji sapuan custom" di Kontrol ADR — reducer murni di atas
 * `bacaBalasanSapuan()`.
 *
 * Dipisah dari komponen supaya urutan balasan firmware (ADR_RTS_PORTING §3.2)
 * bisa diputar ulang di tes tanpa instrumen, dan karena keadaannya dipegang
 * halaman, bukan modal: sapuan bisa berjalan puluhan menit, dan balasannya
 * tidak boleh hilang hanya karena modalnya ditutup.
 *
 * Jalankan tes: npx tsx src/lib/uji-sapuan.test.ts
 */
import type { BalasanSapuan, KelasBalasan } from "./protokol-rts";

export type FaseSapuan =
  /** Tidak ada sapuan. */
  | "diam"
  /** Perintah terkirim, belum ada balasan firmware. */
  | "mengirim"
  /** Firmware sudah menjawab; sapuan berjalan. */
  | "berjalan"
  /** Hasil akhir sudah datang. */
  | "selesai"
  /** Ditolak, atau berhenti sebelum ada hasil akhir. */
  | "ditolak";

export type ParameterUji = {
  slot: number | null;
  step: string;
  Hlebar: string;
  Vlebar: string;
  rehat: string;
  /** Jarak ke target menurut operator, meter. Hanya catatan; tidak dikirim. */
  jarakM: number | null;
  titik: number;
};

export type TitikTembak = {
  tembakan: number;
  dari: number;
  ha?: string;
  va?: string;
  SDis: string;
  kena: boolean;
  rotateGagal: boolean;
};

export type HasilRiwayat = "ketemu" | "gagal" | "dibatalkan" | "ditolak";

export type EntriRiwayatUji = {
  waktuMs: number;
  parameter: ParameterUji;
  hasil: HasilRiwayat;
  SDis?: string;
  titikKe?: number;
  tembakan?: number;
  dari?: number;
  durasiDetik: number;
  pesan?: string;
};

export type KeadaanSapuan = {
  fase: FaseSapuan;
  /** check / read / search / measure — tahap terakhir sebelum sapuan jalan. */
  tahap: string;
  titik: number | null;
  tembakan: number;
  dari: number | null;
  /** Beberapa titik terakhir saja; sapuan penuh bisa ribuan titik. */
  titikTerakhir: TitikTembak[];
  /** Penutup sapuan (ketemu / habis / dibatalkan) — hasil akhir menyusul. */
  penutup: { nilai: string; titikKe?: number } | null;
  hasil: { hasil: "ketemu" | "gagal"; SDis?: string; HA?: string; VA?: string } | null;
  pesan: string | null;
  keterangan: string | null;
  stopDiminta: boolean;
  mulaiMs: number | null;
  parameter: ParameterUji | null;
  riwayat: EntriRiwayatUji[];
  /** Arah bidik ke slot (turning_target). Titik tengah sapuan = arah ini. */
  arah: "diam" | "menunggu" | "selesai" | "gagal";
  arahSlot: number | null;
};

export const MAKS_TITIK_TERAKHIR = 8;
export const MAKS_RIWAYAT_UJI = 30;

/** Batas tunggu balasan pertama. Firmware menjawab `check` dalam hitungan detik. */
export const BATAS_JAWAB_PERTAMA_MS = 20_000;

const SEGAR: Omit<KeadaanSapuan, "riwayat" | "arah" | "arahSlot"> = {
  fase: "diam",
  tahap: "",
  titik: null,
  tembakan: 0,
  dari: null,
  titikTerakhir: [],
  penutup: null,
  hasil: null,
  pesan: null,
  keterangan: null,
  stopDiminta: false,
  mulaiMs: null,
  parameter: null,
};

export function keadaanAwal(): KeadaanSapuan {
  return { ...SEGAR, riwayat: [], arah: "diam", arahSlot: null };
}

const aktif = (k: KeadaanSapuan) => k.fase === "mengirim" || k.fase === "berjalan";

function tutupDenganEntri(
  k: KeadaanSapuan,
  nowMs: number,
  hasil: HasilRiwayat,
  tambahan: Partial<EntriRiwayatUji> = {}
): EntriRiwayatUji[] {
  // Tanpa parameter berarti sapuan ini dimulai dari luar halaman (mis. alat
  // lain) — tampil di panel, tapi tidak dicatat karena tidak diketahui
  // parameternya.
  if (!k.parameter) return k.riwayat;
  const entri: EntriRiwayatUji = {
    waktuMs: nowMs,
    parameter: k.parameter,
    hasil,
    tembakan: k.tembakan,
    dari: k.dari ?? undefined,
    durasiDetik: k.mulaiMs === null ? 0 : Math.max(0, Math.round((nowMs - k.mulaiMs) / 1000)),
    ...tambahan,
  };
  return [entri, ...k.riwayat].slice(0, MAKS_RIWAYAT_UJI);
}

/** Dipanggil saat perintah mulai dikirim. Riwayat dan arah dipertahankan. */
export function mulaiKirim(k: KeadaanSapuan, parameter: ParameterUji, nowMs: number): KeadaanSapuan {
  return {
    ...SEGAR,
    fase: "mengirim",
    mulaiMs: nowMs,
    parameter,
    titik: parameter.titik,
    riwayat: k.riwayat,
    arah: k.arah,
    arahSlot: k.arahSlot,
  };
}

/** Perintah gagal terkirim atau tidak pernah dijawab. */
export function tutupTanpaJawaban(k: KeadaanSapuan, pesan: string): KeadaanSapuan {
  if (k.fase !== "mengirim") return k;
  return { ...k, fase: "ditolak", pesan, keterangan: null };
}

/**
 * Terapkan satu balasan `autosearch` ke keadaan.
 *
 * Balasan yang datang saat tidak ada sapuan aktif DIABAIKAN, kecuali yang
 * membuka sapuan baru (`check` atau pesan mulai): itu satu-satunya cara tahu
 * ada sapuan yang dimulai dari luar halaman ini, dan sisa pesan sapuan yang
 * sudah ditutup tidak boleh menghidupkannya lagi.
 */
export function terapkanBalasan(k: KeadaanSapuan, b: BalasanSapuan, nowMs: number): KeadaanSapuan {
  if (b.jenis === "bukan") return k;

  if (!aktif(k)) {
    const membuka = (b.jenis === "tahap" && b.nilai === "check") || b.jenis === "mulai";
    if (!membuka) return k;
    k = { ...SEGAR, fase: "berjalan", mulaiMs: nowMs, riwayat: k.riwayat, arah: k.arah, arahSlot: k.arahSlot };
  }

  switch (b.jenis) {
    case "tahap":
      return { ...k, fase: "berjalan", tahap: b.nilai };

    case "mulai":
      return {
        ...k,
        fase: "berjalan",
        tahap: "sweep",
        titik: b.titik ?? k.titik,
        dari: b.titik ?? k.dari,
        tembakan: 0,
      };

    case "titik": {
      const titik: TitikTembak = {
        tembakan: b.tembakan ?? k.tembakan + 1,
        dari: b.dari ?? k.dari ?? 0,
        ha: b.ha,
        va: b.va,
        SDis: b.SDis ?? "",
        kena: b.kena === true,
        rotateGagal: b.rotateGagal === true,
      };
      return {
        ...k,
        fase: "berjalan",
        tahap: "sweep",
        tembakan: titik.tembakan,
        dari: titik.dari || k.dari,
        titikTerakhir: [...k.titikTerakhir, titik].slice(-MAKS_TITIK_TERAKHIR),
      };
    }

    case "akhir":
      return {
        ...k,
        // Hasil akhir MENYUSUL; fase sengaja tetap "berjalan".
        penutup: { nilai: b.nilai, titikKe: b.titikKe },
        tembakan: b.tembakan ?? k.tembakan,
        dari: b.dari ?? b.titik ?? k.dari,
      };

    case "hasil": {
      const dibatalkan = k.penutup?.nilai === "dibatalkan";
      const hasil = b.hasil ?? "gagal";
      return {
        ...k,
        fase: "selesai",
        hasil: { hasil, SDis: b.SDis, HA: b.HA, VA: b.VA },
        stopDiminta: false,
        riwayat: tutupDenganEntri(k, nowMs, dibatalkan ? "dibatalkan" : hasil, {
          SDis: b.SDis,
          titikKe: k.penutup?.titikKe,
        }),
      };
    }

    case "ditolak":
      return {
        ...k,
        fase: "ditolak",
        pesan: b.pesan ?? b.nilai,
        keterangan: b.keterangan ?? null,
        stopDiminta: false,
        // Hanya sapuan yang sempat jalan yang dicatat; penolakan di gerbang
        // ("sedang sibuk", nilai di luar batas) tidak menghasilkan data uji.
        riwayat: k.fase === "berjalan" && k.tahap === "sweep"
          ? tutupDenganEntri(k, nowMs, "ditolak", { pesan: b.pesan ?? b.nilai })
          : k.riwayat,
      };

    case "stop":
      return b.nilai === "stop diminta" ? { ...k, stopDiminta: true } : k;
  }
}

export function mulaiArah(k: KeadaanSapuan, slot: number): KeadaanSapuan {
  return { ...k, arah: "menunggu", arahSlot: slot };
}

/** Balasan `TurningTarget`: hanya diterapkan saat panel memang menunggu arah. */
export function terapkanArah(k: KeadaanSapuan, kelas: KelasBalasan | "bukan"): KeadaanSapuan {
  if (k.arah !== "menunggu" || kelas === "bukan" || kelas === "kemajuan") return k;
  return { ...k, arah: kelas === "selesai" ? "selesai" : "gagal" };
}

export function arahGagalTerkirim(k: KeadaanSapuan): KeadaanSapuan {
  return k.arah === "menunggu" ? { ...k, arah: "gagal" } : k;
}

/**
 * Lebar di lapangan (meter) dari sudut `derajat` pada jarak `jarakM`.
 * Untuk membandingkan langkah dan rentang dengan ukuran prisma di jarak itu.
 */
export function lebarDiJarak(derajat: number, jarakM: number): number {
  return jarakM * Math.tan((derajat * Math.PI) / 180);
}

export function formatDurasi(detik: number): string {
  if (detik < 60) return `${detik} dtk`;
  const m = Math.floor(detik / 60);
  const d = detik % 60;
  if (m < 60) return d === 0 ? `${m} mnt` : `${m} mnt ${d} dtk`;
  const j = Math.floor(m / 60);
  return `${j} jam ${m % 60} mnt`;
}

export function formatMeter(m: number): string {
  if (m >= 100) return `${Math.round(m)} m`;
  if (m >= 10) return `${m.toFixed(1)} m`;
  return `${m.toFixed(2)} m`;
}
