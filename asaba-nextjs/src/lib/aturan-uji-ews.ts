/**
 * Uji EWS dari website: aturan murni, dikunci oleh aturan-uji-ews.test.ts.
 *
 * Uji = operator menyalakan sirene dan lampu putar sebuah site tanpa alarm
 * sungguhan, untuk memeriksa perangkatnya. Sisi basis data dan timernya ada di
 * uji-ews.ts; berkas ini hanya memutuskan apa yang sah dan kapan boleh
 * dimatikan otomatis.
 */
import { type StatusLabel, asStatusLabel } from "@/lib/ambang";

/** Tingkat yang bisa diuji. "Normal" (level 0) bukan pilihan uji, melainkan perintah matikan. */
export const TINGKAT_UJI = ["Waspada", "Siaga", "Awas"] as const satisfies ReadonlyArray<StatusLabel>;

/** Lama sirene menyala sebelum dimatikan server, dalam detik. */
export const DURASI_UJI_PILIHAN = [10, 30, 60, 120] as const;
export const DURASI_UJI_BAWAAN = 30;
export const DURASI_UJI_MIN = 5;
export const DURASI_UJI_MAKS = 300;

export type PermintaanUji =
  | { ok: true; site: string; tingkat: StatusLabel; detik: number }
  | { ok: false; error: string };

/**
 * Memeriksa isi permintaan. `tingkat: "Normal"` berarti matikan sekarang —
 * durasinya tidak dipakai (0). Durasi kosong berarti bawaan.
 */
export function validasiUji(body: unknown): PermintaanUji {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  const site = typeof b.site === "string" ? b.site.trim() : "";
  if (!site || site.length > 50) return { ok: false, error: "Site wajib dipilih" };

  const tingkat = asStatusLabel(b.tingkat);
  if (!tingkat || (tingkat !== "Normal" && !(TINGKAT_UJI as readonly string[]).includes(tingkat))) {
    return { ok: false, error: "Tingkat uji harus Waspada, Siaga, Awas, atau Normal (matikan)" };
  }
  if (tingkat === "Normal") return { ok: true, site, tingkat, detik: 0 };

  if (b.detik === undefined || b.detik === null || b.detik === "") {
    return { ok: true, site, tingkat, detik: DURASI_UJI_BAWAAN };
  }
  const detik = Number(b.detik);
  if (!Number.isInteger(detik) || detik < DURASI_UJI_MIN || detik > DURASI_UJI_MAKS) {
    return { ok: false, error: `Durasi uji ${DURASI_UJI_MIN} sampai ${DURASI_UJI_MAKS} detik` };
  }
  return { ok: true, site, tingkat, detik };
}

/**
 * Perlukah server mematikan sirene setelah durasi uji habis?
 *
 * Hanya bila perangkat MASIH berada di level uji tadi dan tidak ada alarm
 * sungguhan. Kalau alarm sungguhan datang selagi uji berjalan, siklus RTS
 * sudah menimpa status_ews dengan tingkat aslinya — mengirim level 0 setelah
 * itu akan membungkam alarm yang sungguhan.
 */
export function perluMatikanUji(keadaan: {
  tingkatTerkirim: string | null | undefined;
  levelUji: StatusLabel;
  adaKejadianAktif: boolean;
}): boolean {
  if (keadaan.adaKejadianAktif) return false;
  return asStatusLabel(keadaan.tingkatTerkirim) === keadaan.levelUji;
}

/** Hasil uji. "alarm-aktif": ditolak karena ada kejadian alarm sungguhan di site itu. */
export type HasilUji = "terkirim" | "gagal" | "alarm-aktif";
