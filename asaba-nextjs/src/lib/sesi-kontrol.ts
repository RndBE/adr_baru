/**
 * Kapan satu siklus pengukuran DIMULAI, dan sesi mana yang mencatatnya.
 *
 * Dipisah dari route supaya keputusannya bisa diuji tanpa perangkat: jalur ini
 * cuma dilewati saat instrumen sungguhan menjalankan siklus, jadi kalau
 * keputusannya salah, salahnya baru ketahuan berbulan-bulan kemudian lewat
 * riwayat yang kosong — persis yang terjadi di basis data ini (sesi `101109`
 * dibuka 21 November 2025 dan masih menampung baris `rts` bertanggal 26 Agustus
 * 2026; sembilan bulan running tidak pernah muncul sebagai sesi).
 */

/**
 * Tepi naik sensor16: bukan-1 → 1.
 *
 * Sumbernya `temp_rts` — payload TERAKHIR logger ini — bukan `set_tempkontrol`.
 * Bedanya menentukan:
 *
 *   set_tempkontrol mencatat apa yang DIMINTA aplikasi. Ia bisa tertinggal di
 *   keadaan "minta jalan" tanpa batas waktu kalau permintaannya gagal di tengah
 *   (baris di basis data ini terjebak status=1 sejak April 2026), dan siklus
 *   yang dijalankan jadwal firmware tidak pernah lewat sana sama sekali.
 *
 *   sensor16 melaporkan apa yang BENAR-BENAR sedang terjadi di instrumen. Itu
 *   satu-satunya jejak siklus yang dimulai sendiri oleh logger.
 *
 * Payload tanpa sensor16 dibaca 0, sama dengan cara route mengisinya. Artinya
 * payload yang kehilangan medan itu di tengah siklus akan terbaca sebagai
 * "berhenti" lalu payload berikutnya sebagai "mulai lagi" — bukan perilaku
 * baru, tapi perlu diketahui kalau suatu saat ada sesi kembar yang tak jelas
 * asalnya.
 */
export function awalSiklus(sekarang: unknown, sebelumnya: unknown): boolean {
  return Number(sekarang) === 1 && Number(sebelumnya ?? 0) !== 1;
}

/**
 * Langkah mesin-status `set_tempkontrol` untuk satu payload logger.
 *
 *   status=1  : Mulai sudah diminta (tombol Mulai / Jadwal running), siklus
 *               belum terlihat di instrumen.
 *   manual=1  : siklus sedang berjalan.
 *
 * "selesai" hanya pada TEPI TURUN sungguhan — sensor16 payload sebelumnya 1,
 * sekarang 0. Aturan lama cukup `manual=1 && sensor16=0`, padahal Mulai
 * menyetel manual=1 SEBELUM instrumen bergerak. Laporan menit pertama sesudah
 * Mulai (sensor16 masih 0) lalu terbaca "putaran selesai": sesi barunya
 * dinilai kosong dengan semua prisma gagal, dan siklus sungguhannya mendarat
 * di sesi lain yang dibuka logger. Jadwal running, yang memulai di detik :01
 * persis setelah laporan menit, selalu kena (23 Nov 2026: 153001/153026,
 * 154001/154024, …).
 *
 * "batal": Mulai yang tidak pernah terlihat dimulai instrumen dalam
 * BATAS_MULAI_TERTUNDA_MS. Tanda-tandanya dibereskan tanpa menilai apa pun,
 * supaya halaman tidak terjebak "sedang berjalan" selamanya.
 *
 * Payload yang tidak menyebut sensor16 tidak mengubah apa pun.
 */
export type LangkahKontrol = "mulai-terkonfirmasi" | "mulai-sendiri" | "selesai" | "batal" | "tetap";

export const BATAS_MULAI_TERTUNDA_MS = 10 * 60 * 1000;

export function langkahKontrol(o: {
  status: unknown;
  statusManual: unknown;
  sensor16Dilaporkan: boolean;
  sensor16: unknown;
  sensor16Sebelumnya: unknown;
  /** Umur permintaan Mulai (set_tempkontrol.datetime) terhadap jam payload. */
  umurMulaiMs: number | null;
}): LangkahKontrol {
  if (!o.sensor16Dilaporkan) return "tetap";
  const satu = (v: unknown) => Number(v ?? 0) === 1;
  const jalan = satu(o.sensor16);
  if (satu(o.status) && jalan) return "mulai-terkonfirmasi";
  if (!satu(o.status) && !satu(o.statusManual) && jalan) return "mulai-sendiri";
  if (satu(o.statusManual) && !jalan && satu(o.sensor16Sebelumnya)) return "selesai";
  if (
    satu(o.status) &&
    !jalan &&
    o.umurMulaiMs !== null &&
    o.umurMulaiMs > BATAS_MULAI_TERTUNDA_MS
  ) {
    return "batal";
  }
  return "tetap";
}

