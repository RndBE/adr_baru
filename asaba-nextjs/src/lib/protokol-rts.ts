/**
 * Klasifikasi balasan RTS sesuai PROTOKOL_MQTT_ADR (revisi memutus
 * kompatibilitas — kunci `stage` dihapus, semuanya digabung ke `value`).
 *
 * Dipisah dari komponen supaya tabel nilai di dokumen protokol bisa dikunci
 * jadi asersi. Alur MQTT-nya sendiri tidak bisa diuji tanpa perangkat, jadi
 * bagian yang BISA diuji sebaiknya benar-benar diuji.
 *
 * Dua perangkap yang sudah menelan korban di kode sebelumnya:
 *
 * 1. `Success` BUKAN penanda siap untuk PowerOn. Instrumen sudah menjawab tapi
 *    konstanta prisma dan koreksi atmosfer belum dikirim. Penanda siap `done`.
 * 2. Kata `done` muncul di dua TINGKAT berbeda:
 *      {"PowerOn":{"value":"done"}}                        → instrumen siap
 *      {"AutoTracking":{"value":"target","status":"done"}}  → satu target selesai
 *    Jangan mencari string tanpa melihat tingkatnya.
 */

export type AksiPower = "on" | "off";

/** Hasil klasifikasi satu balasan. */
export type KelasBalasan =
  /** Rangkaian tuntas dengan sukses. */
  | "selesai"
  /** Rangkaian berakhir gagal / ditolak. */
  | "gagal"
  /** Masih berjalan; tampilkan sebagai progres. */
  | "kemajuan";

/**
 * Ambil nilai balasan protokol SEKARANG dari satu paket.
 *
 * `value` adalah kunci resmi. `stage` ikut dibaca karena revisi peralihan
 * memakainya dan unit yang belum di-flash mungkin masih mengirimkannya —
 * dokumennya sendiri menyebut backend harus siap sebelum unit produksi
 * diperbarui, jadi dua versi firmware hidup berdampingan untuk sementara.
 *
 * Mengembalikan null kalau paketnya memakai protokol lama (`nilai`) atau tidak
 * memuat nilai sama sekali; pemanggil menanganinya lewat jalur terpisah.
 */
export function nilaiRts(paket: unknown, namaKunci?: string): string | null {
  if (paket === null || typeof paket !== "object") return null;
  const o = paket as Record<string, unknown>;
  // `namaKunci` untuk balasan yang MENGULANG nama perintahnya sebagai kunci
  // dalam, bukan memakai `value`. Terlihat di lapangan 31 Agustus 2026:
  //
  //   {"setHome":{"setHome":",0,061,41,90,199,18,72;"}}
  //
  // Bentuk ini menyalahi aturan dasar #2 di dokumen protokol ("semua balasan
  // RTS memakai kunci value") dan tidak terdaftar di Bagian E, jadi tidak ada
  // gunanya menunggu dokumennya diperbaiki lebih dulu. Diperiksa TERAKHIR
  // supaya `value` tetap menang bila suatu saat firmware diseragamkan.
  const v = o.value ?? o.stage ?? (namaKunci ? o[namaKunci] : undefined);
  return v === null || v === undefined ? null : String(v);
}

/**
 * Nilai balasan protokol LAMA (`nilai`), hanya bila protokol sekarang tidak
 * dipakai di paket yang sama.
 *
 * Dipisah karena string yang sama berarti hal berbeda antar versi: di protokol
 * lama `Success` adalah penutup sukses, sedangkan sekarang `Success` cuma
 * kemajuan. Menyatukan keduanya membuat salah satu versi salah dibaca.
 */
export function nilaiRtsLama(paket: unknown): string | null {
  if (paket === null || typeof paket !== "object") return null;
  const o = paket as Record<string, unknown>;
  if (o.value !== undefined || o.stage !== undefined) return null;
  return o.nilai === null || o.nilai === undefined ? null : String(o.nilai);
}

/**
 * PowerOn: start → ping → Success → config → done, atau Failed.
 * PowerOff: start → check → home → off → Success → done, atau "RTS Off".
 *
 * Nilai di luar tabel dokumen dikembalikan sebagai "kemajuan": lebih baik
 * indikator berputar sedikit lebih lama lalu kena timeout daripada memvonis
 * instrumen menyala/mati atas dasar nilai yang tidak dikenal.
 */
export function klasifikasiPower(aksi: AksiPower, nilai: string): KelasBalasan {
  if (nilai === "done") return "selesai";
  if (aksi === "on" && nilai === "Failed") return "gagal";
  if (aksi === "off" && nilai === "RTS Off") return "gagal";
  return "kemajuan";
}

/**
 * AutoTracking: "RTS Off" (ditolak), start, scheduled, homing, finished.
 *
 * "scheduled" mendahului siklus yang dijalankan `trackEvery`, bukan yang
 * diminta operator — jatuh ke "kemajuan" seperti "start".
 *
 * Perintahnya bernama `AutoTrackingStart` tapi SEMUA balasannya bernama
 * `AutoTracking` — satu-satunya perintah yang nama balasannya berbeda dari nama
 * perintahnya.
 */
export function klasifikasiTracking(nilai: string): KelasBalasan {
  if (nilai === "finished") return "selesai";
  if (nilai === "RTS Off") return "gagal";
  return "kemajuan";
}

/**
 * Nilai `status` yang sah pada pesan kemajuan per target.
 *
 * "turning" HANYA muncul saat setelan `autoSearch` dimatikan: tahap pertama tiap
 * target bukan lagi menyapu, melainkan memutar ke sudut rekaman. Dokumen
 * menyebutnya satu-satunya nilai status baru, dan memperingatkan sisi web perlu
 * mengenalinya — kalau tidak, tahap itu tampil sebagai kata asing.
 */
export const STATUS_TARGET_SAH = ["search", "turning", "measure", "done", "failed"] as const;

/**
 * Baca satu balasan AutoTracking, dua bentuk sekaligus.
 *
 * Bentuk sekarang membungkus semuanya di `value`, dengan `current`/`total`, dan
 * `start` ikut membawa `total` serta `retries`:
 *
 *   {"AutoTracking":{"value":"start","total":50,"retries":1}}
 *   {"AutoTracking":{"value":"target","current":1,"total":50,"status":"search"}}
 *   {"AutoTracking":{"value":"homing"}}
 *   {"AutoTracking":{"value":"finished"}}
 *
 * Bentuk sebelumnya — kemajuan per target TIDAK punya `value` sama sekali, dan
 * nomor targetnya bernama `ke`/`dari`:
 *
 *   {"AutoTracking":{"value":"start"}}
 *   {"AutoTracking":{"ke":1,"dari":50,"status":"search"}}
 *
 * Keduanya dinormalkan ke satu bentuk, dan pesan per target diberi `nilai`
 * "target" walau paketnya tidak menyebutkannya. Tanpa itu pembaca yang mencari
 * `value` akan MENJATUHKAN seluruh kemajuan per target diam-diam: indikatornya
 * berhenti di "start" sampai `finished` datang berpuluh menit kemudian, dan
 * tidak ada galat apa pun yang menunjukkan sebabnya.
 *
 * Jumlah target tidak ikut di `homing` maupun `finished`, jadi pemanggil perlu
 * mempertahankan nilai sebelumnya saat pesan berikutnya tidak membawanya.
 */
export type BalasanTracking = {
  ada: boolean;
  nilai: string;
  kelas: KelasBalasan;
  /** Nomor target yang sedang dikerjakan; null kalau paketnya tidak membawa. */
  ke: number | null;
  /** Jumlah target satu siklus; null kalau paketnya tidak membawa. */
  dari: number | null;
  status: string;
  retries: number | null;
};

export function bacaBalasanTracking(paket: unknown): BalasanTracking {
  const kosong: BalasanTracking = {
    ada: false, nilai: "", kelas: "kemajuan", ke: null, dari: null, status: "", retries: null,
  };
  if (paket === null || typeof paket !== "object") return kosong;
  const o = paket as Record<string, unknown>;

  const n = (...kunci: string[]) => {
    for (const k of kunci) {
      if (o[k] === undefined || o[k] === null || o[k] === "") continue;
      const x = Number(o[k]);
      if (Number.isFinite(x)) return x;
    }
    return null;
  };

  const ke = n("ke", "current");
  const dari = n("dari", "total");
  const status = o.status === undefined || o.status === null ? "" : String(o.status);
  const retries = n("retries");

  const v = o.value ?? o.stage;
  if (v !== undefined && v !== null) {
    const nilai = String(v);
    return { ada: true, nilai, kelas: klasifikasiTracking(nilai), ke, dari, status, retries };
  }

  // Tanpa `value`: kemajuan per target. Dikenali dari `ke`/`dari`/`status`,
  // bukan dari "objeknya tidak kosong" — paket asing tidak boleh ikut terbaca
  // sebagai kemajuan tracking.
  if (ke === null && dari === null && status === "") return kosong;
  return { ada: true, nilai: "target", kelas: "kemajuan", ke, dari, status, retries };
}

// ── setHome (Bagian C.6) ─────────────────────────────────────────────────────
//
//   {"setHome":{"value":"start"}}      ┐
//   {"setHome":{"value":"check"}}      ├ tahapan
//   {"setHome":{"value":"read"}}       ┘
//   {"setHome":{"setHome":"HOME-01,0,151,38,71,206,04,62;"}}  ← rekaman tersimpan
//   {"setHome":{"value":"done"}}       ← selesai
//
//   {"setHome":{"value":"RTS Off"}}      ┐ DITOLAK — EEPROM tidak disentuh,
//   {"setHome":{"value":"read failed"}}  ┘ posisi home lama tetap utuh
//
// Aturan pemilahannya dari dokumen: ADA `value` → tahapan atau penolakan;
// TIDAK ada → rekaman tersimpan. Membaca `value` lebih dulu tanpa memilah
// membuat "RTS Off" terbaca sebagai keberhasilan — dan itu titik acuan pulang
// teleskop, jadi salah baca di sini tidak terkoreksi sendiri.

export type JenisBalasanSetHome = "tahap" | "selesai" | "tersimpan" | "ditolak" | "bukan";

export type BalasanSetHome = {
  jenis: JenisBalasanSetHome;
  /** Isi `value` untuk tahap/penolakan; kosong untuk rekaman. */
  nilai: string;
  /** String mentah rekaman home; hanya terisi saat jenis "tersimpan". */
  rekaman: string;
};

