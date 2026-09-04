/**
 * Riwayat satu prisma untuk halaman detail Hasil Pengukuran.
 *
 * /api/analisa mengembalikan koordinat UTM MENTAH (belum dikoreksi rotasi
 * site) per sumbu, satu permintaan per kolom sensor. Di sini ketiganya
 * digabung per stempel waktu lalu diturunkan ke satuan yang dipakai operator:
 * milimeter dari acuan R0. Jarak horizontal tidak berubah oleh rotasi, jadi
 * pergeseran boleh dihitung di bingkai mentah selama acuannya (raw_E0/raw_N0
 * dari /api/deformasi) juga mentah.
 */

import { parseNum } from "./format";

/** Satu baris chart_data dari /api/analisa. */
export interface BarisAnalisa {
  waktu: unknown;
  nilai: unknown;
}

/** Acuan R0 dalam bingkai mentah, meter. */
export interface AcuanR0 {
  e: number;
  n: number;
  z: number;
}

/** Satu pembacaan pada rentang, siap tampil. Koordinat meter, turunan mm. */
export interface TitikRiwayat {
  /** Epoch ms dengan jam dinding DB dibaca sebagai UTC — untuk sumbu & urutan. */
  ts: number;
  n: number;
  e: number;
  z: number;
  /** Pergeseran horizontal 2D dari R0, mm. */
  geserMm: number;
  /** Komponen mentah, mm — dipakai jejak pada teropong. */
  dxMm: number;
  dyMm: number;
  dzMm: number;
}

/**
 * Stempel waktu DB → epoch ms.
 *
 * Nilai DB adalah jam dinding WIB tanpa zona. Tiga bentuk yang sampai ke
 * klien: "YYYY-MM-DD HH:MM:SS" (agregat per jam), ISO ber-"Z" (Prisma
 * menyerialkan Date), dan "Fri Nov 21 2025 17:51:00 GMT+0700" (String(Date)
 * di server). Ketiganya menyimpan angka jam dinding yang SAMA di posisi UTC,
 * jadi semuanya dibaca sebagai UTC dan ditampilkan dengan getter UTC — tanpa
 * konversi zona di browser, yang akan menggeser jam 7 jam pada mesin WIB.
 */
export function keMs(w: unknown): number | null {
  if (w instanceof Date) return isNaN(w.getTime()) ? null : w.getTime();
  if (typeof w === "number") return Number.isFinite(w) ? w : null;
  if (typeof w !== "string") return null;
  const s = w.trim();
  if (!s) return null;
  const polos = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?$/);
  if (polos) {
    const ms = Date.parse(`${polos[1]}T${polos[2]}Z`);
    return isNaN(ms) ? null : ms;
  }
  const ms = Date.parse(s);
  return isNaN(ms) ? null : ms;
}

const p2 = (n: number) => String(n).padStart(2, "0");

/** "21/11 10:51" atau "10:51" — label sumbu waktu. */
export function fmtTick(ms: number, opsi: { tanggal?: boolean } = {}): string {
  const d = new Date(ms);
  const jam = `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
  if (!opsi.tanggal) return jam;
  return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)} ${jam}`;
}

/** "21-11-2025 10:51:00" — stempel penuh untuk tabel & tooltip. */
export function fmtWaktuPenuh(ms: number, opsi: { detik?: boolean } = { detik: true }): string {
  const d = new Date(ms);
  const tgl = `${p2(d.getUTCDate())}-${p2(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
  const jam = `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
  return opsi.detik ? `${tgl} ${jam}:${p2(d.getUTCSeconds())}` : `${tgl} ${jam}`;
}

/** "10:51" dari stempel apa pun yang dikenali keMs; "—" bila tidak. */
export function fmtJamDari(w: unknown): string {
  const ms = keMs(w);
  return ms === null ? "—" : fmtTick(ms);
}

/** Kuantil sederhana (0–1) dari daftar angka; null bila kosong. */
export function kuantil(nilai: number[], q: number): number | null {
  if (nilai.length === 0) return null;
  const urut = [...nilai].sort((a, b) => a - b);
  const pos = Math.min(urut.length - 1, Math.max(0, Math.floor(q * (urut.length - 1))));
  return urut[pos];
}

/**
 * Batas atas skala yang tahan terhadap tembakan liar: satu pembacaan yang
 * melenceng bermeter-meter tidak boleh meratakan seluruh grafik. Bila nilai
 * terbesar jauh di atas kuantil ke-90, skala dipotong di 2,5× kuantil itu —
 * angkanya tetap ada di tabel, dan jumlah yang terpotong disebut di header.
 * Di bawah 6 pembacaan tidak ada dasar statistik, jadi tidak dipotong.
 */
export function batasSkala(nilai: number[]): { maks: number; terpotong: number } {
  const maksData = nilai.reduce((m, v) => Math.max(m, v), 0);
  if (nilai.length < 6) return { maks: maksData, terpotong: 0 };
  const q90 = kuantil(nilai, 0.9) ?? maksData;
  const batas = q90 * 2.5;
  if (q90 <= 0 || maksData <= batas) return { maks: maksData, terpotong: 0 };
  return { maks: batas, terpotong: nilai.filter((v) => v > batas).length };
}

