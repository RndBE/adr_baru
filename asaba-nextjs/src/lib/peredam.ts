/**
 * Peredam: memutuskan perubahan tingkat mana yang layak jadi pesan.
 *
 * Alasannya ada di basis data ini sendiri. Tabel `log_siaga` warisan aplikasi
 * CodeIgniter menyimpan 224 perubahan status dari dua logger AWLR antara Juni
 * 2024 dan November 2025 — sistem lama yang memakai ambang tanpa peredam apa
 * pun. Hasilnya:
 *
 *   15-06-2024 11.42–11.53  enam perubahan status dalam sebelas menit,
 *                           sementara nilai terukurnya bergerak 0,612 → 0,621
 *   27-06-2024              75 perubahan dalam satu hari
 *   keseluruhan             63% perubahan terjadi < 5 menit sejak yang sebelumnya
 *
 * Itu bukan tanah yang bergerak, itu derau pengukuran yang terbaca sebagai
 * eskalasi bahaya. Peringatan yang berbunyi 75 kali sehari akan dimatikan orang
 * dalam seminggu, dan sesudah itu ia tidak melindungi apa pun — termasuk pada
 * bunyi ke-76 yang mungkin sungguhan. Jadi peredam di sini bukan penghalus
 * pengalaman; ia bagian dari fungsi keselamatannya.
 *
 * Modul ini MURNI: tanpa Prisma, tanpa jam sistem, tanpa I/O. Semua yang
 * berubah masuk lewat argumen dan keluar lewat nilai balik, supaya keputusannya
 * bisa diuji tanpa perangkat dan tanpa basis data.
 */
import {
  type AmbangSite,
  type StatusLabel,
  batasMasuk,
  indeksStatus,
  lebihGawat,
  statusPergeseran,
} from "@/lib/ambang";

/** Keadaan satu prisma yang bertahan antar siklus. Cerminan baris `status_prisma`. */
export interface KeadaanPrisma {
  /** Tingkat yang sudah DIAKUI — yang dipakai membandingkan perubahan. */
  tingkat: StatusLabel;
  /** Tingkat yang sedang menunggu konfirmasi. Null bila tidak ada. */
  tingkatCalon: StatusLabel | null;
  /** Sudah berapa siklus beruntun `tingkatCalon` terlihat. */
  hitungCalon: number;
  /** Kapan pesan terakhir untuk prisma ini berangkat. Null bila belum pernah. */
  kirimTerakhirMs: number | null;
}

export interface KebijakanPeredam {
  /** Berapa siklus beruntun sebuah tingkat baru harus terlihat sebelum diakui. */
  konfirmasiSiklus: number;
  /** Jarak minimum antar pesan untuk satu prisma, dalam milidetik WAKTU DINDING. */
  jedaMs: number;
  /** Tingkat terendah yang layak dikirim. Di bawahnya dicatat tapi didiamkan. */
  kirimMulaiDari: StatusLabel;
  /**
   * Lebar histeresis sebagai pecahan dari batas masuk tingkat yang berlaku.
   * 0,1 berarti nilai harus turun 10% di bawah batas itu sebelum penurunan diakui.
   */
  histeresisRasio: number;
}

/**
 * Bawaan yang diusulkan, bukan yang paling sunyi.
 *
 * `jedaMs` 30 menit dipilih karena di situ kurvanya mendatar: pada 224 baris
 * riwayat tadi, "naik saja + jeda 30 menit" menyisakan 46 pesan dari 224;
 * menaikkannya ke tiga jam hanya menghapus 16 pesan lagi sambil menambah risiko
 * menelan eskalasi sungguhan yang terjadi cepat.
 *
 * `jedaMs` sengaja dalam waktu dinding, BUKAN jumlah siklus. `track_every` boleh
 * disetel 5 sampai 60 menit — rentang 12× — dan jeda berbasis siklus akan
 * membuat volume pesan ikut berlipat 12× di ujung yang cepat. Dengan waktu
 * dinding, volume maksimum terkunci di 48 pesan per hari per prisma apa pun
 * jadwalnya.
 *
 * `konfirmasiSiklus` justru KEBALIKANNYA — dihitung dalam siklus, karena satu
 * siklus adalah satu kali seluruh prisma ditembak ulang, dan itulah satuan
 * "bacaan berturut-turut" yang sebenarnya. Akibatnya perlu disadari: pada
 * `track_every` 60 menit, tiga siklus berarti peringatan tertunda tiga jam.
 */
export const KEBIJAKAN_BAWAAN: KebijakanPeredam = {
  konfirmasiSiklus: 3,
  jedaMs: 30 * 60 * 1000,
  kirimMulaiDari: "Siaga",
  histeresisRasio: 0.1,
};

export type AlasanDiam =
  | "tidak-berubah"
  | "tertahan-histeresis"
  | "belum-konfirmasi"
  | "bukan-kenaikan"
  | "di-bawah-ambang-kirim"
  | "dalam-jeda";