/** Nilai `value` yang berarti perintah setHome DITOLAK. */
const NILAI_TOLAK_SETHOME = ["RTS Off", "read failed"];

export function bacaBalasanSetHome(paket: unknown): BalasanSetHome {
  const kosong: BalasanSetHome = { jenis: "bukan", nilai: "", rekaman: "" };
  if (paket === null || typeof paket !== "object") return kosong;
  const o = paket as Record<string, unknown>;

  // `value` diperiksa LEBIH DULU, sesuai aturan pemilahan dokumen.
  const v = o.value ?? o.stage;
  if (v !== undefined && v !== null) {
    const nilai = String(v);
    if (NILAI_TOLAK_SETHOME.includes(nilai)) return { jenis: "ditolak", nilai, rekaman: "" };
    if (nilai === "done") return { jenis: "selesai", nilai, rekaman: "" };
    return { jenis: "tahap", nilai, rekaman: "" };
  }

  if (o.setHome !== undefined && o.setHome !== null) {
    return { jenis: "tersimpan", nilai: "", rekaman: String(o.setHome) };
  }
  return kosong;
}

// ── turning_target → balasan bernama TurningTarget (Bagian C.4) ──────────────
//
//   {"TurningTarget":{"value":"start","target":3}}   ┐ tahapan
//   {"TurningTarget":{"value":"rotate","target":3}}  ┘
//   {"TurningTarget":{"value":1}}                    ← angka, demi kompatibilitas
//   {"TurningTarget":{"value":"done"}}               ← penutup sekarang
//   {"TurningTarget":{"value":"bad target","target":99}}  ← DITOLAK, di luar 1-50
//
// Nama balasannya PascalCase. Revisi dokumen sebelumnya menulisnya huruf kecil;
// itu keliru dan sudah diralat. Bentuk huruf kecil tetap ikut dibaca pemanggil
// karena tidak ada ruginya.
//
// Penolakan `bad target` penting: tanpa mengenalinya, nomor di luar rentang
// tidak mengerjakan apa pun tapi balasannya tetap membawa status rotasi
// SEBELUMNYA, sehingga terlihat berhasil.

export function klasifikasiTurningTarget(paket: unknown): KelasBalasan | "bukan" {
  if (paket === null || typeof paket !== "object") return "bukan";
  const o = paket as Record<string, unknown>;
  const v = o.value ?? o.stage;
  if (v === undefined || v === null) return "bukan";

  const nilai = String(v);
  if (nilai === "done" || nilai === "1" || nilai === "true") return "selesai";
  if (nilai === "bad target" || nilai === "0" || nilai === "false" || nilai === "failed") return "gagal";
  return "kemajuan";
}

// ── jog: geser relatif (Bagian C.5) ──────────────────────────────────────────
//
//   {"set_30002":{"command":"set_rts","jog":{"ha":0.5,"va":-0.01}}}
//
// Satuan selisih DERAJAT DESIMAL, dan pecahan diterima. Menit ÷ 60, detik
// ÷ 3600.
//
//   SATUANNYA BERUBAH DI REVISI 3. Revisi 2 memakai DETIK BUSUR — satu derajat
//   dikirim sebagai 3600. Selisihnya 3600×, dan salah pilih TIDAK memunculkan
//   galat: instrumen tetap bergerak, hanya ke tempat yang sama sekali lain.
//   Nilai 3600 yang dimaksudkan satu derajat menjadi sepuluh putaran penuh.
//
//   Jangan "memperbaiki" ini kembali ke detik busur tanpa mengecek revisi
//   dokumen lebih dulu.
//
// Instrumen tidak punya perintah gerak relatif; logger mengerjakannya dalam
// tiga langkah — baca sudut sekarang, tambahkan selisih, putar ke hasilnya:
//
//   {"Jog":{"value":"start","ha":0.5,"va":-0.01}}
//   {"Jog":{"value":"check"}}
//   {"Jog":{"value":"read"}}
//   {"Jog":{"value":"target","dari_HA":"151.3871","dari_VA":"206.0462",
//                            "ke_HA":"151,53,14","ke_VA":"206,02,10"}}
//   {"Jog":{"value":"rotate"}}
//   {"Jog":{"value":"done"}}
//
// Penolakan: "RTS Off", "read failed", "bad base" (+ HA/VA), "failed".
//
// PERHATIKAN dua satuan berbeda di dalam SATU balasan `target`:
// `dari_*` DERAJAT DESIMAL — angka mentah instrumen, apa adanya;
// `ke_*`   DMS `derajat,menit,detik` — mengikuti bentuk perintah rotasi.
// Keduanya sengaja dikirim supaya bisa dicocokkan dengan layar instrumen.
// Dibiarkan sebagai string dan tidak ditafsirkan di sini.

export type JenisBalasanJog = "tahap" | "target" | "selesai" | "ditolak" | "bukan";

export type BalasanJog = {
  jenis: JenisBalasanJog;
  nilai: string;
  /** Terisi pada value "target": titik awal dan tujuan, apa adanya. */
  dariHA?: string;
  dariVA?: string;
  keHA?: string;
  keVA?: string;
  /** Terisi pada penolakan "bad base": sudut awal yang dianggap tidak sah. */
  HA?: string;
  VA?: string;
};

const NILAI_TOLAK_JOG = ["RTS Off", "read failed", "bad base", "failed"];

export function bacaBalasanJog(paket: unknown): BalasanJog {
  if (paket === null || typeof paket !== "object") return { jenis: "bukan", nilai: "" };
  const o = paket as Record<string, unknown>;
  const v = o.value ?? o.stage;
  if (v === undefined || v === null) return { jenis: "bukan", nilai: "" };

  const nilai = String(v);
  const s = (k: string) => (o[k] === undefined || o[k] === null ? undefined : String(o[k]));

  if (NILAI_TOLAK_JOG.includes(nilai)) {
    return { jenis: "ditolak", nilai, HA: s("HA"), VA: s("VA") };
  }
  if (nilai === "target") {
    return {
      jenis: "target",
      nilai,
      dariHA: s("dari_HA"),
      dariVA: s("dari_VA"),
      keHA: s("ke_HA"),
      keVA: s("ke_VA"),
    };
  }
  if (nilai === "done") return { jenis: "selesai", nilai };
  return { jenis: "tahap", nilai };
}

/** Penjelasan singkat tiap penolakan jog, untuk ditampilkan apa adanya. */
export const SEBAB_TOLAK_JOG: Record<string, string> = {
  "RTS Off": "RTS tidak menjawab. Nyalakan instrumen lebih dulu.",
  "read failed": "Instrumen menjawab, tapi sudutnya tidak terbaca.",
  // Dokumen menegaskan ini SENGAJA menolak, bukan memperbaiki: menambahkan
  // selisih ke sudut yang sudah ngawur hanya memindahkan kengawurannya, dan
  // instrumen akan menurutinya dengan yakin ke arah yang salah.
  "bad base": "Sudut awal instrumen di luar rentang wajar, jadi geseran ditolak daripada memperparah.",
  failed: "Rotasi gagal dijalankan.",
};

// ── manual_hava: baca sudut sekarang (Bagian C.1) ────────────────────────────
//
//   {"ManualHAVA":{"HA":"151,38,71","VA":"206,04,62"}}
//
// Membaca langsung dari instrumen, timeout 5 detik. Kalau instrumen tidak
// menjawab, KEDUANYA menjadi "000,00,00" — itu penanda gagal, bukan sudut
// sungguhan.
//
// Nilainya TIDAK ditafsirkan, dan detik ≥ 60 di contoh itu bukan salah ketik.
// Revisi 3 menjelaskan sebabnya: instrumen mengirim desimal derajat
// ("151.3871"), lalu `parseAndFormat()` di firmware memotong string itu seolah
// menit dan detik — menghasilkan "151,38,71". Jadi bentuknya MIRIP DMS tapi
// bukan DMS; angka itu sebenarnya 151,3871 derajat.
//
// Tetap ditampilkan apa adanya, tidak dikonversi. Dokumen menyebut ini bug
// yang akan diperbaiki, dan begitu `parseAndFormat()` benar, string yang sama
// akan berubah makna menjadi DMS sungguhan — konversi yang dipasang sekarang
// akan diam-diam menjadi salah tepat saat firmware membaik. Jog tidak kena
// karena membaca angka mentahnya sendiri, sehingga jog dan `turning_target` ke
// titik yang sama bisa berbeda sekitar setengah derajat.

export const PENANDA_HAVA_GAGAL = "000,00,00";

export type BacaanHaVa = { ada: boolean; gagal: boolean; HA: string; VA: string };

export function bacaManualHaVa(paket: unknown): BacaanHaVa {
  const kosong: BacaanHaVa = { ada: false, gagal: false, HA: "", VA: "" };
  if (paket === null || typeof paket !== "object") return kosong;
  const o = paket as Record<string, unknown>;
  if (o.HA === undefined && o.VA === undefined) return kosong;

  const HA = o.HA === undefined || o.HA === null ? "" : String(o.HA);
  const VA = o.VA === undefined || o.VA === null ? "" : String(o.VA);
  return { ada: true, gagal: HA === PENANDA_HAVA_GAGAL && VA === PENANDA_HAVA_GAGAL, HA, VA };
}

// ── Langkah jog ──────────────────────────────────────────────────────────────
//
// Satuan DERAJAT DESIMAL, dan seluruh presetnya memang derajat — bukan campuran
// detik/menit/derajat seperti sebelumnya.
//
// Set lama (10", 1', 10', 1°) menuntut operator berpindah satuan di tengah
// pekerjaan: tiga label pertama satuannya berbeda-beda padahal yang dikirim
// selalu derajat desimal, jadi hubungan antara label dan angka yang terkirim
// tidak kelihatan. Sekarang semuanya satu satuan dan naik berlipat, sehingga
// besar langkahnya bisa dibandingkan sekali lihat.
//
// Rentangnya juga digeser ke atas: langkah terhalus lama 0,00278° praktis tidak
// terlihat menggerakkan teleskop pada jarak kerja biasa.
//
// Berhenti di 10°. Pernah dicoba sampai 15° dan secara teknis jalan, tapi
// dibatalkan: teropong hanya bisa dipakai kira-kira di ZA 30°–150°, dan langkah
// sebesar itu di sumbu vertikal menabrak batas tersebut dalam dua pencetan.
// Firmware TIDAK memeriksanya — di luar rentang, instrumen menolak diam-diam
// dan satu-satunya jejaknya `Rotate` gagal dengan alasan `no_response`.
//
// ⚠ Preset terkasar HARUS <= MAKS_JOG_DERAJAT, kalau tidak tombolnya ditolak
// validasiJog di route dan tidak pernah menggerakkan apa pun. Keduanya sekarang
// sama-sama 10° — menaikkan preset di sini berarti menaikkan batas itu juga.
export const LANGKAH_JOG = [
  { label: "1°", derajat: 1, keterangan: "halus" },
  { label: "5°", derajat: 5, keterangan: "sedang" },
  { label: "10°", derajat: 10, keterangan: "kasar" },
];

