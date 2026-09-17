/**
 * Perbaikan azimut koordinat tembakan RTS.
 *
 * ── Apa yang salah ──────────────────────────────────────────────────────────
 *
 * Koordinat yang dikirim logger untuk site kolam_bpp dihitung dengan DUA
 * kesalahan yang bertumpuk pada sudut horizontalnya:
 *
 *   1. SATUAN. `sensor5` berisi HA dalam GON (lingkaran penuh 400), tapi
 *      dipakai seolah derajat. Faktor 0,9 hilang.
 *   2. TANDA. Sudutnya dikurangkan, bukan ditambahkan — piringannya seolah
 *      berputar berlawanan arah jarum jam.
 *
 * Diukur dari enam prisma pada sesi acuan R0 (17 September 2026), dengan
 * koordinat sebenarnya dibaca dari "Peta Prisma Robotik BPP 1-4.pdf":
 *
 *     yang direkam :  bearing = 89,70° − HA_gon          (rentang 0,61°)
 *     yang benar   :  bearing = 0,9 × HA_gon + 302,49°   (rentang 1,00°)
 *
 * Akibatnya tiap prisma tergambar di sisi yang salah dari alat — DF_7 meleset
 * 1.824 m. Alat tidak bisa diperbaiki di lapangan, jadi koreksinya di sini.
 *
 * ── Kenapa hanya bearing-nya yang diganti ───────────────────────────────────
 *
 * Jarak mendatar diturunkan dari SD dan VA; keduanya tidak menyentuh HA sama
 * sekali, jadi jarak yang direkam alat SUDAH benar — terbukti cocok dengan
 * SD·sin(VA) sampai 0,4–2,0 m. Elevasi juga tidak terpengaruh. Maka yang
 * diputar cuma arahnya, sementara jarak dan Z dibiarkan apa adanya.
 *
 * Ini bukan sekadar hemat: menghitung ulang jarak berarti mengganti seluruh
 * riwayat pergeseran dengan angka yang sedikit berbeda, padahal yang
 * dikeluhkan cuma arahnya. Dengan cara ini besar pergeseran radial tidak
 * bergerak satu milimeter pun.
 *
 * ── Yang TIDAK bisa dijamin berkas ini ──────────────────────────────────────
 *
 * `orientasiDeg` (302,352°) diturunkan dari membaca posisi titik di PDF, teliti
 * sekitar ±0,5°. Pada prisma terjauh itu setara ±10 m posisi mutlak. Yang
 * TIDAK terpengaruh sama sekali adalah pengukuran deformasinya: konstanta yang
 * sama diputar ke setiap epoch, jadi selisih antar epoch tetap persis. Begitu
 * ada koordinat backsight hasil survei, perbarui angkanya di `t_site` —
 * tidak ada kode yang perlu disentuh.
 */

export interface KoreksiAzimut {
  /** Pengali HA mentah menjadi derajat. 0,9 untuk gon, 1 untuk derajat. */
  faktorDerajat: number;
  /** Ditambahkan sesudah dikalikan, derajat. Orientasi piringan ke grid. */
  orientasiDeg: number;
  /** Koordinat stasiun (RTS), meter UTM. */
  stasiunE: number;
  stasiunN: number;
}

/**
 * Baca sudut berformat "289,03,70" menjadi 289.037.
 *
 * Firmware memisahkan pecahannya dengan koma, dua digit per kelompok — jadi
 * bukan desimal biasa dan bukan derajat-menit-detik. Tembakan gagal datang
 * sebagai "000,00,00" dan harus terbaca sebagai nol, bukan NaN.
 */
export function bacaSudut(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const bagian = s.split(",");
  if (bagian.length === 1) {
    const n = Number(bagian[0]);
    return Number.isFinite(n) ? n : null;
  }
  const utuh = Number(bagian[0]);
  if (!Number.isFinite(utuh)) return null;
  let nilai = utuh;
  for (let i = 1; i < bagian.length; i++) {
    const p = Number(bagian[i]);
    if (!Number.isFinite(p)) return null;
    nilai += p / Math.pow(100, i);
  }
  return nilai;
}

/** Jarak mendatar dan bearing sebuah titik dari stasiun. */
function polar(E: number, N: number, k: KoreksiAzimut) {
  const dE = E - k.stasiunE;
  const dN = N - k.stasiunN;
  return { jarak: Math.hypot(dE, dN), bearing: (Math.atan2(dE, dN) * 180) / Math.PI };
}

/**
 * Hitung ulang E/N satu tembakan dari HA mentahnya.
 *
 * Mengembalikan null bila tembakannya tidak bisa dikoreksi — HA tidak terbaca,
 * koordinatnya nol (tembakan gagal), atau prismanya tepat di atas alat. Null
 * berarti "biarkan apa adanya", BUKAN "tulis nol": menulis nol akan mengubah
 * tembakan gagal jadi terlihat seperti prisma yang pindah ke pangkal koordinat.
 */
export function perbaikiKoordinat(
  E: number,
  N: number,
  haMentah: unknown,
  k: KoreksiAzimut
): { E: number; N: number } | null {
  if (!Number.isFinite(E) || !Number.isFinite(N)) return null;
  // Tembakan gagal tersimpan sebagai nol pada ketiga sumbu. Koordinat sah di
  // sistem ini selalu ratusan ribu meter, jadi ambang longgar sudah cukup.
  if (Math.abs(E) < 1 || Math.abs(N) < 1) return null;

  const ha = bacaSudut(haMentah);
  if (ha === null) return null;

  const { jarak } = polar(E, N, k);
  if (!(jarak > 1e-6)) return null;

  const az = ((ha * k.faktorDerajat + k.orientasiDeg) * Math.PI) / 180;
  return {
    E: k.stasiunE + jarak * Math.sin(az),
    N: k.stasiunN + jarak * Math.cos(az),
  };
}

/**
 * Seberapa jauh koreksi memindahkan sebuah titik, meter.
 *
 * Dipakai skrip perbaikan untuk melaporkan dampaknya sebelum menulis apa pun.
 */
export function jarakGeser(
  E: number,
  N: number,
  haMentah: unknown,
  k: KoreksiAzimut
): number | null {
  const baru = perbaikiKoordinat(E, N, haMentah, k);
  if (!baru) return null;
  return Math.hypot(baru.E - E, baru.N - N);
}

/**
 * Format angka koordinat seperti yang ditulis firmware: 4 angka di belakang
 * koma. Kolomnya VARCHAR, dan menulis dengan presisi berbeda membuat baris
 * hasil koreksi bisa dibedakan dari baris asli hanya dari bentuknya.
 */
export function tulisKoordinat(v: number): string {
  return v.toFixed(4);
}
