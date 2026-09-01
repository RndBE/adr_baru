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