/**
 * Kehalusan terkecil yang masih menggerakkan instrumen: satu detik busur.
 *
 * Perintah rotasi disusun dalam DMS bulat, jadi selisih di bawah ini
 * dibulatkan hilang dan instrumen TIDAK BERGERAK SAMA SEKALI — tanpa galat,
 * tanpa balasan yang berbeda. Ditolak di sini supaya diam itu punya sebab yang
 * bisa dibaca operator.
 */
export const RESOLUSI_JOG_DERAJAT = 1 / 3600;

/**
 * Batas satu kali geser.
 *
 * TIDAK ada di protokol — dipilih sendiri sebagai pagar salah ketik terhadap
 * pemanggil API mana pun; geseran raksasa akibat typo hanya membuang waktu
 * memutar balik.
 *
 * Nilainya DIIKATKAN ke preset terkasar di LANGKAH_JOG, bukan dipilih bebas:
 * batas yang lebih kecil dari preset membuat tombol terkasar ditolak di route
 * dan tidak pernah menggerakkan apa pun — gagal yang tidak kelihatan sebagai
 * bug UI. Naikkan keduanya bersamaan.
 *
 * Bukan pengganti batas sumbu vertikal. Teropong hanya bisa dipakai kira-kira
 * di ZA 30°–150°, firmware TIDAK memeriksanya, dan di luar itu instrumen
 * menolak diam-diam lalu berakhir sebagai `{"Rotate":{"value":"failed",
 * "reason":"no_response"}}`. Batas itu bergantung pada sudut instrumen saat
 * ini, yang tidak diketahui route — jadi tidak dijaga di sini.
 */
export const MAKS_JOG_DERAJAT = 10;

export function validasiJog(ha: unknown, va: unknown): string | null {
  const a = Number(ha);
  const b = Number(va);
  // Pecahan justru bentuk yang lazim sekarang — yang ditolak hanya yang bukan
  // angka. `Number("")` menghasilkan 0, jadi string kosong lolos ke pengecekan
  // "tidak ada geseran" di bawah, bukan lolos diam-diam sebagai perintah.
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return "Nilai geser harus berupa angka (derajat desimal)";
  }
  if (Math.abs(a) < RESOLUSI_JOG_DERAJAT && Math.abs(b) < RESOLUSI_JOG_DERAJAT) {
    return a === 0 && b === 0
      ? "Tidak ada geseran yang diminta"
      : "Geseran di bawah 0,000278° (satu detik busur) dibulatkan hilang — instrumen tidak akan bergerak";
  }
  if (Math.abs(a) > MAKS_JOG_DERAJAT || Math.abs(b) > MAKS_JOG_DERAJAT) {
    return `Sekali geser dibatasi ±${MAKS_JOG_DERAJAT}°`;
  }
  return null;
}

// ── measure_bs / measure_fs (Bagian C.2) ─────────────────────────────────────
//
//   {"set_30002":{"command":"set_rts","measure_fs":true}}
//
//   {"MeasureFS":{"value":"start"}}
//   {"MeasureFS":{"value":"measure"}}
//   {"MeasureFS":{"HADMS":"151,38,71","VADMS":"102,50,53",
//                 "SDis":"123.456","HD":"120.3451"}}
//   {"MeasureFS":{"value":"done"}}
//
// Gagal — keempat medan DIKOSONGKAN, lalu penutupnya "failed":
//
//   {"MeasureFS":{"HADMS":"","VADMS":"","SDis":"","HD":""}}
//   {"MeasureFS":{"value":"failed"}}
//
// Urutan itu penting: baris kosong datang SEBELUM "failed". Hasil yang seluruh
// medannya kosong TIDAK boleh ditampilkan sebagai bacaan — di revisi sebelumnya
// `SDis` tetap dikirim saat gagal, jadi kebiasaan lama membaca angka apa adanya
// akan menampilkan jarak yang tidak pernah terukur.
//
// `HD` (jarak horizontal) dihitung logger dari SD × sin(sudut zenit), dan HANYA
// ada di balasan ini — payload data berkala tidak memuatnya sama sekali.
//
// Catatan: sebelum revisi ini `measure_fs` salah dibalas dengan nama
// `MeasureBS`. Sekarang sudah benar. Pemanggil memilah lewat NAMA KUNCI, bukan
// menebak dari perintah yang dikirim — kalau firmware lama masih beredar,
// hasilnya akan tampil di kolom yang salah, dan itu lebih jujur daripada
// menerka-nerka mana yang dimaksud.

export type JenisBalasanUkur = "tahap" | "hasil" | "selesai" | "gagal" | "bukan";

export type BalasanUkur = {
  jenis: JenisBalasanUkur;
  nilai: string;
  HADMS?: string;
  VADMS?: string;
  SDis?: string;
  HD?: string;
  /** true = keempat medan kosong; bentuk yang mendahului "failed". */
  kosong?: boolean;
};

export function bacaBalasanUkur(paket: unknown): BalasanUkur {
  if (paket === null || typeof paket !== "object") return { jenis: "bukan", nilai: "" };
  const o = paket as Record<string, unknown>;

  const v = o.value ?? o.stage;
  if (v !== undefined && v !== null) {
    const nilai = String(v);
    if (nilai === "failed") return { jenis: "gagal", nilai };
    if (nilai === "done") return { jenis: "selesai", nilai };
    return { jenis: "tahap", nilai };
  }

  const punyaMedan = ["HADMS", "VADMS", "SDis", "HD"].some((k) => o[k] !== undefined);
  if (!punyaMedan) return { jenis: "bukan", nilai: "" };

  const s = (k: string) => (o[k] === undefined || o[k] === null ? "" : String(o[k]));
  const HADMS = s("HADMS"), VADMS = s("VADMS"), SDis = s("SDis"), HD = s("HD");
  const kosong = [HADMS, VADMS, SDis, HD].every((x) => x.trim() === "");

  return { jenis: "hasil", nilai: "", HADMS, VADMS, SDis, HD, kosong };
}

/** Perintah ukur yang didukung, beserta nama kunci balasannya. */
export const JENIS_UKUR = {
  bs: { perintah: "measure_bs", balasan: "MeasureBS", label: "Backsight" },
  fs: { perintah: "measure_fs", balasan: "MeasureFS", label: "Foresight" },
} as const;

export type KodeUkur = keyof typeof JENIS_UKUR;

// ── SearchArea (Bagian D) ────────────────────────────────────────────────────
//
//   permintaan : {"SearchArea":{"Hor":15,"Ver":15}}      ← Hor / Ver
//   balasan    : {"SearchArea":{"horizontal":15,"vertical":15}}  ← horizontal / vertical
//
// Nama medannya BERBEDA antara permintaan dan balasan. Dokumen menyebutnya
// eksplisit, dan memakai nama yang sama di kedua arah akan gagal diam-diam:
// permintaannya diabaikan firmware, balasannya tidak pernah terbaca.
//
// ⚠ auto_search SENDIRIAN tidak memakai nilai ini.
//
// PowerOn mengirim `*/PA 1,0,7.0000,7.0000` yang ter-hardcode, menimpa
// SearchArea yang tersimpan. AutoTracking tidak kena karena memasang ulang
// rentangnya sebelum tiap target, tapi `auto_search` yang dikirim sendirian
// memakai apa pun yang sedang ada di instrumen — yaitu 7° setelah PowerOn.
// Kirim SearchArea DULU kalau rentangnya penting.
export const RENTANG_SETELAH_POWERON_DERAJAT = 7;

/**
 * Bawaan firmware untuk SearchArea: 15×15 derajat.
 *
 * Dipakai sebagai isi awal kolom, bukan angka 7 yang dipasang PowerOn — 7
 * BUKAN kelipatan 1,5, jadi memakainya sebagai isi awal membuat formulir
 * gagal pada nilainya sendiri. Angka 7 tetap disebut di keterangan karena itu
 * memang keadaan instrumen setelah PowerOn.
 */
export const BAWAAN_SEARCH_AREA_DERAJAT = 15;

/**
 * Rentang sudut yang sah — BERBEDA antara horizontal dan vertikal.
 *
 * Revisi sebelumnya hanya menyebut satu rentang 0–180 untuk SearchArea yang
 * waktu itu masih bertipe number. Sekarang bentuknya objek dan batasnya
 * dipisah: `Hor` 0–180°, `Ver` 0–90°. Memakai 180 untuk keduanya membiarkan
 * nilai vertikal yang tidak akan pernah berlaku lolos ke alat.
 *
 * Firmware TIDAK memeriksa apa pun di jalur ini — nilainya ditulis ke EEPROM
 * dan diteruskan ke instrumen apa adanya. Batasnya baru ditegakkan saat alat
 * menyala berikutnya, dan yang ditolak di situ direset ke 15, bukan
 * dikembalikan ke nilai lama. Jadi pemeriksaan di sini satu-satunya yang ada.
 */
export const RENTANG_SEARCH_AREA = {
  hor: { min: 0, maks: 180 },
  ver: { min: 0, maks: 90 },
};

/**
 * Instrumen hanya menerima kelipatan 1,5 derajat: 1.5, 3, 4.5, 6, 7.5, …
 *
 * Pecahannya bermakna — jangan dibulatkan ke bilangan bulat sebelum dikirim.
 * Nilai di antaranya tidak menghasilkan galat, cuma tidak berlaku seperti yang
 * diminta.
 */
