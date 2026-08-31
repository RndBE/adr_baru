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
export function nilaiRts(paket: unknown): string | null {
  if (paket === null || typeof paket !== "object") return null;
  const o = paket as Record<string, unknown>;
  const v = o.value ?? o.stage;
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
