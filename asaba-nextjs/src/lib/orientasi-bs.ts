/**
 * Nol set horizontal RTS dari koordinat survei backsight — aturan murni.
 *
 * Rumus dari tim lapangan (28 Nov 2026), dalam satuan sudut alat (gon):
 *
 *   Az = atan2(E_BS − E_STA, N_BS − N_STA)        azimut grid RTS -> BS
 *   Z  = (Az − HA_BS) mod 400                       nol set dari satu BS
 *   Zm = rata-rata sirkular Z semua BS
 *   AzP = (HA + Zm) mod 400                         azimut tiap prisma
 *
 * Website memakai Zm sebagai `t_site.ha_orientasi_deg` (= Zm × faktor derajat)
 * dan menghitungnya SEKALI dari bacaan BS di sesi acuan, bukan tiap siklus.
 * Alasannya diukur, bukan diduga: kedua BS di Kolam BPP hanya 17,9 m dan 30 m
 * dari alat. Bacaan HA-nya bergeser sampai 5 mgon semalam sementara foresight
 * tidak ikut bergeser — jadi yang bergerak tiang/bidikan BS, bukan alatnya.
 * Memakai Z per siklus memasukkan gerak itu ke setiap foresight: pada 105 sesi
 * 27-28 Nov, rata-rata geser P1 naik dari 3,9 ke 13,9 mm, P4 dari 28,5 ke
 * 44,1 mm. 1 mgon di BS = 18 mm pada prisma 1.147 m.
 *
 * Pemeriksaan yang ikut dihitung, supaya salah pasang langsung kelihatan:
 *   - bedaJarakMm: jarak datar terukur vs jarak dari koordinat survei. Slot
 *     yang dipasangkan ke titik survei yang salah meleset belasan meter.
 *   - hiMinHt: tinggi alat − tinggi prisma BS yang membuat tinggi terukur sama
 *     dengan tinggi survei. Antar-BS mestinya hampir sama.
 *   - sebaranMgon: simpangan terbesar Z satu BS dari Zm.
 */

export interface Titik {
  E: number;
  N: number;
  H: number;
}

/** Bacaan satu BS: sudut dalam satuan alat (gon bila faktor 0,9), SD meter. */
export interface BacaanBs {
  ha: number;
  va: number;
  sd: number;
}

export interface HasilBs {
  /** Nol set dari BS ini, satuan alat. */
  z: number;
  /** Azimut grid RTS -> BS dari koordinat, satuan alat. */
  azimut: number;
  hdUkur: number;
  hdSurvei: number;
  bedaJarakMm: number;
  /** Tinggi alat − tinggi prisma BS (m) yang menyamakan tinggi terukur dengan survei. */
  hiMinHt: number;
}

export interface HasilNolSet {
  /** Rata-rata sirkular, satuan alat, 0 ≤ z < lingkaran. */
  z: number;
  /** Simpangan terbesar satu BS dari rata-ratanya, mili-satuan (mgon). */
  sebaranMili: number;
}

/** Lingkaran penuh dalam satuan alat: 400 untuk gon, 360 untuk derajat. */
export const lingkaran = (faktorDerajat: number) => 360 / faktorDerajat;

const norm = (v: number, penuh: number) => ((v % penuh) + penuh) % penuh;

/** Selisih bertanda a − b, dibungkus ke (−½ lingkaran, ½ lingkaran]. */
export function selisihSudut(a: number, b: number, penuh: number): number {
  let d = norm(a - b, penuh);
  if (d > penuh / 2) d -= penuh;
  return d;
}

export function nolSetDariBs(
  stasiun: Titik,
  titik: Titik,
  bacaan: BacaanBs,
  faktorDerajat: number
): HasilBs | null {
  const { ha, va, sd } = bacaan;
  if (![ha, va, sd, titik.E, titik.N].every(Number.isFinite) || sd <= 0 || va <= 0) return null;
  const penuh = lingkaran(faktorDerajat);
  const dE = titik.E - stasiun.E;
  const dN = titik.N - stasiun.N;
  const hdSurvei = Math.hypot(dE, dN);
  if (hdSurvei < 0.001) return null;

  const azimut = norm((Math.atan2(dE, dN) * 180) / Math.PI / faktorDerajat, penuh);
  const vaRad = (va * faktorDerajat * Math.PI) / 180;
  const hdUkur = sd * Math.sin(vaRad);
  const dh = sd * Math.cos(vaRad);
  return {
    z: norm(azimut - ha, penuh),
    azimut,
    hdUkur,
    hdSurvei,
    bedaJarakMm: (hdUkur - hdSurvei) * 1000,
    hiMinHt: Number.isFinite(titik.H) ? titik.H - stasiun.H - dh : NaN,
  };
}

/** Rata-rata sirkular beberapa nol set. Null bila kosong. */
export function rataNolSet(zs: number[], faktorDerajat: number): HasilNolSet | null {
  if (zs.length === 0) return null;
  const penuh = lingkaran(faktorDerajat);
  const k = (2 * Math.PI) / penuh;
  const s = zs.reduce((a, z) => a + Math.sin(z * k), 0);
  const c = zs.reduce((a, z) => a + Math.cos(z * k), 0);
  const z = norm(Math.atan2(s, c) / k, penuh);
  const sebaranMili = Math.max(...zs.map((v) => Math.abs(selisihSudut(v, z, penuh)))) * 1000;
  return { z, sebaranMili };
}

