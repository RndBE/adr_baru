/**
 * Analisa gabungan beberapa prisma di SATU site.
 *
 * Halaman Hasil Pengukuran sudah menjawab "prisma mana yang bergeser paling
 * jauh". Yang belum dijawabnya: apakah prisma-prisma itu bergerak BERSAMA.
 * Bedanya penting di lapangan — sekumpulan prisma yang bergeser searah dengan
 * besar yang mirip menunjukkan satu massa yang bergerak utuh, sedangkan satu
 * prisma yang bergerak sendirian di antara tetangganya yang diam lebih sering
 * berarti tiangnya tersenggol, prismanya berputar, atau bidikannya meleset.
 * Keduanya tampil sama di tabel per prisma, dan hanya bisa dibedakan dengan
 * melihat beberapa prisma sekaligus.
 *
 * Modul ini murni dan tanpa ketergantungan pada React atau server, supaya
 * aturannya bisa dikunci `gabungan.test.ts` — sama alasannya dengan
 * `protokol-rts.ts`: perilaku yang tidak bisa dipancing dari perangkat keras
 * harus bisa diuji dari angkanya saja.
 *
 * SATUAN: seluruh jarak di sini MILIMETER, mengikuti PrismaRingkas.
 */

import { bearingDari, parseNum } from "./format";
import { keMs } from "./prism-history";
import type { PrismaRingkas } from "./derive";
import {
  statusKecepatan,
  statusPergeseran,
  statusTerburuk,
  type AmbangSite,
  type StatusLabel,
} from "@/lib/ambang";

/** Vektor pergeseran mendatar rata-rata sekelompok prisma. */
export interface VektorRata {
  dxMm: number;
  dyMm: number;
  /** Panjang resultan. Ini BUKAN rata-rata besar pergeseran — lihat catatan
   *  di gabungkanPrisma() tentang dua prisma yang saling berlawanan. */
  besarMm: number;
  /** Arah resultan, 0–360° dari utara. Null bila resultannya nol. */
  bearing: number | null;
}

/**
 * Pola gerak kelompok, dibaca dari keseragaman arah.
 *
 * "diam" dipisahkan karena tanpa pergeseran sama sekali arah tidak punya arti —
 * memaksakan angka keseragaman pada nol pergeseran akan melaporkan pola yang
 * sebenarnya tidak ada.
 */
export type PolaGerak = "seragam" | "campuran" | "berpencar" | "diam";

/**
 * Batas pembacaan pola. Angka ini alat bantu baca, BUKAN aturan keputusan —
 * tidak ada standar yang menetapkannya, dan tidak ada peringatan yang dikirim
 * berdasarkan nilainya. Ambang bahaya tetap satu-satunya dasar penilaian, dan
 * itu ada di `@/lib/ambang`.
 */
export const BATAS_SERAGAM = 0.8;
export const BATAS_CAMPURAN = 0.45;

export interface RingkasanGabungan {
  /** Prisma yang benar-benar masuk hitungan. */
  dipakai: PrismaRingkas[];
  /**
   * Nama prisma yang dipilih tapi tidak bisa ikut karena gagal ditembak atau
   * acuannya tidak sah. Sengaja dikembalikan, bukan dibuang diam-diam: kalau
   * separuh kelompok tidak terbaca, angka gabungannya mewakili separuh site
   * saja dan itu harus kelihatan di layar.
   */
  diabaikan: string[];
  vektorRata: VektorRata;
  /**
   * Keseragaman arah 0–1: |Σv| / Σ|v|. Satu berarti semua prisma bergeser
   * persis searah; nol berarti arahnya saling meniadakan. Ditimbang besar
   * pergeseran — prisma yang bergerak 0,2 mm tidak boleh ikut menentukan arah
   * kelompok sekuat prisma yang bergerak 40 mm.
   *
   * Null bila tidak ada satu pun pergeseran (Σ|v| = 0).
   */
  keseragaman: number | null;
  pola: PolaGerak;
  /** Simpangan arah (°) yang setara dengan keseragaman di atas. */
  simpangArahDeg: number | null;
  /** Sebaran BESAR pergeseran — pelengkap wajib bagi vektorRata. */
  sebaran: { minMm: number; medianMm: number; maksMm: number; sdMm: number };
  /**
   * Pergeseran diferensial: jarak terbesar antara dua vektor prisma mana pun.
   * Nol berarti seluruh kelompok bergeser persis sama (blok bergerak utuh);
   * besar berarti ada perbedaan gerak DI DALAM kelompok — bagian yang satu
   * menarik atau menggeser bagian lain.
   */
  diferensialMm: number;
  lajuRataMmd: number | null;
  lajuMaksMmd: number | null;
  status: StatusLabel | null;
  hitunganStatus: Partial<Record<StatusLabel, number>>;
}

