/**
 * Alarm suara ambang batas di dasbor: aturan kapan berbunyi, dan bentuk bunyinya.
 *
 * Sumber tingkatnya `status_prisma.tingkat` — tingkat yang DIAKUI jalur
 * peringatan (evaluasi-siklus.ts), sama dengan yang memutuskan pesan WhatsApp.
 * Bukan tingkat yang dihitung ulang di peramban: kalau layar berbunyi "Awas"
 * sementara grup WhatsApp diam (atau sebaliknya), operator berhenti mempercayai
 * keduanya.
 *
 * Modul ini MURNI — tanpa window, tanpa AudioContext, tanpa localStorage —
 * supaya aturannya bisa diuji tanpa peramban. Pemutarnya di suara-alarm.ts.
 */
import { type StatusLabel, indeksStatus } from "@/lib/ambang";

export type TingkatAlarm = Exclude<StatusLabel, "Normal">;

export const TINGKAT_ALARM: readonly TingkatAlarm[] = ["Waspada", "Siaga", "Awas"];

/** Satu prisma yang sedang di atas Normal. Bentuk balasan GET /api/alarm-ambang. */
export interface PrismaAlarm {
  site: string;
  namaSite: string;
  idPrisma: string;
  tingkat: TingkatAlarm;
  nilaiMm: number | null;
  /** Waktu siklus terakhir yang menilai prisma ini, "YYYY-MM-DD HH:mm:ss" jam dinding. */
  waktu: string | null;
}

/**
 * Tingkat yang sudah didengar operator, per "site|prisma".
 *
 * Per prisma dan per tingkat, bukan satu saklar "sudah dimatikan": mematikan
 * bunyi Waspada di P2 tidak boleh ikut membungkam P2 yang naik ke Awas, atau
 * P5 yang baru menyusul ke Waspada.
 */
export type Diakui = Record<string, TingkatAlarm>;

export function kunciPrisma(p: { site: string; idPrisma: string }): string {
  return `${p.site}|${p.idPrisma}`;
}

export function terburuk(daftar: readonly { tingkat: TingkatAlarm }[]): TingkatAlarm | null {
  let hasil: TingkatAlarm | null = null;
  for (const p of daftar) {
    if (!hasil || indeksStatus(p.tingkat) > indeksStatus(hasil)) hasil = p.tingkat;
  }
  return hasil;
}

/**
 * Prisma yang tingkatnya DI ATAS yang sudah diakui — inilah yang membuat bunyi.
 * Prisma yang turun tingkat tidak pernah masuk sini: kabar membaik tidak perlu
 * sirene.
 */
export function belumDiakui(daftar: readonly PrismaAlarm[], diakui: Diakui): PrismaAlarm[] {
  return daftar.filter((p) => {
    const sudah = diakui[kunciPrisma(p)];
    return !sudah || indeksStatus(p.tingkat) > indeksStatus(sudah);
  });
}

/** Tombol "Matikan bunyi": semua yang sedang tampil dianggap sudah didengar. */
export function akuiSemua(daftar: readonly PrismaAlarm[], diakui: Diakui): Diakui {
  const hasil: Diakui = { ...diakui };
  for (const p of daftar) {
    const sudah = hasil[kunciPrisma(p)];
    if (!sudah || indeksStatus(p.tingkat) > indeksStatus(sudah)) hasil[kunciPrisma(p)] = p.tingkat;
  }
  return hasil;
}

/**
 * Selaraskan catatan "sudah didengar" dengan keadaan sekarang.
 *
 * - Prisma yang kembali Normal (atau sudah dihapus) dibuang dari catatan, jadi
 *   kenaikan berikutnya berbunyi lagi dari awal.
 * - Prisma yang TURUN tingkat ikut diturunkan catatannya. Tanpa ini, Awas yang
 *   sudah didengar lalu turun ke Siaga dan naik lagi ke Awas akan diam — padahal
 *   itu kenaikan baru.
 */
export function rapikanDiakui(diakui: Diakui, daftar: readonly PrismaAlarm[]): Diakui {
  const sekarang = new Map(daftar.map((p) => [kunciPrisma(p), p.tingkat]));
  const hasil: Diakui = {};
  for (const [kunci, sudah] of Object.entries(diakui)) {
    const kini = sekarang.get(kunci);
    if (!kini) continue;
    hasil[kunci] = indeksStatus(kini) < indeksStatus(sudah) ? kini : sudah;
  }
  return hasil;
}