// ── Cek BS per siklus ───────────────────────────────────────────────────────
//
// Bacaan BS tiap siklus TIDAK dipakai mengoreksi foresight (lihat atas), tapi
// justru itu yang membedakan alat berputar dari lereng bergerak: alat yang
// berputar 15 mgon membuat P4 (1.147 m) tampak bergeser ~27 cm, dan pada saat
// yang sama kedua BS ikut bergeser 15 mgon. Variasi normal di Kolam BPP:
// ±1–3 mgon antar-siklus, hanyut sampai ~6 mgon semalam (27-28 Nov 2026).

/** Batas perubahan orientasi dari BS terhadap acuan, mili-satuan (mgon). ~3× hanyut semalam. */
export const AMBANG_CEK_BS_MILI = 15;

export interface CekBs {
  /** Perubahan nol set dari tiap BS terhadap acuannya (= −ΔHA), mili-satuan. */
  perBs: Array<{ id: string; dZMili: number }>;
  /** Rata-ratanya. Null bila tidak ada BS yang terbaca di kedua sesi. */
  dZMili: number | null;
  ambangMili: number;
  /** Ada BS yang melewati ambang. */
  lewat: boolean;
  /**
   * Semua BS bergeser serupa (sebaran ≤ ambang) — tanda alatnya yang berputar.
   * Null bila hanya satu BS.
   */
  sepakat: boolean | null;
}

/**
 * Bandingkan HA tiap BS di satu sesi dengan HA-nya di acuan (R0 atau acuan
 * baru sesudah arah bidik diperbarui). Satuan alat.
 */
export function cekOrientasiBs(
  acuan: Map<string, number>,
  sesi: Map<string, number>,
  faktorDerajat: number,
  ambangMili = AMBANG_CEK_BS_MILI
): CekBs {
  const penuh = lingkaran(faktorDerajat);
  const perBs: CekBs["perBs"] = [];
  for (const [id, haAcuan] of acuan) {
    const ha = sesi.get(id);
    if (ha === undefined || !Number.isFinite(ha) || !Number.isFinite(haAcuan)) continue;
    perBs.push({ id, dZMili: -selisihSudut(ha, haAcuan, penuh) * 1000 });
  }
  if (perBs.length === 0) return { perBs, dZMili: null, ambangMili, lewat: false, sepakat: null };
  const nilai = perBs.map((b) => b.dZMili);
  return {
    perBs,
    dZMili: nilai.reduce((a, b) => a + b, 0) / nilai.length,
    ambangMili,
    lewat: nilai.some((v) => Math.abs(v) > ambangMili),
    sepakat: nilai.length > 1 ? Math.max(...nilai) - Math.min(...nilai) <= ambangMili : null,
  };
}

/** Kalimat peringatan untuk operator, atau null bila tidak melewati ambang. */
export function pesanCekBs(cek: CekBs, satuan: string, nama: (id: string) => string = (id) => id): string | null {
  if (!cek.lewat || cek.dZMili === null) return null;
  const angka = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1).replace(".", ",")} m${satuan}`;
  const rinci = cek.perBs.map((b) => `${nama(b.id)} ${angka(b.dZMili)}`).join(", ");
  if (cek.sepakat) {
    return (
      `Orientasi alat bergeser ${angka(cek.dZMili)} dari acuan menurut backsight (${rinci}). ` +
      `Alat kemungkinan berputar atau tersenggol — cek alat sebelum mempercayai pergeseran sesi ini.`
    );
  }
  const lewat = cek.perBs.filter((b) => Math.abs(b.dZMili) > cek.ambangMili).map((b) => nama(b.id));
  return (
    `Backsight ${lewat.join(", ")} bergeser dari acuannya (${rinci})` +
    (cek.perBs.length > 1 ? " sementara backsight lain tidak" : "") +
    `. Cek prisma backsight itu (tiang, halangan) atau alatnya.`
  );
}

/** Batas nol set yang boleh disimpan, satuan alat. */
export function validasiNolSet(v: unknown, faktorDerajat: number): string | null {
  const n = Number(v);
  if (v === null || v === undefined || String(v).trim() === "" || !Number.isFinite(n)) {
    return "Nol set wajib berupa angka";
  }
  if (n < 0 || n >= lingkaran(faktorDerajat)) return `Nol set harus 0 sampai di bawah ${lingkaran(faktorDerajat)}`;
  return null;
}

/** Tinggi alat yang masuk akal untuk tripod/pilar, meter. */
export function validasiTinggiAlat(v: unknown): string | null {
  const n = Number(v);
  if (v === null || v === undefined || String(v).trim() === "" || !Number.isFinite(n)) {
    return "Tinggi alat wajib berupa angka";
  }
  if (n < 0 || n > 5) return "Tinggi alat harus 0–5 m";
  return null;
}