function median(urut: number[]): number {
  const n = urut.length;
  if (n === 0) return 0;
  const t = Math.floor(n / 2);
  return n % 2 ? urut[t] : (urut[t - 1] + urut[t]) / 2;
}

/**
 * Gabungkan beberapa prisma jadi satu bacaan kelompok.
 *
 * Null bila tidak ada satu pun prisma yang bisa dipakai — pemanggil harus
 * menampilkan "tidak ada yang bisa dihitung", bukan angka nol.
 *
 * PERINGATAN yang menjadi alasan sebaran & diferensial ikut dikembalikan:
 * vektor rata-rata SAJA bisa menipu. Dua prisma yang masing-masing bergeser
 * 30 mm ke arah berlawanan menghasilkan resultan 0 mm — kalau hanya angka itu
 * yang tampil, layar menyatakan "tidak ada pergeseran" untuk site yang justru
 * sedang terbelah. Karena itu besar terbesar, sebarannya, dan pergeseran
 * diferensialnya selalu ikut, dan keseragaman yang rendah harus dibaca sebagai
 * "jangan percaya rata-ratanya".
 */
export function gabungkanPrisma(terpilih: PrismaRingkas[]): RingkasanGabungan | null {
  const dipakai: PrismaRingkas[] = [];
  const diabaikan: string[] = [];

  for (const p of terpilih) {
    // Prisma gagal ditembak TIDAK boleh masuk sebagai vektor nol. Nol berarti
    // "diam", sedangkan yang terjadi adalah "tidak diketahui" — memasukkannya
    // akan menarik rata-rata ke arah diam dan menaikkan keseragaman semu.
    if (p.tertembak && p.dxMm !== null && p.dyMm !== null) dipakai.push(p);
    else diabaikan.push(p.nama);
  }

  if (dipakai.length === 0) return null;

  let sumDx = 0;
  let sumDy = 0;
  let sumMag = 0;
  const besar: number[] = [];

  for (const p of dipakai) {
    const dx = p.dxMm as number;
    const dy = p.dyMm as number;
    sumDx += dx;
    sumDy += dy;
    const mag = Math.hypot(dx, dy);
    sumMag += mag;
    besar.push(mag);
  }

  const n = dipakai.length;
  const dxRata = sumDx / n;
  const dyRata = sumDy / n;
  const besarRata = Math.hypot(dxRata, dyRata);

  const keseragaman = sumMag === 0 ? null : Math.hypot(sumDx, sumDy) / sumMag;

  // Simpangan arah dari resultan yang sama: R = exp(-σ²/2) pada sebaran arah,
  // jadi σ = √(−2 ln R). Diturunkan dari keseragaman yang sudah dihitung
  // supaya keduanya tidak bisa saling membantah.
  const simpangArahDeg =
    keseragaman === null || keseragaman <= 0
      ? null
      : keseragaman >= 1
        ? 0
        : (Math.sqrt(-2 * Math.log(keseragaman)) * 180) / Math.PI;

  let pola: PolaGerak;
  if (keseragaman === null) pola = "diam";
  else if (keseragaman >= BATAS_SERAGAM) pola = "seragam";
  else if (keseragaman >= BATAS_CAMPURAN) pola = "campuran";
  else pola = "berpencar";

  // Pasangan terjauh. n kecil (satu site puluhan prisma), jadi O(n²) tidak
  // perlu dihindari dan hasilnya tepat, bukan hampiran.
  let diferensialMm = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = dipakai[i];
      const b = dipakai[j];
      const d = Math.hypot(
        (a.dxMm as number) - (b.dxMm as number),
        (a.dyMm as number) - (b.dyMm as number)
      );
      if (d > diferensialMm) diferensialMm = d;
    }
  }

  const urut = [...besar].sort((a, b) => a - b);
  const rataBesar = sumMag / n;
  const varians = besar.reduce((s, v) => s + (v - rataBesar) ** 2, 0) / n;

  const laju = dipakai.map((p) => p.lajuMmd).filter((v): v is number => v !== null);

  const hitunganStatus: Partial<Record<StatusLabel, number>> = {};
  for (const p of dipakai) {
    if (p.status) hitunganStatus[p.status] = (hitunganStatus[p.status] ?? 0) + 1;
  }

  return {
    dipakai,
    diabaikan,
    vektorRata: {
      dxMm: dxRata,
      dyMm: dyRata,
      besarMm: besarRata,
      bearing: besarRata > 0 ? bearingDari(dxRata, dyRata) : null,
    },
    keseragaman,
    pola,
    simpangArahDeg,
    sebaran: {
      minMm: urut[0],
      medianMm: median(urut),
      maksMm: urut[urut.length - 1],
      sdMm: Math.sqrt(varians),
    },
    diferensialMm,
    lajuRataMmd: laju.length ? laju.reduce((s, v) => s + v, 0) / laju.length : null,
    lajuMaksMmd: laju.length ? Math.max(...laju) : null,
    status: statusTerburuk(dipakai.map((p) => p.status)),
    hitunganStatus,
  };
}