export const KELIPATAN_SEARCH_AREA = 1.5;

/** Kelipatan 1,5 terdekat di atas dan di bawah `n`, untuk pesan kesalahan. */
function kelipatanTerdekat(n: number): [number, number] {
  const bawah = Math.floor(n / KELIPATAN_SEARCH_AREA) * KELIPATAN_SEARCH_AREA;
  return [bawah, bawah + KELIPATAN_SEARCH_AREA];
}

export function validasiSearchArea(hor: unknown, ver: unknown): string | null {
  const medan = [
    ["Horizontal", hor, RENTANG_SEARCH_AREA.hor],
    ["Vertikal", ver, RENTANG_SEARCH_AREA.ver],
  ] as const;

  for (const [nama, v, rentang] of medan) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < rentang.min || n > rentang.maks) {
      return `${nama} harus antara ${rentang.min} dan ${rentang.maks} derajat`;
    }
    // Perbandingan lewat perkalian, bukan sisa bagi: 4.5 % 1.5 tidak nol di
    // aritmetika pecahan biner.
    const kelipatan = Math.round(n / KELIPATAN_SEARCH_AREA);
    if (Math.abs(kelipatan * KELIPATAN_SEARCH_AREA - n) > 1e-9) {
      const [bawah, atas] = kelipatanTerdekat(n);
      return `${nama} harus kelipatan ${KELIPATAN_SEARCH_AREA} derajat — pakai ${bawah} atau ${atas}, bukan ${n}`;
    }
  }
  return null;
}

export type BalasanSearchArea = { ada: boolean; horizontal: number | null; vertical: number | null };

/**
 * Baca balasan SearchArea — memakai `horizontal`/`vertical`, BUKAN `Hor`/`Ver`.
 *
 * Bentuk yang sama muncul di dua tempat: sebagai balasan tersendiri, dan sebagai
 * salah satu medan di snapshot ack konfigurasi.
 */
export function bacaBalasanSearchArea(paket: unknown): BalasanSearchArea {
  const kosong: BalasanSearchArea = { ada: false, horizontal: null, vertical: null };
  if (paket === null || typeof paket !== "object") return kosong;
  const o = paket as Record<string, unknown>;
  if (o.horizontal === undefined && o.vertical === undefined) return kosong;

  const n = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number(v));
  return { ada: true, horizontal: n(o.horizontal), vertical: n(o.vertical) };
}

// ── Diagnostik instrumen: Rotate / Idle / Tilt (Bagian F.5 & F.6) ────────────
//
//   {"Rotate":{"value":"ok","ms":1840}}
//   {"Rotate":{"value":"failed","reason":"no_response","ms":3001,"raw":""}}
//   {"Idle":{"value":"failed","reason":"bad_response","ms":120,"raw":"Ej 0,0,50,7.2"}}
//   {"Tilt":{"value":"failed","reason":"no_response","ms":5002,"raw":""}}
//
// `Rotate` datang dari SETIAP jalur rotasi — rotate, turning_target, jog,
// HomePosition, dan tiap target di AutoTracking. Jadi ini sinyal lintas
// perintah, bukan milik satu tombol. Keberhasilannya (`value":"ok"`) baru ada
// di revisi ini; sebelumnya hanya kegagalan yang dilaporkan.
//
// `raw` yang membedakan INSTRUMEN DIAM dari INSTRUMEN MENJAWAB TAPI ISINYA
// LAIN — dua masalah dengan penanganan yang sangat berbeda. Ditampilkan apa
// adanya, tidak ditafsirkan.

export const NAMA_DIAGNOSTIK = ["Rotate", "Idle", "Tilt"] as const;
export type NamaDiagnostik = (typeof NAMA_DIAGNOSTIK)[number];

export const ARTI_ALASAN_DIAGNOSTIK: Record<string, string> = {
  no_response: "Instrumen diam sama sekali — periksa daya dan kabel.",
  bad_response: "Instrumen menjawab, tapi isinya bukan yang ditunggu.",
  timeout: "Instrumen menjawab bertahap tapi tak pernah selesai.",
};

/**
 * Nama pendek untuk chip di bar kontrol, tempat lebarnya cuma cukup beberapa
 * kata. Kalimat panjangnya tetap dipakai di `title` chip itu.
 */
export const OPERASI_DIAGNOSTIK_RINGKAS: Record<NamaDiagnostik, string> = {
  Rotate: "Putar motor",
  Idle: "Status instrumen",
  Tilt: "Baca kemiringan",
};

export const OPERASI_DIAGNOSTIK: Record<NamaDiagnostik, string> = {
  Rotate: "Perintah putar motor",
  Idle: "Pemeriksaan status instrumen",
  // Tanpa pesan ini, sensor24/sensor25 bernilai "0" terlihat sama untuk dua
  // keadaan berbeda: instrumen memang datar, atau instrumen tidak menjawab.
  Tilt: "Pembacaan kemiringan",
};

export type Diagnostik = {
  ada: boolean;
  nama: NamaDiagnostik | "";
  ok: boolean;
  alasan: string;
  ms: number | null;
  raw: string;
};

export function bacaDiagnostik(nama: NamaDiagnostik, paket: unknown): Diagnostik {
  const kosong: Diagnostik = { ada: false, nama: "", ok: false, alasan: "", ms: null, raw: "" };
  if (paket === null || typeof paket !== "object") return kosong;
  const o = paket as Record<string, unknown>;
  const v = o.value ?? o.stage;
  if (v === undefined || v === null) return kosong;

  const nilai = String(v);
  return {
    ada: true,
    nama,
    ok: nilai === "ok",
    alasan: o.reason === undefined || o.reason === null ? "" : String(o.reason),
    ms: o.ms === undefined || o.ms === null ? null : Number(o.ms),
    raw: o.raw === undefined || o.raw === null ? "" : String(o.raw),
  };
}

// ── getTilt → balasan data_tilt (Bagian C) ───────────────────────────────────
//
//   {"set_30002":{"command":"set_rts","getTilt":true}}
//   → {"data_tilt":{"tilt1":"-0.00732","tilt2":"0.0198"}}
//
// Nama balasannya `data_tilt`, BUKAN `getTilt` maupun `Tilt` — salah satu dari
// beberapa perintah yang nama balasannya berbeda dari nama perintahnya.
//
// `Tilt` adalah hal LAIN: itu pesan diagnostik kegagalan komunikasi, sebentuk
// dengan `Rotate` dan `Idle`, dan dibaca bacaDiagnostik(). Kalau siklus itu
// mengeluarkan `Tilt` gagal, angka kemiringan yang tersimpan bukan hasil ukur.
//
// Nilainya dibiarkan STRING. Instrumen mengirimkannya begitu, dan mengubahnya
// jadi number membuat "0" hasil pembacaan tidak bisa dibedakan dari 0 bawaan.

export type BacaanTilt = { ada: boolean; tilt1: string; tilt2: string };

export function bacaBalasanTilt(paket: unknown): BacaanTilt {
  const kosong: BacaanTilt = { ada: false, tilt1: "", tilt2: "" };
  if (paket === null || typeof paket !== "object") return kosong;
  const o = paket as Record<string, unknown>;
  if (o.tilt1 === undefined && o.tilt2 === undefined) return kosong;

  const s = (k: string) => (o[k] === undefined || o[k] === null ? "" : String(o[k]));
  return { ada: true, tilt1: s("tilt1"), tilt2: s("tilt2") };
}

// ── trackEvery — jadwal AutoTracking (Bagian D, `_timeScheduled`) ────────────
//
//   {"set_30002":{"command":"set_rts","trackEvery":10}}
//
// Hanya ada di varian firmware `_timeScheduled`. Di unit lain perintahnya
// tidak dikenali dan TIDAK membalas apa pun — jadi ketiadaan balasan bukan
// bukti kegagalan jaringan.
//
// Konfirmasinya ikut ack kolektif setelan (`updated` memuat "trackEvery");
// penolakan datang sebagai `error_trackEvery`.

/** Interval yang diterima firmware. `0` mematikan jadwal. */
// ── autoSearch — mode AutoTracking (Bagian D) ────────────────────────────────
//
//   {"set_30002":{"command":"set_rts","autoSearch":false}}
//
// Menentukan apakah AutoTracking menyapu mencari prisma di tiap target, atau
// langsung memutar ke sudut rekaman lalu mengukur. Tersimpan di EEPROM, jadi
// bertahan setelah alat mati. Bawaannya true.
//
// Yang berubah saat dimatikan:
//   - tahap pertama tiap target bernama "turning", bukan "search";
//   - {"AutoSearch":{"value":1}} per target tidak lagi terbit;
//   - SearchArea tidak terpakai sampai autoSearch dinyalakan lagi.
//
// Arti `failed` ikut bergeser: dengan autoSearch berarti prisma tidak ketemu
// saat disapu, tanpa autoSearch berarti pengukurannya sendiri tidak
// menghasilkan jarak.
//
// Nilai yang tidak dikenal dibalas SENDIRI di luar ack kolektif:
//   {"autoSearch":{"error":"unknown value"}}

/**
 * Normalkan nilai autoSearch ke boolean.
 *
 * Firmware menerima `true`/`false`, `1`/`0`, dan `"ON"`/`"OFF"`. Dinormalkan di
 * satu tempat supaya jalur mana pun mengirim bentuk yang sama — mengirim
 * bentuk lain yang kebetulan tidak dikenal tidak menghasilkan galat yang
 * terlihat, hanya balasan terpisah yang mudah terlewat.
 */
export function bacaAutoSearch(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1 ? true : v === 0 ? false : null;
  const t = String(v ?? "").trim().toLowerCase();
  if (t === "true" || t === "1" || t === "on") return true;
  if (t === "false" || t === "0" || t === "off") return false;
  return null;
}

export const NILAI_TRACK_EVERY = [0, 5, 10, 15, 20, 30, 60] as const;

export function validasiTrackEvery(v: unknown): string | null {
  const n = Number(v);
  if (!Number.isInteger(n) || !NILAI_TRACK_EVERY.includes(n as (typeof NILAI_TRACK_EVERY)[number])) {
    return `Jadwal hanya menerima ${NILAI_TRACK_EVERY.join(", ")} menit (0 = mati)`;
  }
  return null;
}