/**
 * Gabungkan tiga sumbu per stempel waktu. Baris yang salah satu sumbunya
 * kosong, atau ketiganya nol (tembakan gagal), dibuang — di agregat per jam
 * nilai nol itu sudah ikut merusak rata-ratanya, tapi setidaknya baris yang
 * seluruhnya nol tidak ikut menggambar pergeseran ratusan meter.
 *
 * `sejakMs`: stempel sesi acuan R0. Tembakan SEBELUM sesi itu (mis. tembakan
 * setup saat memasang prisma) tidak punya makna sebagai "pergeseran dari R0",
 * jadi dibuang dan jumlahnya dilaporkan supaya bisa disebut di halaman.
 */
export function gabungSumbu(
  seriN: BarisAnalisa[],
  seriE: BarisAnalisa[],
  seriZ: BarisAnalisa[],
  r0: AcuanR0,
  sejakMs?: number | null
): { titik: TitikRiwayat[]; sebelumR0: number } {
  const petaE = new Map<number, number>();
  const petaZ = new Map<number, number>();
  for (const b of seriE) {
    const ms = keMs(b.waktu);
    const v = parseNum(b.nilai);
    if (ms !== null && v !== null) petaE.set(ms, v);
  }
  for (const b of seriZ) {
    const ms = keMs(b.waktu);
    const v = parseNum(b.nilai);
    if (ms !== null && v !== null) petaZ.set(ms, v);
  }

  const hasil: TitikRiwayat[] = [];
  let sebelumR0 = 0;
  for (const b of seriN) {
    const ms = keMs(b.waktu);
    const n = parseNum(b.nilai);
    if (ms === null || n === null) continue;
    if (sejakMs != null && ms < sejakMs) {
      sebelumR0++;
      continue;
    }
    const e = petaE.get(ms);
    const z = petaZ.get(ms);
    if (e === undefined || z === undefined) continue;
    if (Math.abs(e) < 1e-9 && Math.abs(n) < 1e-9 && Math.abs(z) < 1e-9) continue;

    const dxMm = (e - r0.e) * 1000;
    const dyMm = (n - r0.n) * 1000;
    hasil.push({
      ts: ms,
      n,
      e,
      z,
      dxMm,
      dyMm,
      dzMm: (z - r0.z) * 1000,
      geserMm: Math.hypot(dxMm, dyMm),
    });
  }
  hasil.sort((a, b) => a.ts - b.ts);
  return { titik: hasil, sebelumR0 };
}

/** Tanggal lokal (tengah malam) dari bagian tanggal sebuah stempel ISO. */
export function tanggalDariIso(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** "2025-11-21" dari Date lokal — untuk parameter dari/sampai. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/**
 * Rentang bawaan: dari tanggal acuan R0 sampai tanggal sesi, dibatasi paling
 * lama 7 hari ke belakang. R0 adalah titik nol setiap angka di halaman ini,
 * jadi riwayat sejak R0 adalah rentang yang paling masuk akal untuk dibuka —
 * kecuali R0-nya sudah lama sekali, ketika agregat per jam dan batas 500
 * baris membuat grafiknya tidak lagi bisa dibaca.
 */
export function rentangBawaan(
  r0Iso: string | null | undefined,
  sesiIso: string
): { dari: Date; sampai: Date } {
  const sesi = tanggalDariIso(sesiIso) ?? new Date();
  const tujuhHari = new Date(sesi);
  tujuhHari.setDate(sesi.getDate() - 7);
  const r0 = r0Iso ? tanggalDariIso(r0Iso) : null;
  const dari = r0 && r0 > tujuhHari && r0 <= sesi ? r0 : tujuhHari;
  return { dari, sampai: sesi };
}

/**
 * Sudut putar bingkai mentah → bingkai site, dari satu vektor yang diketahui
 * di kedua bingkai. Rotasi kaku memutar semua selisih posisi dengan sudut
 * yang sama, jadi sudut itu bisa dibaca dari vektor sesi ini lalu dipakai
 * memutar jejak pembacaan lain — tanpa harus meniru rotateEN() server.
 * Null bila vektornya terlalu pendek untuk menentukan arah.
 */
export function sudutPutar(
  mentah: { dx: number; dy: number },
  site: { dx: number; dy: number }
): number | null {
  const magM = Math.hypot(mentah.dx, mentah.dy);
  const magS = Math.hypot(site.dx, site.dy);
  if (magM < 1e-6 || magS < 1e-6) return null;
  return Math.atan2(site.dy, site.dx) - Math.atan2(mentah.dy, mentah.dx);
}

export function putar(dx: number, dy: number, rad: number): { dx: number; dy: number } {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { dx: dx * c - dy * s, dy: dx * s + dy * c };
}
