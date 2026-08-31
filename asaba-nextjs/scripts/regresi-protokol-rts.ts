/**
 * Uji regresi protokol balasan RTS.
 *
 * Mengunci tabel nilai di PROTOKOL_MQTT_ADR (revisi memutus kompatibilitas).
 * Alur MQTT-nya tidak bisa dijalankan tanpa perangkat, jadi bagian yang bisa
 * diuji — klasifikasi tiap nilai balasan — dikunci di sini.
 *
 * Jalankan: npx tsx scripts/regresi-protokol-rts.ts
 */
import {
  nilaiRts,
  nilaiRtsLama,
  klasifikasiPower,
  klasifikasiTracking,
  STATUS_TARGET_SAH,
} from "../src/lib/protokol-rts";

let lulus = 0;
let gagal = 0;

function periksa(judul: string, dapat: unknown, harap: unknown) {
  if (JSON.stringify(dapat) === JSON.stringify(harap)) {
    lulus++;
  } else {
    gagal++;
    console.error(`  ✗ ${judul}\n      harap : ${JSON.stringify(harap)}\n      dapat : ${JSON.stringify(dapat)}`);
  }
}

console.log("🔧 Regresi protokol balasan RTS\n");

// ── Bagian E.1: PowerOn ────────────────────────────────────────────────────
// start | ping | Success | config | done | Failed
console.log("E.1 PowerOn:");
for (const n of ["start", "ping", "Success", "config"]) {
  periksa(`PowerOn "${n}" → kemajuan`, klasifikasiPower("on", n), "kemajuan");
}
periksa('PowerOn "done" → selesai', klasifikasiPower("on", "done"), "selesai");
periksa('PowerOn "Failed" → gagal', klasifikasiPower("on", "Failed"), "gagal");

// Perangkap utama: "Success" terkirim SEBELUM urutan konfigurasi berjalan.
// Instrumen belum menerima konstanta prisma maupun koreksi atmosfer.
periksa('PowerOn "Success" BUKAN selesai', klasifikasiPower("on", "Success") === "selesai", false);
// Kode sebelum dokumen ini memakai "config" sebagai penutup — itu keliru.
periksa('PowerOn "config" BUKAN selesai', klasifikasiPower("on", "config") === "selesai", false);

// ── Bagian E.2: PowerOff ───────────────────────────────────────────────────
// start | check | home | off | Success | done | RTS Off
console.log("E.2 PowerOff:");
for (const n of ["start", "check", "home", "off", "Success"]) {
  periksa(`PowerOff "${n}" → kemajuan`, klasifikasiPower("off", n), "kemajuan");
}
periksa('PowerOff "done" → selesai', klasifikasiPower("off", "done"), "selesai");
periksa('PowerOff "RTS Off" → gagal', klasifikasiPower("off", "RTS Off"), "gagal");
// Kode lama memakai "off" sebagai penutup — padahal masih ada Success lalu done.
periksa('PowerOff "off" BUKAN selesai', klasifikasiPower("off", "off") === "selesai", false);

// Nilai gagal tidak tertukar antar aksi: "Failed" milik PowerOn, "RTS Off"
// milik PowerOff.
console.log("Nilai gagal tidak tertukar antar aksi:");
periksa('PowerOff "Failed" bukan gagal', klasifikasiPower("off", "Failed"), "kemajuan");
periksa('PowerOn "RTS Off" bukan gagal', klasifikasiPower("on", "RTS Off"), "kemajuan");

// ── Bagian E.3: AutoTracking ───────────────────────────────────────────────
console.log("E.3 AutoTracking:");
periksa('"finished" → selesai', klasifikasiTracking("finished"), "selesai");
periksa('"RTS Off" → gagal', klasifikasiTracking("RTS Off"), "gagal");
for (const n of ["start", "target", "homing"]) {
  periksa(`"${n}" → kemajuan`, klasifikasiTracking(n), "kemajuan");
}

// Perangkap tingkat: "done" pada AutoTracking hanya muncul sebagai `status`
// per target, TIDAK PERNAH sebagai `value`. Kalau "done" terbaca selesai di
// tingkat ini, satu target yang beres akan menghentikan seluruh siklus.
periksa('AutoTracking "done" BUKAN selesai', klasifikasiTracking("done"), "kemajuan");
periksa("STATUS_TARGET_SAH memuat done", STATUS_TARGET_SAH.includes("done"), true);

// ── Pembacaan nilai: value / stage / nilai ─────────────────────────────────
console.log("Pembacaan nilai:");
periksa('{"value":"done"} → "done"', nilaiRts({ value: "done" }), "done");
periksa('{"stage":"ping"} → "ping" (revisi peralihan)', nilaiRts({ stage: "ping" }), "ping");
periksa("value menang atas stage", nilaiRts({ value: "done", stage: "ping" }), "done");
periksa('{"nilai":"Success"} → null di jalur baru', nilaiRts({ nilai: "Success" }), null);
periksa("paket kosong → null", nilaiRts({}), null);
periksa("undefined → null", nilaiRts(undefined), null);

console.log("Protokol lama terpisah:");
periksa('{"nilai":"Success"} → "Success"', nilaiRtsLama({ nilai: "Success" }), "Success");
// Paling penting: kalau protokol sekarang dipakai, jalur lama HARUS diam.
// Kalau tidak, "Success" akan dibaca dua kali dengan dua arti berlawanan —
// sekali sebagai kemajuan, sekali sebagai penutup sukses.
periksa('{"value":"Success"} → jalur lama diam', nilaiRtsLama({ value: "Success" }), null);
periksa('{"stage":"start"} → jalur lama diam', nilaiRtsLama({ stage: "start" }), null);
periksa("paket kosong → null", nilaiRtsLama({}), null);

// ── Nilai tak dikenal aman ─────────────────────────────────────────────────
// Lebih baik indikator berputar lalu kena timeout daripada memvonis instrumen
// menyala atau mati atas dasar nilai yang tidak ada di dokumen.
console.log("Nilai tak dikenal:");
for (const n of ["", "DONE", "selesai", "unknown"]) {
  periksa(`PowerOn "${n}" → kemajuan`, klasifikasiPower("on", n), "kemajuan");
  periksa(`Tracking "${n}" → kemajuan`, klasifikasiTracking(n), "kemajuan");
}

console.log(`\n${gagal === 0 ? "✅" : "❌"} ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal === 0 ? 0 : 1);