/**
 * Perkiraan lama satu siklus, untuk memperingatkan jadwal yang terlewat.
 *
 * Siklus yang lebih lama dari intervalnya MELEWATKAN jadwal berikutnya, bukan
 * menumpuknya — tidak ada utang jadwal yang dibayar belakangan. Dengan 50
 * target satu siklus lewat 30 menit, jadi `trackEvery` 5 atau 10 praktis
 * berarti "jalan hampir terus-menerus".
 *
 * Angkanya kasar dan memang cuma untuk peringatan: lama sebenarnya bergantung
 * pada jarak antar target dan berapa kali prisma gagal ditemukan.
 */
export const PERKIRAAN_DETIK_PER_TARGET = 40;

export function jadwalTerlewat(menit: number, jumlahTarget: number): boolean {
  if (menit <= 0 || jumlahTarget <= 0) return false;
  return (jumlahTarget * PERKIRAAN_DETIK_PER_TARGET) / 60 > menit;
}

// ── replay — tarik ulang rekaman SD (Bagian C.8, `_timeScheduled`) ───────────
//
//   {"set_30002":{"command":"set_rts","replay":{"tanggal":"20260903",
//                                               "target":"P5","jam":"14:30"}}}
//
//   {"Replay":{"value":"data","tanggal":"20260903","rows":[…],
//              "cocok":3,"terkirim":3,"sisa":0,"lewati":0}}
//   {"Replay":{"value":"done"}}
//
// Selama `sisa` di atas nol, minta lagi dengan `lewati` dinaikkan sebanyak
// yang sudah terkirim. Satu permintaan dibatasi 20 baris oleh firmware.
//
// Sama seperti trackEvery: hanya ada di varian `_timeScheduled`.

export const BAWAAN_JUMLAH_REPLAY = 10;
export const MAKS_JUMLAH_REPLAY = 20;

/**
 * Kolom berkas `<idAlat>-YYYYMMDD-RTS.csv`, urut sesuai isinya.
 *
 * HA dan VA di berkas ini DERAJAT DESIMAL dan bebas dari bug pembacaan sudut —
 * diambil dari pembacaan mentah instrumen, bukan lewat `parseAndFormat()`.
 * Jadi angka di sini tidak sebanding dengan "151,38,71" yang muncul di
 * manual_hava maupun hasil ukur.
 */
export const KOLOM_REPLAY = [
  "id_alat", "tanggal", "jam", "target", "HA", "VA", "SD", "HD",
  "N", "E", "Z", "N0", "E0", "Z0",
  "tinggi_alat", "tinggi_target", "prisma", "tilt1", "tilt2",
] as const;

export type JenisBalasanReplay = "data" | "selesai" | "ditolak" | "bukan";

export type BalasanReplay = {
  jenis: JenisBalasanReplay;
  nilai: string;
  tanggal: string;
  rows: string[];
  /** Baris yang cocok penyaring, terkirim di paket ini, dan yang masih sisa. */
  cocok: number | null;
  terkirim: number | null;
  sisa: number | null;
  lewati: number | null;
};

const NILAI_TOLAK_REPLAY = ["bad request", "no file", "empty"];

export const SEBAB_TOLAK_REPLAY: Record<string, string> = {
  "bad request": "Permintaan tidak dikenali — periksa tanggalnya.",
  "no file": "Tidak ada berkas rekaman untuk tanggal itu di kartu SD.",
  empty: "Berkasnya ada, tapi tidak ada baris yang cocok dengan penyaring.",
};

export function bacaBalasanReplay(paket: unknown): BalasanReplay {
  const kosong: BalasanReplay = {
    jenis: "bukan", nilai: "", tanggal: "", rows: [],
    cocok: null, terkirim: null, sisa: null, lewati: null,
  };
  if (paket === null || typeof paket !== "object") return kosong;
  const o = paket as Record<string, unknown>;
  const v = o.value ?? o.stage;
  if (v === undefined || v === null) return kosong;

  const nilai = String(v);
  const n = (k: string) => {
    if (o[k] === undefined || o[k] === null || o[k] === "") return null;
    const x = Number(o[k]);
    return Number.isFinite(x) ? x : null;
  };

  if (NILAI_TOLAK_REPLAY.includes(nilai)) return { ...kosong, jenis: "ditolak", nilai };
  if (nilai === "done") return { ...kosong, jenis: "selesai", nilai };
  if (nilai !== "data") return kosong;

  return {
    jenis: "data",
    nilai,
    tanggal: o.tanggal === undefined || o.tanggal === null ? "" : String(o.tanggal),
    rows: Array.isArray(o.rows) ? o.rows.map(String) : [],
    cocok: n("cocok"),
    terkirim: n("terkirim"),
    sisa: n("sisa"),
    lewati: n("lewati"),
  };
}

/**
 * Pecah satu baris CSV rekaman jadi kolom bernama.
 *
 * Baris dengan jumlah medan yang tidak pas dikembalikan null, bukan dipaksakan
 * masuk: berkas sensor lama punya cacat persis itu — HA-nya berisi koma
 * sehingga tiap baris punya lebih banyak medan daripada headernya, dan pengurai
 * per kolom salah baca tanpa galat. Berkas `-RTS.csv` tidak punya masalah itu,
 * dan pemeriksaan ini yang memastikannya tetap begitu.
 */
export function uraiBarisReplay(baris: string): Record<string, string> | null {
  const medan = baris.split(",");
  if (medan.length !== KOLOM_REPLAY.length) return null;
  return Object.fromEntries(KOLOM_REPLAY.map((k, i) => [k, medan[i].trim()]));
}

/** Tanggal berkas rekaman: `YYYYMMDD`, dan itu yang memilih berkasnya. */
export function validasiTanggalReplay(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!/^\d{8}$/.test(s)) return "Tanggal harus 8 angka, bentuk YYYYMMDD";
  const th = Number(s.slice(0, 4));
  const bl = Number(s.slice(4, 6));
  const tg = Number(s.slice(6, 8));
  if (th < 2001 || th > 2090) return "Tahun di luar 2001-2090";
  if (bl < 1 || bl > 12) return "Bulan di luar 1-12";
  if (tg < 1 || tg > 31) return "Tanggal di luar 1-31";
  return null;
}

/** `YYYY-MM-DD` dari input tanggal HTML → `YYYYMMDD` yang diminta protokol. */
export function keTanggalReplay(iso: string): string {
  return iso.replace(/-/g, "");
}

// ── Rentang setelan (Bagian D) ───────────────────────────────────────────────
//
// Dokumen menyebutnya eksplisit: nilai di luar rentang TERSIMPAN TANPA
// PENOLAKAN, lalu diam-diam diganti bawaan saat alat menyala berikutnya. Jadi
// backend harus memvalidasi sendiri — firmware tidak akan mengeluh, dan
// setelannya cuma tidak pernah berlaku.

export const RENTANG_RETRIES = { min: 1, maks: 15 };

/**
 * cycleTime lewat MQTT bersatuan MILIDETIK, 1000–600000.
 *
 * Menu serial dan Bluetooth memakai DETIK untuk setelan yang sama, jadi angka
 * yang identik memberi hasil 1000× berbeda tergantung dari mana dikirim.
 */
export const RENTANG_CYCLE_TIME_MS = { min: 1000, maks: 600000 };

/** null = sah; selain itu pesan kesalahan siap tampil. */
export function validasiRetries(v: unknown): string | null {
  const n = Number(v);
  if (!Number.isInteger(n) || n < RENTANG_RETRIES.min || n > RENTANG_RETRIES.maks) {
    return `Retries harus bilangan bulat ${RENTANG_RETRIES.min}–${RENTANG_RETRIES.maks}`;
  }
  return null;
}

export function validasiCycleTime(v: unknown): string | null {
  const n = Number(v);
  if (!Number.isInteger(n) || n < RENTANG_CYCLE_TIME_MS.min || n > RENTANG_CYCLE_TIME_MS.maks) {
    return `Cycle Time harus bilangan bulat ${RENTANG_CYCLE_TIME_MS.min}–${RENTANG_CYCLE_TIME_MS.maks} milidetik (${RENTANG_CYCLE_TIME_MS.min / 1000}–${RENTANG_CYCLE_TIME_MS.maks / 1000} detik)`;
  }
  return null;
}

// ── Konfirmasi setelan (RTS Config) ──────────────────────────────────────────
//
// Balasan setelan berbeda bentuk dari semua balasan lain: DATAR di tingkat atas,
// tidak dibungkus nama perintah.
//
//   {"updated":["jobName","prismConst","tsHigh","locCoor","stepRecord",
//               "retries","cycleTime"],
//    "set_rts":"OK",
//    "jobName":"Demo Tambang MIP","prismConst":"30","tsHigh":"10",
//    "locCoor":["401320.988","525952","62.559"]}
//
// `updated` menyebut TUJUH medan tapi hanya EMPAT yang di-echo. Untuk
// stepRecord, retries, dan cycleTime satu-satunya bukti adalah namanya muncul di
// `updated` — nilainya tidak bisa dicocokkan. Itu penting karena protokol
// menyebut retries dan cycleTime di luar rentang TERSIMPAN tanpa penolakan lalu
// diam-diam diganti bawaan saat alat menyala berikutnya.

/** Medan yang nilainya ikut dikembalikan logger, jadi bisa dicocokkan. */
export const MEDAN_CONFIG_TER_ECHO = [
  "jobName",
  "prismConst",
  "tsHigh",
  "locCoor",
  // Selalu ikut di snapshot ack, jadi selisih antara yang dikirim dan yang
  // benar-benar berlaku ketahuan tanpa perintah tambahan.
  "autoSearch",
];

export type KonfirmasiConfigRts = {
  /** true = balasan setelan; false = pesan lain yang harus diabaikan. */
  cocok: boolean;
  ok: boolean;
  updated: string[];
  setRts: string;
  /** Medan yang nilai echo-nya BERBEDA dari yang dikirim. */
  beda: Array<{ medan: string; dikirim: string; diterima: string }>;
};

/** Normalkan nilai echo: array (locCoor) digabung koma, sisanya jadi string. */
function normalkan(v: unknown): string {
  if (Array.isArray(v)) return v.map(String).join(",");
  return v === null || v === undefined ? "" : String(v);
}

