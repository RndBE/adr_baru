/**
 * Batas akun geotech.
 * Jalankan: npx tsx src/lib/akses-level.test.ts
 */
import assert from "node:assert/strict";
import { geotechDitolak, halamanTerlarangGeotech } from "./akses-level";

// Tangani alarm: boleh.
for (const a of ["konfirmasi", "verifikasi", "arah-bidik"]) {
  assert.equal(geotechDitolak(`/api/kejadian-alarm/4/${a}`, "POST"), false, a);
}
assert.equal(geotechDitolak("/api/kejadian-alarm/4/arah-bidik", "GET"), false);

// Melihat data: boleh.
for (const p of ["/beranda", "/riwayat-alarm", "/hasil-pengukuran", "/analisa-gabungan", "/visualisasi-3d"]) {
  assert.equal(geotechDitolak(p, "GET"), false, p);
}
assert.equal(geotechDitolak("/api/deformasi", "GET"), false);
assert.equal(geotechDitolak("/api/alarm-ambang", "GET"), false);
assert.equal(geotechDitolak("/api/export-excel", "POST"), false);
assert.equal(geotechDitolak("/api/auth/signout", "POST"), false, "keluar tetap bisa");

// Kontrol RTS, sirene uji, master data: tidak.
for (const a of ["start", "stop", "jog", "measure", "set-home", "verify-access", "power"]) {
  assert.equal(geotechDitolak(`/api/kontrol/${a}`, "POST"), true, a);
}
assert.equal(geotechDitolak("/api/kontrol/get-config", "GET"), true, "GET yang mengirim perintah ke RTS");
assert.equal(geotechDitolak("/api/ews-uji", "POST"), true);
assert.equal(geotechDitolak("/api/prism-config", "POST"), true);
assert.equal(geotechDitolak("/api/log-kontrol/150214", "PATCH"), true, "ganti R0");
assert.equal(geotechDitolak("/api/log-kontrol/150214", "DELETE"), true);
assert.equal(geotechDitolak("/api/sites/3", "PUT"), true);
assert.equal(geotechDitolak("/api/users", "GET"), true, "daftar akun");
assert.equal(geotechDitolak("/api/kode-akses", "GET"), true);
assert.equal(geotechDitolak("/api/kejadian-alarm-palsu", "POST"), true, "awalan harus persis");

for (const p of ["/kontrol-adr", "/prism-config", "/power-rts", "/master-data", "/pengaturan"]) {
  assert.equal(halamanTerlarangGeotech(p), true, p);
}
assert.equal(halamanTerlarangGeotech("/master-data-lain"), false);

console.log("akses-level.test.ts: semua lolos");
