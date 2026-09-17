/**
 * Perbaikan azimut koordinat tembakan RTS.
 *
 * ── Apa yang salah ──────────────────────────────────────────────────────────
 *
 * Koordinat yang dikirim logger untuk site kolam_bpp dihitung dengan DUA
 * kesalahan yang bertumpuk pada sudut horizontalnya:
 *
 *   1. SATUAN. `sensor5` (HA) dan `sensor6` (VA) berisi sudut dalam GON
 *      (lingkaran penuh 400), tapi dipakai seolah derajat. Faktor 0,9 hilang
 *      pada KEDUANYA.
 *   2. TANDA. Sudut horizontalnya dikurangkan, bukan ditambahkan — piringannya
 *      seolah berputar berlawanan arah jarum jam.
 *
 * Diukur dari enam prisma pada sesi acuan R0 (17 September 2026), dengan
 * koordinat sebenarnya dibaca dari "Peta Prisma Robotik BPP 1-4.pdf":
 *
 *     yang direkam :  bearing = 89,70° − HA_gon          (rentang 0,61°)
 *     yang benar   :  bearing = 0,9 × HA_gon + 302,49°   (rentang 1,00°)
 *
 * Akibatnya tiap prisma tergambar di sisi yang salah dari alat — DF_7 meleset
 * 1.824 m — jaraknya 0,7-2% terlalu pendek, dan elevasinya ngawur: alat
 * melaporkan DF_7 di −176,7 m padahal seluruh area ini berada di 11-43 m.
 * Alat tidak bisa diperbaiki di lapangan, jadi koreksinya di sini.
 *
 * ── Semuanya dihitung ulang dari pengukuran mentah ──────────────────────────
 *
 * E, N, dan Z disusun ulang dari HA, VA, dan SD — bukan ditambal dari koordinat
 * kiriman alat. Koordinat itu memuat kedua kesalahan di atas sekaligus, dan
 * menambalnya sebagian berarti mewarisi sisanya:
 *
 *     jarak mendatar = SD · sin(VA_gon × 0,9°)
 *     beda tinggi    = SD · cos(VA_gon × 0,9°)
 *     azimut         = HA_gon × 0,9° + orientasi
 *
 * Versi pertama koreksi ini (17 September 2026, siang) cuma memutar bearing-nya
 * dan MEMPERTAHANKAN jarak kiriman alat, dengan alasan jarak tidak menyentuh
 * HA. Betul soal HA, tapi jaraknya lahir dari VA — yang ternyata salah satuan
 * dengan cara yang sama. Sisa 7-28 m yang waktu itu saya kira ketidakpastian
 * orientasi ternyata galat jarak; sesudah VA ikut dibetulkan sisanya turun jadi
 * 2-11 m.
 *
 * ── Dua sumber yang membenarkannya, masing-masing berdiri sendiri ───────────
 *
 * Posisi mendatar cocok dengan peta survei PDF sampai 2-11 m. Elevasinya cocok
 * dengan kontur DXF "Situasi_BPP_260731" — yang tidak ada hubungannya dengan
 * peta itu maupun dengan alat — sampai +0,4 … +2,8 m, selalu SEDIKIT DI ATAS
 * tanah. Prisma memang dipasang di tiang, jadi arah simpangannya pun masuk
 * akal.
 *
 * ── Yang TIDAK bisa dijamin berkas ini ──────────────────────────────────────
 *
 * `orientasiDeg` (302,351°) diturunkan dari membaca posisi titik di PDF, teliti
 * sekitar ±0,5°. Pada prisma terjauh itu setara ±10 m posisi mutlak. Yang
 * TIDAK terpengaruh sama sekali adalah pengukuran deformasinya: konstanta yang
 * sama diputar ke setiap epoch, jadi selisih antar epoch tetap persis. Begitu
 * ada koordinat backsight hasil survei, perbarui angkanya di `t_site` —
 * tidak ada kode yang perlu disentuh.
 */