/**
 * Baca balasan konfirmasi setelan dan cocokkan dengan nilai yang dikirim.
 *
 * Pengenalannya lewat `updated` berupa ARRAY di tingkat atas — sengaja BUKAN
 * lewat `set_rts`, karena string itu juga muncul sebagai nilai `command` di
 * payload PERINTAH yang dikirim aplikasi sendiri. Memakainya sebagai penanda
 * berisiko menganggap perintah sendiri sebagai balasan.
 *
 * `dikirim` memakai kunci protokol (jobName, prismConst, tsHigh, locCoor) dengan
 * locCoor sudah berbentuk string dipisah koma.
 */
export function bacaKonfirmasiConfig(
  data: unknown,
  dikirim?: Record<string, string> | null
): KonfirmasiConfigRts {
  const kosong: KonfirmasiConfigRts = { cocok: false, ok: false, updated: [], setRts: "", beda: [] };
  if (data === null || typeof data !== "object") return kosong;

  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.updated)) return kosong;

  const setRts = o.set_rts === undefined ? "" : String(o.set_rts);
  const beda: KonfirmasiConfigRts["beda"] = [];

  if (dikirim) {
    for (const medan of MEDAN_CONFIG_TER_ECHO) {
      if (o[medan] === undefined) continue;
      const diterima = normalkan(o[medan]);
      const asli = (dikirim[medan] ?? "").trim();
      if (diterima.trim() !== asli) beda.push({ medan, dikirim: asli, diterima });
    }
  }

  return {
    cocok: true,
    ok: setRts.toUpperCase() === "OK",
    updated: (o.updated as unknown[]).map(String),
    setRts,
    beda,
  };
}

// ── Uji sapuan custom: command "autosearch" (ADR_RTS_PORTING §3.2) ───────────
//
//   {"set_10284":{"command":"autosearch","jenis":"custom","step":"0,30,00",
//                 "Hlebar":"1,00,00","Vlebar":"1,00,00","rehat":500}}
//
// Balasannya SEMUA di bawah kunci `autosearch` (huruf kecil) — bukan
// `AutoSearch` milik `auto_search`. Urutannya:
//
//   {"autosearch":{"value":"check"}}                       cek instrumen menyala
//   {"autosearch":{"value":"read"}}                        baca titik tengah
//   {"autosearch":{"ke":0,"dari":0,"tahap":"sweep","titik":25,
//                  "langkah_ha":1800.0,"langkah_va":1800.0}}   sapuan mulai
//   {"Rotate":{"value":"ok","ms":850}}                     per titik (kunci LAIN)
//   {"autosearch":{"tembakan":1,"dari":25,"ha":"..","va":"..","SDis":""}}
//   {"autosearch":{"ke":0,"tahap":"sweep","value":"ketemu","titik_ke":7,...}}
//   {"autosearch":{"jenis":"custom","rehat":500,"value":"ketemu","SDis":"4.1120",...}}
//
// Perangkap:
//
// 1. DUA pesan `value:"ketemu"` di kunci yang sama. Yang bertanda `tahap:"sweep"`
//    hanya menutup sapuan; hasil akhir yang sebenarnya datang sesudahnya dan
//    TIDAK memuat `tahap`. Berhenti di pesan pertama berarti kehilangan `SDis`.
// 2. `dibatalkan` membawa `tembakan`/`dari` juga, jadi bentuknya mirip pesan
//    per titik. `tahap` harus diperiksa lebih dulu daripada `tembakan`.
// 3. `Rotate` per titik terbit di tingkat atas, dan kunci yang sama dipakai jog
//    dan turning_target. Pemanggil tidak boleh menyimpulkan apa pun darinya
//    selain lewat status "sedang uji sapuan" miliknya sendiri.
// 4. `SDis` kosong = prisma belum kena, BUKAN jarak nol.
// 5. `langkah_ha`/`langkah_va` dalam DETIK BUSUR (1800 = 0,5°), sedangkan
//    `step` di perintah dalam d,m,s atau derajat desimal.

/** Batas atas sudut yang diterima firmware untuk step/Hlebar/Vlebar. */
export const MAKS_SUDUT_SAPUAN_DERAJAT = 45;

/** Langkah ke tiap sisi dari titik tengah, maksimum (jadi titik ≤ 61 × 61). */
export const MAKS_LANGKAH_PER_SISI = 30;

export const RENTANG_REHAT_SAPUAN_MS = { min: 0, maks: 10000 };

/**
 * Lama putar satu titik dari SATU contoh di dokumen (`Rotate ... "ms":850`).
 * Bukan ketetapan, dan belum termasuk waktu ukur — jadi dipakai hanya sebagai
 * batas bawah perkiraan, tidak pernah sebagai janji.
 */
export const MS_PUTAR_PER_TITIK_CONTOH = 850;

// Pembagian lebar/step memakai toleransi: 300/30 harus 10, bukan 9 karena galat
// float. Firmware melakukan hal yang sama.
const TOLERANSI_BAGI = 1e-9;

/**
 * Urai sudut sapuan ke derajat desimal. Bentuk yang diterima firmware: "d,m,s"
 * atau derajat desimal. Mengembalikan null untuk yang tidak bisa diurai.
 *
 * Bilangan negatif DIURAI (bukan null) supaya pemanggil bisa membedakan
 * "bentuknya salah" dari "nilainya ≤ 0" — firmware punya dua pesan galat itu.
 * Menit/detik ≥ 60 ditolak: firmware tidak menyebut perilakunya, dan satu
 * kesalahan ketik di sini lebih murah daripada sapuan salah ukuran di lapangan.
 */
export function uraiSudutSapuan(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t === "") return null;

  if (t.includes(",")) {
    const bagian = t.split(",").map((b) => b.trim());
    if (bagian.length !== 3 || bagian.some((b) => !/^\d+(\.\d+)?$/.test(b))) return null;
    const [d, m, s] = bagian.map(Number);
    if (m >= 60 || s >= 60) return null;
    return d + m / 60 + s / 3600;
  }
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

/** Jumlah langkah dari titik tengah ke satu sisi: ⌊lebar / step⌋. */
export function langkahPerSisi(lebar: number, step: number): number {
  return Math.floor(lebar / step + TOLERANSI_BAGI);
}

/** (2·⌊Hlebar/step⌋+1) × (2·⌊Vlebar/step⌋+1) — rumus yang sama dengan firmware. */
export function hitungTitikSapuan(step: number, hlebar: number, vlebar: number): number {
  return (2 * langkahPerSisi(hlebar, step) + 1) * (2 * langkahPerSisi(vlebar, step) + 1);
}

export type PermintaanSapuan = {
  step?: unknown;
  Hlebar?: unknown;
  Vlebar?: unknown;
  rehat?: unknown;
};

export type RencanaSapuan = {
  stepDerajat: number;
  hlebarDerajat: number;
  vlebarDerajat: number;
  /** undefined = tidak dikirim, firmware memakai setelan `rehat` tersimpan. */
  rehat?: number;
  titik: number;
  /** Batas BAWAH: titik × (putar contoh + rehat). Waktu ukur belum dihitung. */
  minimalDetik: number;
};

export type HasilValidasiSapuan =
  | { ok: true; rencana: RencanaSapuan }
  | { ok: false; galat: string };

/**
 * Periksa permintaan sapuan SEBELUM dikirim, dengan batas yang sama dengan
 * firmware (§3.2) — instrumen yang sudah diperintah bergerak tidak bisa
 * ditarik kembali, dan penolakan firmware baru datang lewat MQTT.
 */
export function validasiSapuan(p: PermintaanSapuan): HasilValidasiSapuan {
  const step = uraiSudutSapuan(p.step);
  const hlebar = uraiSudutSapuan(p.Hlebar);
  const vlebar = uraiSudutSapuan(p.Vlebar);
  if (step === null || hlebar === null || vlebar === null) {
    return {
      ok: false,
      galat: "step, Hlebar, dan Vlebar wajib, bentuk d,m,s atau derajat desimal",
    };
  }
  for (const n of [step, hlebar, vlebar]) {
    if (n <= 0 || n > MAKS_SUDUT_SAPUAN_DERAJAT) {
      return {
        ok: false,
        galat: `nilai harus lebih dari 0 dan maksimum ${MAKS_SUDUT_SAPUAN_DERAJAT} derajat`,
      };
    }
  }

  let rehat: number | undefined;
  if (p.rehat !== undefined && p.rehat !== null && p.rehat !== "") {
    const r = Number(p.rehat);
    if (
      !Number.isInteger(r) ||
      r < RENTANG_REHAT_SAPUAN_MS.min ||
      r > RENTANG_REHAT_SAPUAN_MS.maks
    ) {
      return {
        ok: false,
        galat: `rehat dalam milidetik, ${RENTANG_REHAT_SAPUAN_MS.min} sampai ${RENTANG_REHAT_SAPUAN_MS.maks}`,
      };
    }
    rehat = r;
  }

  // Firmware membatasi 30 langkah per sisi. Dokumen tidak menyebut apakah ia
  // menolak atau memotongnya; ditolak di sini supaya operator tidak mengira
  // rentang yang dimintanya tersapu penuh.
  const lebihHa = langkahPerSisi(hlebar, step);
  const lebihVa = langkahPerSisi(vlebar, step);
  if (lebihHa > MAKS_LANGKAH_PER_SISI || lebihVa > MAKS_LANGKAH_PER_SISI) {
    return {
      ok: false,
      galat: `terlalu banyak langkah: Hlebar/step = ${lebihHa}, Vlebar/step = ${lebihVa}, maksimum ${MAKS_LANGKAH_PER_SISI} per sisi — perbesar step atau perkecil lebar`,
    };
  }

  const titik = hitungTitikSapuan(step, hlebar, vlebar);
  const msPerTitik = MS_PUTAR_PER_TITIK_CONTOH + (rehat ?? 0);
  return {
    ok: true,
    rencana: {
      stepDerajat: step,
      hlebarDerajat: hlebar,
      vlebarDerajat: vlebar,
      rehat,
      titik,
      minimalDetik: Math.ceil((titik * msPerTitik) / 1000),
    },
  };
}

/**
 * Susun payload MQTT untuk uji sapuan. `step`/`Hlebar`/`Vlebar` dikirim sebagai
 * teks apa adanya (dipangkas) — firmware yang mengurai d,m,s maupun desimal,
 * dan mengonversinya di sini hanya menambah satu tempat salah bulat.
 */