/**
 * Seberapa tua sesi yang masih boleh "diadopsi" siklus yang baru mulai.
 *
 * Dua jam, bukan hitungan menit: jarak antara operator menekan Mulai dan
 * instrumen melaporkan sensor16 = 1 dibatasi selang kirim data logger
 * (`send_data`), yang boleh disetel sampai jam-jaman — batas ketat akan
 * membuat setiap start manual di lokasi berselang lambat melahirkan sesi kedua
 * yang kosong.
 */
export const BATAS_ADOPSI_SESI_MS = 2 * 60 * 60 * 1000;

/**
 * Apakah siklus yang baru mulai memakai sesi yang sudah ada, bukan membuat baru.
 *
 * Syaratnya sesi itu KOSONG — belum punya satu pun baris `rts`. Sesi kosong
 * hanya lahir dari satu hal: tombol Mulai ditekan dan instrumennya belum sempat
 * menjawab. Jadi siklus yang mulai sesudahnya memang siklus yang diminta
 * operator itu, dan membuat sesi baru akan meninggalkan sesi kosong yatim di
 * riwayat sekaligus memecah satu pengukuran jadi dua.
 *
 * Sebaliknya sesi yang SUDAH berisi baris adalah sesi yang sudah selesai.
 * Menempelkan siklus baru ke sana persis kekeliruan yang membuat riwayat di
 * basis data ini berhenti bertambah sejak 2025.
 *
 * Umur negatif ikut diterima dalam batas yang sama: jam logger dan jam server
 * tidak pernah persis sama, dan selisih beberapa menit ke depan tidak berarti
 * apa-apa selain jam yang sedikit maju.
 */
export function bolehAdopsiSesi(
  sesi: { kosong: boolean; umurMs: number | null } | null,
  batasMs: number = BATAS_ADOPSI_SESI_MS
): boolean {
  if (!sesi || !sesi.kosong || sesi.umurMs === null) return false;
  return Math.abs(sesi.umurMs) <= batasMs;
}

/**
 * Site untuk sesi yang dibuka sendiri oleh logger.
 *
 * Tidak ada jawaban yang pasti benar di sini, dan itu memang sifat datanya:
 * satu logger boleh melayani lebih dari satu site (30002 melayani ccp dan
 * viewpoint), sementara balasan firmware tidak menyebut site sama sekali. Yang
 * bisa dilakukan cuma memilih tebakan yang paling tidak merusak:
 *
 *   1. Site sesi TERAKHIR logger ini — site tempat operator terakhir bekerja,
 *      dan target yang direkam instrumen berasal dari Prism Config site itu.
 *      Ini juga yang sudah dipakai `/api/datamasuk/adr` untuk membatasi update
 *      prisma, jadi memilihnya membuat sesi dan data prisma menunjuk site yang
 *      sama — bukan menggeser data ke site lain.
 *   2. Kalau site itu ternyata tidak lagi dilayani logger ini (loggernya
 *      dipindah di Master Data), pemetaan `t_site.id_logger` yang menang —
 *      tapi hanya kalau jawabannya tunggal. Dua site untuk satu logger berarti
 *      memilih salah satunya sama saja dengan melempar koin.
 *
 * Mengembalikan null berarti "tidak tahu": sesinya tetap dibuat supaya
 * pengukurannya tidak hilang, dan route sengaja tidak menyentuh baris prisma
 * site mana pun daripada menimpa yang salah.
 */
export function pilihSiteSesi(
  siteLogger: string[],
  siteSesiTerakhir: string | null
): string | null {
  if (siteSesiTerakhir && (siteLogger.length === 0 || siteLogger.includes(siteSesiTerakhir))) {
    return siteSesiTerakhir;
  }
  if (siteLogger.length === 1) return siteLogger[0];
  return siteSesiTerakhir ?? null;
}

/**
 * Asal sesi, sebagaimana disimpan di `log_kontrol.dipicu`.
 *
 * "logger" sengaja BUKAN "jadwal". Dari sisi server keduanya tidak bisa
 * dibedakan: baik siklus yang dijalankan `trackEvery` maupun yang dimulai orang
 * lewat panel instrumen sama-sama tiba sebagai sensor16 yang berubah jadi 1
 * tanpa permintaan apa pun dari aplikasi. Menulis "jadwal" berarti mengaku tahu
 * hal yang tidak diketahui.
 *
 * "jadwal" hanya untuk Jadwal running di web (scheduling_task): di situ server
 * sendiri yang mengirim AutoTrackingStart, jadi asalnya memang diketahui.
 */
export type AsalSesi = "operator" | "logger" | "jadwal";