export interface KoreksiAzimut {
  /**
   * Pengali sudut mentah menjadi derajat. 0,9 untuk gon, 1 untuk derajat.
   * Berlaku untuk HA MAUPUN VA — keduanya datang dalam satuan yang sama.
   */
  faktorDerajat: number;
  /** Ditambahkan ke HA sesudah dikalikan, derajat. Orientasi piringan ke grid. */
  orientasiDeg: number;
  /** Koordinat stasiun (RTS), meter UTM. */
  stasiunE: number;
  stasiunN: number;
  stasiunZ: number;
  /**
   * Tinggi alat di atas titik stasiun, meter. Dari `config_adr.ts_high` —
   * TIDAK disalin ke t_site, supaya tidak ada dua angka yang bisa berbeda.
   *
   * Hanya menggeser Z secara tetap, jadi tidak mempengaruhi deformasi sama
   * sekali; yang dipengaruhinya cuma seberapa pas prisma duduk di atas kontur.
   */
  tinggiAlat: number;
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

/**
 * HA yang TIDAK dilaporkan, bukan HA yang kebetulan nol.
 *
 * Firmware menandai sudut yang tidak terisi dengan "0" atau "000,00,00",
 * kebiasaan yang sama dengan koordinat tembakan gagal. Tabel `rts` site
 * kolam_bpp memuat 93 baris berkoordinat SAH tapi ber-HA nol — salinan
 * tembakan yang sama, dikirim ulang tanpa sudutnya.
 *
 * Membaca nol itu sebagai sudut sungguhan menaruh prismanya tepat di azimut
 * orientasi — arah yang sepenuhnya dikarang. Itu terjadi sekali pada 17
 * September 2026 dan memindahkan DF_7 sejauh 1.297 m; baris ini yang
 * mencegahnya terulang.
 *
 * Azimut nol yang sungguhan memang mungkin secara teori, tapi peluangnya satu
 * berbanding empat juta dan akibat salahnya jauh lebih murah daripada akibat
 * mempercayainya.
 */
export function sudutKosong(mentah: unknown): boolean {
  const a = bacaSudut(mentah);
  return a === null || Math.abs(a) < 1e-9;
}

/** @deprecated nama lama; pakai sudutKosong(). */
export const haKosong = sudutKosong;

/**
 * Susun ulang E/N/Z satu tembakan dari pengukuran mentahnya.
 *
 * Tidak memakai koordinat kiriman alat sama sekali — koordinat itu memuat
 * kesalahan yang justru sedang dibetulkan. Yang dipakai cuma HA, VA, SD, dan
 * koordinat stasiun.
 *
 * Mengembalikan null bila tembakannya tidak bisa dihitung: salah satu sudutnya
 * tidak dilaporkan (lihat sudutKosong) atau jarak miringnya nol. Null berarti
 * "biarkan barisnya apa adanya", BUKAN "tulis nol" — tembakan gagal yang
 * ditulisi koordinat akan terlihat seperti prisma yang pindah ke pangkal
 * koordinat.
 */
export function perbaikiTembakan(
  haMentah: unknown,
  vaMentah: unknown,
  sdMentah: unknown,
  k: KoreksiAzimut
): { E: number; N: number; Z: number } | null {
  if (sudutKosong(haMentah) || sudutKosong(vaMentah)) return null;

  const ha = bacaSudut(haMentah) as number;
  const va = bacaSudut(vaMentah) as number;
  const sd = typeof sdMentah === "number" ? sdMentah : Number(String(sdMentah).replace(",", "."));
  if (!Number.isFinite(sd) || sd <= 0) return null;

  // VA adalah sudut ZENIT: 100 gon = mendatar. Jadi sin memberi jarak mendatar
  // dan cos memberi beda tinggi — bukan sebaliknya.
  const vaDeg = ((va * k.faktorDerajat) * Math.PI) / 180;
  const jarak = sd * Math.sin(vaDeg);
  const beda = sd * Math.cos(vaDeg);
  if (!Number.isFinite(jarak) || !Number.isFinite(beda)) return null;

  const az = ((ha * k.faktorDerajat + k.orientasiDeg) * Math.PI) / 180;
  return {
    E: k.stasiunE + jarak * Math.sin(az),
    N: k.stasiunN + jarak * Math.cos(az),
    Z: k.stasiunZ + k.tinggiAlat + beda,
  };
}

/**
 * Format angka koordinat seperti yang ditulis firmware: 4 angka di belakang
 * koma. Kolomnya VARCHAR, dan menulis dengan presisi berbeda membuat baris
 * hasil koreksi bisa dibedakan dari baris asli hanya dari bentuknya.
 */
export function tulisKoordinat(v: number): string {
  return v.toFixed(4);
}