export function buatPayloadSapuan(
  idLogger: string | number,
  aksi: "mulai" | "stop",
  p: PermintaanSapuan = {}
): Record<string, unknown> {
  const isi: Record<string, unknown> =
    aksi === "stop"
      ? { command: "autosearch", jenis: "stop" }
      : {
          command: "autosearch",
          jenis: "custom",
          step: String(p.step).trim(),
          Hlebar: String(p.Hlebar).trim(),
          Vlebar: String(p.Vlebar).trim(),
        };
  if (aksi === "mulai" && p.rehat !== undefined && p.rehat !== null && p.rehat !== "") {
    isi.rehat = Number(p.rehat);
  }
  return { [`set_${idLogger}`]: isi };
}

export type JenisBalasanSapuan =
  /** check / read / search / measure — masih berjalan. */
  | "tahap"
  /** Sapuan dimulai: `titik` dan langkah dalam detik busur. */
  | "mulai"
  /** Hasil tembak satu titik (atau putar ke titik itu gagal). */
  | "titik"
  /** Sapuan ditutup (ketemu / habis / dibatalkan). Hasil akhir MASIH menyusul. */
  | "akhir"
  /** Hasil akhir yang sebenarnya. Tidak ada pesan lagi sesudahnya. */
  | "hasil"
  /** Perintah ditolak atau berhenti sebelum sapuan jalan. */
  | "ditolak"
  /** Jawaban atas `jenis:"stop"`. */
  | "stop"
  | "bukan";

export type BalasanSapuan = {
  jenis: JenisBalasanSapuan;
  nilai: string;
  /** true = perintah ini sudah berakhir; tidak akan ada pesan lagi untuknya. */
  selesai: boolean;
  /** mulai, akhir: jumlah titik. */
  titik?: number;
  /** mulai: langkah dalam DETIK BUSUR. */
  langkahHaDetik?: number;
  langkahVaDetik?: number;
  /** titik, akhir: progres titik ke-n dari total. */
  tembakan?: number;
  dari?: number;
  ha?: string;
  va?: string;
  /** titik: kosong dibaca sebagai "prisma belum kena". */
  SDis?: string;
  kena?: boolean;
  rotateGagal?: boolean;
  /** akhir "ketemu": titik ke berapa prisma ditemukan. */
  titikKe?: number;
  /** hasil: ketemu atau gagal. */
  hasil?: "ketemu" | "gagal";
  HA?: string;
  VA?: string;
  rehat?: number;
  /** ditolak: pesan galat / alasan, apa adanya dari firmware. */
  pesan?: string;
  keterangan?: string;
  /** stop: apakah ada sapuan yang sedang berjalan. */
  berjalan?: boolean;
};

const NILAI_TAHAP_SAPUAN = ["check", "read", "search", "measure"];
const NILAI_AKHIR_SAPUAN = ["ketemu", "habis", "dibatalkan"];

/**
 * Baca satu paket di bawah kunci `autosearch`. Pemanggil mengoper isi kunci itu
 * (`data.autosearch`), bukan seluruh pesan.
 */
export function bacaBalasanSapuan(paket: unknown): BalasanSapuan {
  const bukan: BalasanSapuan = { jenis: "bukan", nilai: "", selesai: false };
  if (paket === null || typeof paket !== "object") return bukan;
  const o = paket as Record<string, unknown>;

  const s = (k: string) => (o[k] === undefined || o[k] === null ? undefined : String(o[k]));
  const n = (k: string) => {
    if (o[k] === undefined || o[k] === null || o[k] === "") return undefined;
    const x = Number(o[k]);
    return Number.isFinite(x) ? x : undefined;
  };
  const v = o.value ?? o.stage;
  const nilai = v === undefined || v === null ? "" : String(v);

  // Penolakan menutup PERINTAH ini. "sapuan sedang berjalan" berarti sapuan
  // LAIN yang masih jalan — pesannya akan tetap datang, tapi bukan milik
  // perintah yang baru ditolak.
  if (o.error !== undefined) {
    return {
      jenis: "ditolak",
      nilai: String(o.error),
      selesai: true,
      pesan: String(o.error),
      keterangan: s("saran") ?? s("alasan"),
    };
  }

  // `tahap` lebih dulu daripada `tembakan`: "dibatalkan" membawa keduanya.
  if (o.tahap === "sweep") {
    if (NILAI_AKHIR_SAPUAN.includes(nilai)) {
      return {
        jenis: "akhir",
        nilai,
        selesai: false,
        titik: n("titik"),
        titikKe: n("titik_ke"),
        tembakan: n("tembakan"),
        dari: n("dari"),
        ha: s("ha"),
        va: s("va"),
      };
    }
    if (nilai === "" && o.titik !== undefined) {
      return {
        jenis: "mulai",
        nilai: "sweep",
        selesai: false,
        titik: n("titik"),
        langkahHaDetik: n("langkah_ha"),
        langkahVaDetik: n("langkah_va"),
      };
    }
  }

  if (o.tembakan !== undefined) {
    const SDis = s("SDis") ?? "";
    const rotateGagal = nilai === "rotate gagal";
    return {
      jenis: "titik",
      nilai,
      selesai: false,
      tembakan: n("tembakan"),
      dari: n("dari"),
      ha: s("ha"),
      va: s("va"),
      SDis,
      rotateGagal,
      kena: !rotateGagal && SDis.trim() !== "",
    };
  }

  if (nilai === "ketemu" || nilai === "gagal") {
    return {
      jenis: "hasil",
      nilai,
      selesai: true,
      hasil: nilai,
      SDis: s("SDis"),
      HA: s("HA"),
      VA: s("VA"),
      rehat: n("rehat"),
    };
  }

  if (nilai === "stop diminta") {
    return { jenis: "stop", nilai, selesai: false, berjalan: o.berjalan !== false };
  }
  if (nilai === "tidak ada sapuan berjalan") {
    return { jenis: "stop", nilai, selesai: true, berjalan: false };
  }

  // Instrumen diam / sudut tak terbaca: perintah berakhir tanpa hasil akhir.
  if (nilai === "RTS Off" || nilai === "read failed") {
    return { jenis: "ditolak", nilai, selesai: true, pesan: nilai };
  }

  if (NILAI_TAHAP_SAPUAN.includes(nilai)) return { jenis: "tahap", nilai, selesai: false };
  // Nilai asing tetap tampil sebagai progres, bukan dibuang: firmware yang
  // lebih baru boleh menambah tahap.
  if (nilai !== "") return { jenis: "tahap", nilai, selesai: false };
  return bukan;
}

// ── Cara cari prisma per slot: `mode` (ADR_RTS_PORTING §3.1) ─────────────────
//
//   {"set_10284":{"command":"set_rts","recordTarget":{"slot":3,"name":"P3",
//                 "targetHigh":"0","mode":"as+ac"}}}
//   {"set_10284":{"command":"set_rts","targetSearch":{"slot":3,"mode":"as+ac"}}}
//   → {"targetSearch":{"slot":3,"mode":"as+ac","record":"…","value":"OK"}}
//   → {"targetSearch":{"error":"<pesan>","slot":3}}
//
// Tiga kode, dan satu slot menyimpan RANTAI sampai tiga kode yang dicoba
// berurutan: "as+ac" = AutoSearch dulu, gagal baru kembali ke sudut acuan lalu
// sapuan custom. Kosong berarti "as".
//
// Perangkap:
//
// 1. Nama di TELEMETRI beda dengan kode di PERINTAH: `rts`/`custom`/`manual`
//    lawan `as`/`ac`/`man`. Keduanya diterima saat membaca, tapi yang DIKIRIM
//    selalu kode pendek.
// 2. `targetSearch` hanya mengubah cara cari; sudut slot tidak disentuh.
//    `recordTarget` sebaliknya MEREKAM ULANG arah bidik sekarang. Mengubah mode
//    lewat `recordTarget` berarti menimpa sudut slot dengan arah teleskop
//    seadanya — jadi ubah-saja memakai `targetSearch`.
// 3. Sapuan custom (`ac`) memakai SATU set parameter global di firmware
//    (langkahHA/VA, rentangHA/VA, rehat); belum ada parameter per target.

export const KODE_MODE_CARI = ["as", "ac", "man"] as const;
export type KodeModeCari = (typeof KODE_MODE_CARI)[number];

export const MAKS_RANTAI_MODE_CARI = 3;

export const INFO_MODE_CARI: Record<KodeModeCari, { nama: string; keterangan: string }> = {
  as: { nama: "AutoSearch", keterangan: "Pencarian bawaan instrumen" },
  ac: { nama: "Custom", keterangan: "Sapuan langkah dan rentang sendiri" },
  man: { nama: "Manual", keterangan: "Langsung ukur di sudut rekaman" },
};

/** Nama yang muncul di telemetri `mode` → kode perintah. */
const ALIAS_MODE_CARI: Record<string, KodeModeCari> = {
  as: "as",
  rts: "as",
  ac: "ac",
  custom: "ac",
  man: "man",
  manual: "man",
};

/**
 * Urai rantai cara cari menjadi daftar kode. Kosong atau tidak diisi = ["as"]
 * (bawaan firmware). Mengembalikan null untuk yang tidak sah: kode tak dikenal,
 * lebih dari tiga, atau ada yang berulang.
 *
 * Ulangan ditolak: mencoba cara yang sama dua kali berturut-turut tidak
 * menambah peluang, hanya waktu. Dokumen tidak menyebut firmware menolaknya;
 * ini pagar sisi web.
 */
export function uraiModeCari(v: unknown): KodeModeCari[] | null {
  if (v === undefined || v === null) return ["as"];
  const teks = Array.isArray(v) ? v.map(String).join("+") : String(v);
  const t = teks.trim().toLowerCase();
  if (t === "") return ["as"];

  const bagian = t.split("+").map((b) => b.trim());
  if (bagian.length > MAKS_RANTAI_MODE_CARI) return null;

  const hasil: KodeModeCari[] = [];
  for (const b of bagian) {
    const kode = ALIAS_MODE_CARI[b];
    if (!kode || hasil.includes(kode)) return null;
    hasil.push(kode);
  }
  return hasil;
}

/** Bentuk yang dikirim ke perangkat dan disimpan: kode pendek dipisah '+'. */
export function formatModeCari(rantai: readonly KodeModeCari[]): string {
  return rantai.join("+");
}

