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
 * AutoTracking: "RTS Off" (ditolak), start, target, homing, finished.
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

/** Nilai `status` yang sah pada balasan {"value":"target"}. */
export const STATUS_TARGET_SAH = ["search", "measure", "done", "failed"] as const;

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
//   {"set_30002":{"command":"set_rts","jog":{"ha":30,"va":-15}}}
//
// Satuan selisih DETIK BUSUR. 60 = satu menit busur, 3600 = satu derajat.
//
// Instrumen tidak punya perintah gerak relatif; logger mengerjakannya dalam
// tiga langkah — baca sudut sekarang, tambahkan selisih, putar ke hasilnya:
//
//   {"Jog":{"value":"start","ha":30,"va":-15}}
//   {"Jog":{"value":"check"}}
//   {"Jog":{"value":"read"}}
//   {"Jog":{"value":"target","dari_HA":…,"dari_VA":…,"ke_HA":…,"ke_VA":…}}
//   {"Jog":{"value":"rotate"}}
//   {"Jog":{"value":"done"}}
//
// Penolakan: "RTS Off", "read failed", "bad base" (+ HA/VA), "failed".

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
// sungguhan. Nilainya TIDAK ditafsirkan ke desimal: dokumen memakai bentuk
// `derajat,menit,detik` tapi contohnya sendiri memuat detik ≥ 60, jadi
// pembagiannya tidak bisa dipastikan. Ditampilkan apa adanya.

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
// Satuan detik busur. Disediakan sebagai preset supaya operator tidak perlu
// menghitung sendiri — 3600 detik busur itu satu derajat, angka yang tidak
// intuitif kalau diketik manual.
export const LANGKAH_JOG = [
  { label: '10"', detik: 10, keterangan: "sangat halus" },
  { label: "1'", detik: 60, keterangan: "halus" },
  { label: "10'", detik: 600, keterangan: "sedang" },
  { label: "1°", detik: 3600, keterangan: "kasar" },
];

/**
 * Batas satu kali geser.
 *
 * TIDAK ada di protokol — dipilih sendiri sebagai pagar salah ketik. Jog
 * dimaksudkan untuk koreksi kecil; 10° sudah jauh lebih besar dari preset
 * terkasar, dan geseran raksasa akibat typo hanya membuang waktu memutar balik.
 */
export const MAKS_JOG_DETIK = 36000;

export function validasiJog(ha: unknown, va: unknown): string | null {
  const a = Number(ha);
  const b = Number(va);
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    return "Nilai geser harus bilangan bulat (detik busur)";
  }
  if (a === 0 && b === 0) return "Tidak ada geseran yang diminta";
  if (Math.abs(a) > MAKS_JOG_DETIK || Math.abs(b) > MAKS_JOG_DETIK) {
    return `Sekali geser dibatasi ±${MAKS_JOG_DETIK} detik busur (${MAKS_JOG_DETIK / 3600}°)`;
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
 * Rentang sudut yang sah.
 *
 * Angka 0–180 dibawa dari revisi protokol SEBELUMNYA, yang menyebut SearchArea
 * bertipe number dengan rentang itu. Revisi sekarang mengubah bentuknya jadi
 * objek dan TIDAK menyebutkan ulang rentangnya. Dipertahankan karena masih
 * masuk akal secara fisik; kalau dokumen kelak menyebut angka resmi yang
 * berbeda, angka itu yang menang.
 */
export const RENTANG_SEARCH_AREA = { min: 0, maks: 180 };

export function validasiSearchArea(hor: unknown, ver: unknown): string | null {
  for (const [nama, v] of [["Horizontal", hor], ["Vertikal", ver]] as const) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < RENTANG_SEARCH_AREA.min || n > RENTANG_SEARCH_AREA.maks) {
      return `${nama} harus antara ${RENTANG_SEARCH_AREA.min} dan ${RENTANG_SEARCH_AREA.maks} derajat`;
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
export const MEDAN_CONFIG_TER_ECHO = ["jobName", "prismConst", "tsHigh", "locCoor"];

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