export function samaDiakui(a: Diakui, b: Diakui): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}

/** Baca catatan dari localStorage; isi yang rusak atau asing dibuang, tidak dilempar. */
export function uraiDiakui(teks: string | null): Diakui {
  if (!teks) return {};
  try {
    const mentah = JSON.parse(teks) as unknown;
    if (!mentah || typeof mentah !== "object" || Array.isArray(mentah)) return {};
    const hasil: Diakui = {};
    for (const [k, v] of Object.entries(mentah as Record<string, unknown>)) {
      if ((TINGKAT_ALARM as readonly unknown[]).includes(v)) hasil[k] = v as TingkatAlarm;
    }
    return hasil;
  } catch {
    return {};
  }
}

// ─── Bentuk bunyi ───────────────────────────────────────────────────────────
//
// Tiap tingkat harus bisa dikenali dari bunyinya saja, tanpa melihat layar:
// operator di ruang kontrol yang mendengar dari meja sebelah perlu tahu seberapa
// cepat ia harus berdiri.
//
//   Waspada  satu bip pendek tiap 4 detik       — "ada yang berubah"
//   Siaga    dua bip cepat tiap 2 detik         — "periksa sekarang"
//   Awas     sirene naik-turun tanpa jeda       — "bertindak"

export interface Nada {
  /** Detik sejak awal pola. */
  mulai: number;
  durasi: number;
  frekDari: number;
  frekKe: number;
  /** Naik ke frekKe lalu kembali ke frekDari dalam satu nada (bunyi sirene). */
  bolakBalik?: boolean;
}

export interface Pola {
  /** Panjang satu putaran dalam detik; diputar berulang tanpa celah. */
  periode: number;
  nada: Nada[];
}

export const POLA_BUNYI: Record<TingkatAlarm, Pola> = {
  Waspada: {
    periode: 4,
    nada: [{ mulai: 0, durasi: 0.35, frekDari: 880, frekKe: 880 }],
  },
  Siaga: {
    periode: 2,
    nada: [
      { mulai: 0, durasi: 0.2, frekDari: 1046, frekKe: 1046 },
      { mulai: 0.3, durasi: 0.2, frekDari: 1046, frekKe: 1046 },
    ],
  },
  Awas: {
    periode: 1.2,
    nada: [{ mulai: 0, durasi: 1.2, frekDari: 650, frekKe: 1300, bolakBalik: true }],
  },
};

/** Lama naik/turun volume tiap nada. Tanpanya tiap awal dan akhir nada berbunyi "klik". */
const LANDAI_DETIK = 0.012;

/**
 * Sampel PCM satu putaran pola, nilai -1..1.
 *
 * Dibentuk sekali lalu diputar berulang (AudioBufferSourceNode.loop), bukan
 * dijadwalkan bip demi bip dengan setInterval: peramban memperlambat timer di
 * tab yang tidak sedang dilihat — dan ruang kontrol justru biasanya membuka
 * dasbor di tab belakang.
 */
export function sintesisPola(pola: Pola, sampleRate: number): Float32Array {
  const panjang = Math.round(pola.periode * sampleRate);
  const data = new Float32Array(panjang);

  for (const n of pola.nada) {
    const awal = Math.round(n.mulai * sampleRate);
    const jumlah = Math.min(Math.round(n.durasi * sampleRate), panjang - awal);
    const landai = Math.max(1, Math.round(LANDAI_DETIK * sampleRate));
    let fase = 0;
    for (let i = 0; i < jumlah; i++) {
      const t = i / jumlah;
      const geser = n.bolakBalik ? 1 - Math.abs(2 * t - 1) : t;
      const frek = n.frekDari + (n.frekKe - n.frekDari) * geser;
      fase += (2 * Math.PI * frek) / sampleRate;
      const amplop = Math.min(1, i / landai, (jumlah - 1 - i) / landai);
      // Harmonik ketiga membuat bunyinya lebih menusuk daripada sinus polos
      // dari speaker laptop yang kecil, tanpa sekeras gelombang kotak.
      data[awal + i] += amplop * (0.8 * Math.sin(fase) + 0.2 * Math.sin(3 * fase));
    }
  }
  return data;
}