/** "AutoSearch → Custom", untuk ditampilkan. */
export function labelModeCari(rantai: readonly KodeModeCari[]): string {
  return rantai.map((k) => INFO_MODE_CARI[k].nama).join(" → ");
}

export function validasiModeCari(v: unknown): string | null {
  if (uraiModeCari(v) !== null) return null;
  return `Cara cari harus berisi paling banyak ${MAKS_RANTAI_MODE_CARI} dari as, ac, man, dipisah +, tanpa ulangan`;
}

export type BalasanTargetSearch = {
  ada: boolean;
  /** true hanya bila firmware menjawab value "OK". */
  ok: boolean;
  slot: number | null;
  /** Rantai yang DIKEMBALIKAN firmware; null bila tidak ada atau tak terbaca. */
  mode: KodeModeCari[] | null;
  /** Rekaman slot (apa adanya, tidak ditafsirkan). */
  record: string;
  /** Pesan galat firmware, apa adanya. */
  galat: string | null;
};

/**
 * Baca isi kunci `targetSearch`. Mengoper isi kunci itu (`data.targetSearch`),
 * bukan seluruh pesan.
 *
 * `ok` hanya benar bila `value` bernilai "OK" dan tidak ada `error`: balasan
 * yang tidak dikenal tidak boleh dianggap sukses, karena sisi web menyimpan
 * `mode_cari` ke basis data hanya setelah konfirmasi ini.
 */
export function bacaBalasanTargetSearch(paket: unknown): BalasanTargetSearch {
  const kosong: BalasanTargetSearch = { ada: false, ok: false, slot: null, mode: null, record: "", galat: null };
  if (paket === null || typeof paket !== "object") return kosong;
  const o = paket as Record<string, unknown>;

  const slot = o.slot === undefined || o.slot === null || o.slot === "" ? null : Number(o.slot);
  const galat = o.error === undefined || o.error === null ? null : String(o.error);
  const value = o.value === undefined || o.value === null ? "" : String(o.value);
  if (galat === null && value === "" && o.mode === undefined) return kosong;

  return {
    ada: true,
    ok: galat === null && value.toUpperCase() === "OK",
    slot: slot !== null && Number.isFinite(slot) ? slot : null,
    mode: o.mode === undefined ? null : uraiModeCari(o.mode),
    record: o.record === undefined || o.record === null ? "" : String(o.record),
    galat,
  };
}

/** Susun payload `targetSearch` — ubah cara cari tanpa menyentuh sudut slot. */
export function buatPayloadTargetSearch(
  idLogger: string | number,
  slot: number,
  rantai: readonly KodeModeCari[]
): Record<string, unknown> {
  return {
    [`set_${idLogger}`]: {
      command: "set_rts",
      targetSearch: { slot, mode: formatModeCari(rantai) },
    },
  };
}

// ── Sapuan custom GLOBAL: set_rts langkahHA/VA, rentangHA/VA, rehat ──────────
//
//   {"set_10284":{"command":"set_rts","langkahHA":"0,00,01","langkahVA":"0,00,01",
//                 "rentangHA":"0,00,20","rentangVA":"0,00,20","rehat":5000}}
//   → snapshot ack {"updated":[..],"set_rts":"OK",...}
//   → atau {"error_langkahHA":"<pesan>"} per kunci yang ditolak
//
// Satu set parameter yang dipakai SEMUA target bermode `ac` di AutoTracking
// (ADR_RTS_PORTING §3.1; RANCANGAN_SAPU_PER_TARGET §1). Belum ada parameter per
// target — itu usulan yang menunggu firmware.
//
// Bedanya dengan uji sapuan (`command:"autosearch"`): di sini setelan TERSIMPAN
// di instrumen dan dipakai siklus produksi berikutnya; uji sapuan hanya sekali
// jalan dan tidak mengubah apa pun yang tersimpan.
//
// Tiap kunci berdiri sendiri, jadi boleh dikirim sebagian: kunci yang tidak
// disebut tidak berubah di instrumen. `rentang` di sini adalah jangkauan ke
// TIAP SISI (±), seperti `Hlebar`/`Vlebar` pada uji sapuan.

export const KUNCI_SAPUAN_GLOBAL = ["langkahHA", "langkahVA", "rentangHA", "rentangVA", "rehat"] as const;
export type KunciSapuanGlobal = (typeof KUNCI_SAPUAN_GLOBAL)[number];

export const LABEL_SAPUAN_GLOBAL: Record<KunciSapuanGlobal, string> = {
  langkahHA: "Langkah HA",
  langkahVA: "Langkah VA",
  rentangHA: "Rentang HA",
  rentangVA: "Rentang VA",
  rehat: "Rehat",
};

export type PermintaanSapuanGlobal = Partial<Record<KunciSapuanGlobal, unknown>>;

export type RencanaSapuanGlobal = {
  /** Hanya kunci yang diisi, persis seperti yang akan dikirim. */
  dikirim: Partial<Record<KunciSapuanGlobal, string | number>>;
  /** true = tidak ada yang diisi: tidak ada yang perlu dikirim. */
  kosong: boolean;
  /** Jumlah titik; hanya diketahui bila keempat sudut terisi. */
  titik: number | null;
  /** Batas bawah durasi per target, sama dengan uji sapuan (belum termasuk waktu ukur). */
  minimalDetik: number | null;
};

export type HasilValidasiSapuanGlobal =
  | { ok: true; rencana: RencanaSapuanGlobal }
  | { ok: false; galat: string };

const terisi = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== "";

/**
 * Periksa setelan sapuan global SEBELUM dikirim. Batasnya sama dengan uji
 * sapuan (§3.2): sudut > 0 dan ≤ 45°, rehat 0–10000 ms, maksimum 30 langkah per
 * sisi. Pesan sudut meniru firmware ("sudut lebih dari 0 dan maksimum 45
 * derajat") supaya galat dari sini dan dari alat terbaca sama.
 *
 * Isian kosong dilewati, bukan ditolak: kunci yang tidak dikirim tidak berubah
 * di instrumen.
 */
export function validasiSapuanGlobal(p: PermintaanSapuanGlobal): HasilValidasiSapuanGlobal {
  const dikirim: RencanaSapuanGlobal["dikirim"] = {};
  const derajat: Partial<Record<KunciSapuanGlobal, number>> = {};

  for (const k of ["langkahHA", "langkahVA", "rentangHA", "rentangVA"] as const) {
    if (!terisi(p[k])) continue;
    const n = uraiSudutSapuan(p[k]);
    if (n === null) {
      return { ok: false, galat: `${LABEL_SAPUAN_GLOBAL[k]}: bentuk d,m,s atau derajat desimal` };
    }
    if (n <= 0 || n > MAKS_SUDUT_SAPUAN_DERAJAT) {
      return {
        ok: false,
        galat: `${LABEL_SAPUAN_GLOBAL[k]}: sudut lebih dari 0 dan maksimum ${MAKS_SUDUT_SAPUAN_DERAJAT} derajat`,
      };
    }
    derajat[k] = n;
    dikirim[k] = String(p[k]).trim();
  }

  if (terisi(p.rehat)) {
    const r = Number(p.rehat);
    if (!Number.isInteger(r) || r < RENTANG_REHAT_SAPUAN_MS.min || r > RENTANG_REHAT_SAPUAN_MS.maks) {
      return {
        ok: false,
        galat: `Rehat: milidetik, ${RENTANG_REHAT_SAPUAN_MS.min} sampai ${RENTANG_REHAT_SAPUAN_MS.maks}`,
      };
    }
    dikirim.rehat = r;
  }

  // Batas langkah per sisi hanya bisa dihitung per sumbu yang lengkap.
  for (const [sumbu, langkah, rentang] of [
    ["HA", "langkahHA", "rentangHA"],
    ["VA", "langkahVA", "rentangVA"],
  ] as const) {
    const l = derajat[langkah];
    const r = derajat[rentang];
    if (l === undefined || r === undefined) continue;
    const n = langkahPerSisi(r, l);
    if (n > MAKS_LANGKAH_PER_SISI) {
      return {
        ok: false,
        galat: `${sumbu}: rentang/langkah = ${n}, maksimum ${MAKS_LANGKAH_PER_SISI} per sisi — perbesar langkah atau perkecil rentang`,
      };
    }
  }

  const lengkap =
    derajat.langkahHA !== undefined &&
    derajat.langkahVA !== undefined &&
    derajat.rentangHA !== undefined &&
    derajat.rentangVA !== undefined;
  const titik = lengkap
    ? (2 * langkahPerSisi(derajat.rentangHA!, derajat.langkahHA!) + 1) *
      (2 * langkahPerSisi(derajat.rentangVA!, derajat.langkahVA!) + 1)
    : null;

  return {
    ok: true,
    rencana: {
      dikirim,
      kosong: Object.keys(dikirim).length === 0,
      titik,
      minimalDetik:
        titik === null
          ? null
          : Math.ceil((titik * (MS_PUTAR_PER_TITIK_CONTOH + Number(dikirim.rehat ?? 0))) / 1000),
    },
  };
}

/** Payload `set_rts` hanya dengan kunci yang diisi. */
export function buatPayloadSapuanGlobal(
  idLogger: string | number,
  dikirim: RencanaSapuanGlobal["dikirim"]
): Record<string, unknown> {
  return { [`set_${idLogger}`]: { command: "set_rts", ...dikirim } };
}

/**
 * Cari galat per kunci sapuan global di pesan tingkat atas, mis.
 * `{"error_langkahHA":"..."}`. Mengembalikan null bila tidak ada.
 *
 * Galat ini datang TANPA array `updated`, jadi `bacaKonfirmasiConfig` tidak
 * mengenalinya — tanpa pembaca ini langkahnya menunggu sampai habis waktu
 * padahal alat sudah menolak.
 */
export function bacaGalatSapuanGlobal(data: unknown): string | null {
  if (data === null || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const galat: string[] = [];
  for (const k of KUNCI_SAPUAN_GLOBAL) {
    const v = o[`error_${k}`];
    if (v !== undefined && v !== null) galat.push(`${LABEL_SAPUAN_GLOBAL[k]}: ${String(v)}`);
  }
  return galat.length ? galat.join("; ") : null;
}
