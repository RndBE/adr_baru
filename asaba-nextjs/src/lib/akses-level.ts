/**
 * Level akun "geotech": tim geoteknik yang menangani alarm.
 *
 * Akun geotech boleh MELIHAT seluruh data, dan boleh Konfirmasi, Verifikasi,
 * dan Perbarui arah bidik tanpa kode akses — login pribadinya yang jadi
 * kredensial, dan namanya yang tercatat di riwayat. Semua kontrol RTS, sirene
 * uji, master data, dan pengaturan TIDAK boleh. Kode akses tetap milik operator.
 *
 * Dijaga di proxy.ts untuk setiap permintaan, karena banyak route kontrol RTS
 * hanya dijaga login dan kode akses diperiksa di halamannya saja.
 * Ditambahkan 24 Nov 2026.
 */
export const LEVEL_GEOTECH = "geotech";

/** Halaman yang tidak dibuka untuk geotech (dan disembunyikan dari menu). */
export const HALAMAN_TERLARANG_GEOTECH = [
  "/kontrol-adr",
  "/prism-config",
  "/power-rts",
  "/master-data",
  "/masterdata",
  "/pengaturan",
] as const;

/** API yang boleh mengubah sesuatu bagi geotech. Selain ini, geotech hanya GET. */
const API_UBAH_BOLEH = ["/api/kejadian-alarm/", "/api/export-excel", "/api/notifikasi"];

/** API yang bahkan GET-nya tidak untuk geotech: data akun dan kode akses. */
const API_BACA_TERLARANG = ["/api/users", "/api/kode-akses", "/api/kontrol/get-config", "/api/kontrol/get-tilt"];

function cocok(path: string, awalan: string): boolean {
  if (awalan.endsWith("/")) return path.startsWith(awalan);
  return path === awalan || path.startsWith(`${awalan}/`);
}

export function halamanTerlarangGeotech(path: string): boolean {
  return HALAMAN_TERLARANG_GEOTECH.some((p) => cocok(path, p));
}

/** True bila permintaan ini harus ditolak untuk akun geotech. */
export function geotechDitolak(path: string, metode: string): boolean {
  if (path.startsWith("/api/")) {
    if (cocok(path, "/api/auth")) return false;
    if (API_BACA_TERLARANG.some((p) => cocok(path, p))) return true;
    const baca = metode === "GET" || metode === "HEAD" || metode === "OPTIONS";
    if (baca) return false;
    return !API_UBAH_BOLEH.some((p) => cocok(path, p));
  }
  return halamanTerlarangGeotech(path);
}