export interface HasilPeredam {
  /** Keadaan yang harus disimpan kembali ke `status_prisma`. */
  keadaan: KeadaanPrisma;
  /** Perubahan tingkat yang baru saja DIAKUI. Null bila belum ada yang berubah. */
  diakui: { dari: StatusLabel; ke: StatusLabel } | null;
  kirim: boolean;
  alasan: AlasanDiam | null;
}

export function keadaanAwal(): KeadaanPrisma {
  return { tingkat: "Normal", tingkatCalon: null, hitungCalon: 0, kirimTerakhirMs: null };
}

/**
 * Tingkat setelah histeresis diterapkan.
 *
 * Naik selalu langsung. Turun ditahan sampai nilainya cukup jauh di bawah batas
 * masuk tingkat yang sedang berlaku — tanpa ini, nilai yang menggantung persis
 * di ambang akan naik-turun selamanya, yang persis terlihat pada jendela
 * sebelas menit di log_siaga.
 */
export function tingkatEfektif(
  mm: number,
  ambang: AmbangSite,
  tingkatSekarang: StatusLabel,
  histeresisRasio: number
): StatusLabel {
  const terukur = statusPergeseran(mm, ambang);
  if (!lebihGawat(tingkatSekarang, terukur)) return terukur;

  // Turun: hanya diakui kalau sudah melewati batas masuk dikurangi margin.
  const batas = batasMasuk(tingkatSekarang, ambang);
  if (batas === null) return terukur;
  return mm < batas * (1 - histeresisRasio) ? terukur : tingkatSekarang;
}

/**
 * Satu keputusan peredam untuk satu prisma, pada akhir satu siklus.
 *
 * `sekarangMs` diambil dari cap waktu SIKLUS, bukan jam proses. Keduanya bisa
 * berselisih, dan yang menentukan "sudah berapa lama sejak pesan terakhir"
 * harus jam yang sama dengan yang dipakai menulis barisnya.
 */
export function nilaiPeredam(opsi: {
  keadaan: KeadaanPrisma;
  nilaiMm: number;
  ambang: AmbangSite;
  sekarangMs: number;
  kebijakan?: Partial<KebijakanPeredam>;
}): HasilPeredam {
  const k: KebijakanPeredam = { ...KEBIJAKAN_BAWAAN, ...opsi.kebijakan };
  const { keadaan, nilaiMm, ambang, sekarangMs } = opsi;

  const terukur = statusPergeseran(nilaiMm, ambang);
  const efektif = tingkatEfektif(nilaiMm, ambang, keadaan.tingkat, k.histeresisRasio);

  // Tidak berbeda dari yang sudah diakui — calon apa pun dibatalkan, karena
  // "tiga siklus beruntun" harus benar-benar beruntun.
  if (efektif === keadaan.tingkat) {
    return {
      keadaan: { ...keadaan, tingkatCalon: null, hitungCalon: 0 },
      diakui: null,
      kirim: false,
      alasan: terukur === keadaan.tingkat ? "tidak-berubah" : "tertahan-histeresis",
    };
  }

  const beruntun = efektif === keadaan.tingkatCalon ? keadaan.hitungCalon + 1 : 1;

  if (beruntun < k.konfirmasiSiklus) {
    return {
      keadaan: { ...keadaan, tingkatCalon: efektif, hitungCalon: beruntun },
      diakui: null,
      kirim: false,
      alasan: "belum-konfirmasi",
    };
  }

  // Terkonfirmasi.
  const dari = keadaan.tingkat;
  const ke = efektif;
  const dasar: KeadaanPrisma = {
    tingkat: ke,
    tingkatCalon: null,
    hitungCalon: 0,
    kirimTerakhirMs: keadaan.kirimTerakhirMs,
  };
  const diakui = { dari, ke };

  const naik = lebihGawat(ke, dari);
  // Pesan penutup: kembali ke Normal dari tingkat yang memang pernah dikirim.
  // Tanpa ini operator tidak pernah tahu keadaannya sudah pulih.
  const pulih = ke === "Normal" && indeksStatus(dari) >= indeksStatus(k.kirimMulaiDari);

  if (!naik && !pulih) {
    return { keadaan: dasar, diakui, kirim: false, alasan: "bukan-kenaikan" };
  }

  if (naik && indeksStatus(ke) < indeksStatus(k.kirimMulaiDari)) {
    return { keadaan: dasar, diakui, kirim: false, alasan: "di-bawah-ambang-kirim" };
  }

  // Jeda TIDAK berlaku untuk pesan pulih. Menahan kabar "sudah aman" tidak
  // melindungi siapa pun — ia cuma membuat peringatan sebelumnya menggantung.
  if (naik && keadaan.kirimTerakhirMs !== null && sekarangMs - keadaan.kirimTerakhirMs < k.jedaMs) {
    return { keadaan: dasar, diakui, kirim: false, alasan: "dalam-jeda" };
  }

  return {
    keadaan: { ...dasar, kirimTerakhirMs: sekarangMs },
    diakui,
    kirim: true,
    alasan: null,
  };
}