/** Selisih arah sebuah prisma terhadap arah kelompok, dinormalkan ke ±180°. */
export function selisihArah(
  p: { dxMm: number | null; dyMm: number | null },
  vektorRata: VektorRata
): number | null {
  if (p.dxMm === null || p.dyMm === null || vektorRata.bearing === null) return null;
  if (p.dxMm === 0 && p.dyMm === 0) return null;
  let d = bearingDari(p.dxMm, p.dyMm) - vektorRata.bearing;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

// ─── Riwayat sepanjang hari, beberapa prisma pada satu sumbu waktu ───────────

/** Satu prisma dalam seri gabungan. `kunci` dipakai sebagai dataKey chart. */
export interface PrismaSeri {
  kunci: string;
  id: string;
  nama: string;
}

export interface BarisSeriGabungan {
  /** Epoch ms; jam dinding WIB dibaca sebagai UTC, sama dengan prism-history. */
  ts: number;
  /** Rata-rata prisma yang terbaca pada running ini. */
  rata: number | null;
  /** Berapa prisma terbaca pada running ini. */
  jumlah: number;
  /** Seluruh prisma terpilih terbaca pada running ini. */
  lengkap: boolean;
  [kunci: string]: number | boolean | null;
}

export interface SeriGabungan {
  prisma: PrismaSeri[];
  baris: BarisSeriGabungan[];
  /** Running yang tidak semua prismanya terbaca — lihat catatan di bawah. */
  tidakLengkap: number;
}

/**
 * Selisih waktu paling lama yang masih dianggap satu running.
 *
 * Satu running membidik seluruh prisma berurutan dalam hitungan menit,
 * sedangkan jeda antar running jauh lebih panjang. Nilai ini hanya batas atas;
 * pengelompokan juga ditutup begitu satu prisma muncul dua kali (lihat
 * seriGabungan), sehingga toleransi yang kelonggaran tidak akan menggabungkan
 * dua running jadi satu.
 */
export const TOLERANSI_RUNNING_MS = 10 * 60_000;

/**
 * Susun riwayat harian beberapa prisma pada satu sumbu waktu.
 *
 * Tiap prisma dibidik pada detik yang berbeda di dalam running yang sama, jadi
 * stempel waktunya tidak pernah persis sama dan tidak bisa dipakai sebagai
 * kunci. Pembacaan dikelompokkan per running, dan tiap kelompok ditutup oleh
 * salah satu dari dua hal: jeda melebihi toleransi, atau sebuah prisma muncul
 * untuk kedua kalinya — yang hanya mungkin terjadi kalau running berikutnya
 * sudah dimulai.
 *
 * TRAP yang disengaja ditampakkan, bukan disembunyikan: `rata` dihitung dari
 * prisma yang TERBACA pada running itu saja. Kalau satu prisma hilang di
 * sebagian running, garis rata-rata akan melompat karena susunan anggotanya
 * berubah, bukan karena ada yang bergerak. Karena itu tiap baris membawa
 * `lengkap`, dan jumlah running yang tidak lengkap dikembalikan supaya bisa
 * disebut di layar.
 */
export function seriGabungan(
  terpilih: Array<{ id: string; nama: string; seri?: { t: unknown; mm: unknown }[] }>
): SeriGabungan {
  const prisma: PrismaSeri[] = terpilih.map((p, i) => ({
    // Kunci dari indeks, bukan dari nama: nama prisma datang dari DB dan boleh
    // mengandung titik atau kurung, yang akan dibaca recharts sebagai jalur
    // bersarang dan membuat serinya hilang tanpa galat.
    kunci: `p${i}`,
    id: p.id,
    nama: p.nama,
  }));

  type Titik = { ts: number; kunci: string; mm: number };
  const semua: Titik[] = [];
  terpilih.forEach((p, i) => {
    for (const b of p.seri ?? []) {
      const ts = keMs(b.t);
      const mm = typeof b.mm === "number" ? b.mm : Number(b.mm);
      if (ts === null || !Number.isFinite(mm)) continue;
      semua.push({ ts, kunci: `p${i}`, mm });
    }
  });
  semua.sort((a, b) => a.ts - b.ts);

  const baris: BarisSeriGabungan[] = [];
  let kelompok: Titik[] = [];

  const tutup = () => {
    if (kelompok.length === 0) return;
    const b: BarisSeriGabungan = {
      // Titik tengah kelompok — bukan yang pertama, supaya letaknya di sumbu
      // waktu mewakili running itu, bukan prisma yang kebetulan dibidik duluan.
      ts: Math.round((kelompok[0].ts + kelompok[kelompok.length - 1].ts) / 2),
      rata: null,
      jumlah: kelompok.length,
      lengkap: kelompok.length === prisma.length,
    };
    let jumlahNilai = 0;
    for (const t of kelompok) {
      b[t.kunci] = t.mm;
      jumlahNilai += t.mm;
    }
    for (const p of prisma) if (!(p.kunci in b)) b[p.kunci] = null;
    b.rata = jumlahNilai / kelompok.length;
    baris.push(b);
    kelompok = [];
  };

  for (const t of semua) {
    const akhir = kelompok[kelompok.length - 1];
    const jedaLewat = akhir !== undefined && t.ts - akhir.ts > TOLERANSI_RUNNING_MS;
    const sudahAda = kelompok.some((k) => k.kunci === t.kunci);
    if (jedaLewat || sudahAda) tutup();
    kelompok.push(t);
  }
  tutup();

  return {
    prisma,
    baris,
    tidakLengkap: baris.filter((b) => !b.lengkap).length,
  };
}

// ─── Dari rentang waktu ke vektor per prisma ─────────────────────────────────

/**
 * Dua cara membaca satu rentang, dan keduanya sah menjawab pertanyaan berbeda.
 *
 * "akhir"  — keadaan pada pembacaan terakhir di rentang, diukur dari acuan R0.
 *            Inilah angka yang sebanding dengan ambang bahaya site.
 * "selama" — perubahan posisi ANTARA awal dan akhir rentang. Menjawab "apa yang
 *            bergerak antara jam 06 dan jam 12", dan sengaja TIDAK dinilai
 *            dengan ambang pergeseran — lihat catatan di olahRentang().
 */
export type BasisGabungan = "akhir" | "selama";

/** Satu prisma seperti dikirim /api/analisa-gabungan. */
export interface PrismaRentang {
  id_prisma: string;
  nama_prisma?: string;
  acuan_sah?: boolean;
  titik?: Array<{ t: unknown; dnMm: unknown; deMm: unknown; dzMm: unknown }>;
}

export interface OlahanRentang {
  ringkas: PrismaRingkas[];
  /** Siap diberikan ke seriGabungan(); `mm` mengikuti basis yang dipilih. */
  seri: Array<{ id: string; nama: string; seri: { t: unknown; mm: number }[] }>;
}

/** Lama antara dua stempel dalam hari; null bila tidak terbaca atau nol. */
function lamaHari(a: unknown, b: unknown): number | null {
  const m0 = keMs(a);
  const m1 = keMs(b);
  if (m0 === null || m1 === null) return null;
  const hari = (m1 - m0) / 86400000;
  return hari > 0 ? hari : null;
}

/**
 * Ubah data rentang jadi bentuk yang bisa digabung dan digambar.
 *
 * PENILAIAN AMBANG sengaja berbeda antara dua basis, dan ini bukan kelalaian:
 *
 *   Ambang pergeseran site (`geser_normal_max` dan kawan-kawan) ditetapkan untuk
 *   pergeseran TOTAL dari acuan R0. Memakainya menilai gerak enam jam akan
 *   menyebut "Normal" pada prisma yang bergerak 30 mm dalam enam jam — padahal
 *   laju sebesar itu jauh lebih genting daripada 30 mm yang terkumpul sejak R0
 *   berbulan-bulan lalu. Karena itu basis "selama" TIDAK diberi status
 *   pergeseran sama sekali.
 *
 *   Yang memang mengukur gerak per satuan waktu adalah ambang LAJU, dan itu
 *   dipakai di kedua basis: besarnya gerak dalam rentang dibagi lama rentang
 *   prisma itu sendiri — bukan lama rentang yang diminta, karena prisma yang
 *   baru terbaca di setengah akhir jendela tidak boleh dihitung seolah diam
 *   pada setengah pertamanya.
 */
export function olahRentang(
  daftar: PrismaRentang[],
  basis: BasisGabungan,
  ambang: AmbangSite | null
): OlahanRentang {
  const ringkas: PrismaRingkas[] = [];
  const seri: OlahanRentang["seri"] = [];

  for (const p of daftar) {
    const id = String(p.id_prisma);
    const nama = String(p.nama_prisma || p.id_prisma || "—");
    const titik = (p.titik ?? [])
      .map((t) => ({
        t: t.t,
        dn: parseNum(t.dnMm),
        de: parseNum(t.deMm),
        dz: parseNum(t.dzMm),
      }))
      .filter((t): t is { t: unknown; dn: number; de: number; dz: number } =>
        t.dn !== null && t.de !== null && t.dz !== null
      );

    const awal = titik[0];
    const akhir = titik[titik.length - 1];

    // Tanpa pembacaan di rentang ini, prisma tetap ikut didaftar tapi ditandai
    // tidak tertembak — supaya namanya muncul di layar sebagai "tidak terbaca",
    // bukan lenyap begitu saja dari daftar pilihan.
    if (!awal || !akhir || p.acuan_sah === false) {
      ringkas.push({
        id, nama,
        dxMm: null, dyMm: null, dzMm: null, linierMm: null, geserMm: null,
        bearing: null, arahTeks: null, lajuMmd: null,
        status: null, statusLaju: null, e: null, n: null,
        tertembak: false,
      });
      seri.push({ id, nama, seri: [] });
      continue;
    }

    const dxMm = basis === "selama" ? akhir.de - awal.de : akhir.de;
    const dyMm = basis === "selama" ? akhir.dn - awal.dn : akhir.dn;
    const dzMm = basis === "selama" ? akhir.dz - awal.dz : akhir.dz;
    const geserMm = Math.hypot(dxMm, dyMm);

    // Laju dari gerak SELAMA rentang pada kedua basis — yang berubah cuma angka
    // utamanya, bukan arti "seberapa cepat bergerak".
    const gerakMm = Math.hypot(akhir.de - awal.de, akhir.dn - awal.dn);
    const hari = lamaHari(awal.t, akhir.t);
    const lajuMmd = hari === null ? null : gerakMm / hari;

    ringkas.push({
      id,
      nama,
      dxMm,
      dyMm,
      dzMm,
      linierMm: Math.hypot(dxMm, dyMm, dzMm),
      geserMm,
      bearing: geserMm > 0 ? bearingDari(dxMm, dyMm) : null,
      arahTeks: null,
      lajuMmd,
      // Hanya basis "akhir" yang sebanding dengan ambang pergeseran.
      status: basis === "akhir" && ambang ? statusPergeseran(geserMm, ambang) : null,
      statusLaju: ambang && lajuMmd !== null ? statusKecepatan(lajuMmd, ambang) : null,
      e: null,
      n: null,
      tertembak: true,
    });

    seri.push({
      id,
      nama,
      // Grafik mengikuti basis yang sama dengan angkanya: pada "selama", tiap
      // prisma diukur dari posisinya sendiri di awal rentang, jadi garis yang
      // berhimpit berarti benar-benar bergerak bersama — bukan sekadar kebetulan
      // berjarak sama dari R0.
      seri: titik.map((t) => ({
        t: t.t,
        mm:
          basis === "selama"
            ? Math.hypot(t.de - awal.de, t.dn - awal.dn)
            : Math.hypot(t.de, t.dn),
      })),
    });
  }

  return { ringkas, seri };
}
