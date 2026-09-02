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
  bacaKonfirmasiConfig,
  bacaBalasanSetHome,
  klasifikasiTurningTarget,
  validasiRetries,
  validasiCycleTime,
  bacaBalasanJog,
  bacaManualHaVa,
  validasiJog,
  SEBAB_TOLAK_JOG,
  LANGKAH_JOG,
  MAKS_JOG_DERAJAT,
  RESOLUSI_JOG_DERAJAT,
  PENANDA_HAVA_GAGAL,
  bacaBalasanUkur,
  JENIS_UKUR,
  bacaBalasanSearchArea,
  validasiSearchArea,
  RENTANG_SETELAH_POWERON_DERAJAT,
  bacaDiagnostik,
  NAMA_DIAGNOSTIK,
  OPERASI_DIAGNOSTIK,
  ARTI_ALASAN_DIAGNOSTIK,
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

// ── Balasan yang mengulang nama perintah sebagai kunci dalam ───────────────
// Terlihat di lapangan 31 Agustus 2026:
//   {"setHome":{"setHome":",0,061,41,90,199,18,72;"}}
// Menyalahi aturan dasar #2 ("semua balasan RTS memakai kunci value") dan tidak
// terdaftar di Bagian E. Tabel C.1 bahkan menulis setHome tidak punya balasan.
console.log("Balasan berkunci nama perintah:");
const MENTAH_SETHOME = ",0,061,41,90,199,18,72;";
periksa(
  "setHome dibaca dari kunci senama",
  nilaiRts({ setHome: MENTAH_SETHOME }, "setHome"),
  MENTAH_SETHOME
);
// Tanpa namaKunci harus null — jangan sampai kunci sembarangan ikut terbaca
// sebagai nilai balasan di jalur lain.
periksa("tanpa namaKunci → null", nilaiRts({ setHome: MENTAH_SETHOME }), null);
// `value` tetap menang bila firmware suatu saat diseragamkan.
periksa(
  "value menang atas kunci senama",
  nilaiRts({ value: "done", setHome: MENTAH_SETHOME }, "setHome"),
  "done"
);
// String mentahnya TIDAK ditafsirkan: dikembalikan utuh, termasuk koma di awal
// dan titik koma di akhir. Formatnya tidak terdokumentasi, dan ini titik acuan
// pulang teleskop — salah tafsir tidak akan terkoreksi sendiri.
periksa("string mentah utuh, tidak dipangkas", nilaiRts({ setHome: MENTAH_SETHOME }, "setHome"), MENTAH_SETHOME);
periksa("kunci senama kosong → null", nilaiRts({ setHome: undefined }, "setHome"), null);

// ── Nilai tak dikenal aman ─────────────────────────────────────────────────
// Lebih baik indikator berputar lalu kena timeout daripada memvonis instrumen
// menyala atau mati atas dasar nilai yang tidak ada di dokumen.
console.log("Nilai tak dikenal:");
for (const n of ["", "DONE", "selesai", "unknown"]) {
  periksa(`PowerOn "${n}" → kemajuan`, klasifikasiPower("on", n), "kemajuan");
  periksa(`Tracking "${n}" → kemajuan`, klasifikasiTracking(n), "kemajuan");
}

// ── Konfirmasi setelan (RTS Config) ────────────────────────────────────────
// Payload persis dari broker, 1 September 2026.
console.log("Konfirmasi RTS Config:");

const BALASAN_CONFIG = {
  updated: ["jobName", "prismConst", "tsHigh", "locCoor", "stepRecord", "retries", "cycleTime"],
  set_rts: "OK",
  jobName: "Demo Tambang MIP",
  prismConst: "30",
  tsHigh: "10",
  locCoor: ["401320.988", "525952", "62.559"],
};
const DIKIRIM = {
  jobName: "Demo Tambang MIP",
  prismConst: "30",
  tsHigh: "10",
  locCoor: "401320.988,525952,62.559",
};

const k = bacaKonfirmasiConfig(BALASAN_CONFIG, DIKIRIM);
periksa("dikenali sebagai balasan setelan", k.cocok, true);
periksa("set_rts OK → ok", k.ok, true);
periksa("tujuh medan terbaca di `updated`", k.updated.length, 7);
periksa("locCoor (array) cocok, tidak dilaporkan beda", k.beda.length, 0);

// Pesan lain di topic yang sama TIDAK boleh dikira balasan setelan.
console.log("Pesan lain tidak salah tangkap:");
periksa("balasan PowerOn", bacaKonfirmasiConfig({ PowerOn: { value: "done" } }, DIKIRIM).cocok, false);
periksa("balasan AutoTracking", bacaKonfirmasiConfig({ AutoTracking: { value: "finished" } }, DIKIRIM).cocok, false);
// Yang paling berbahaya: payload PERINTAH yang dikirim aplikasi sendiri juga
// memuat string "set_rts" (sebagai nilai `command`). Kalau itu dipakai sebagai
// penanda, perintah sendiri akan terbaca sebagai konfirmasi.
periksa(
  "payload perintah kita sendiri",
  bacaKonfirmasiConfig({ set_30002: { command: "set_rts", jobName: "X" } }, DIKIRIM).cocok,
  false
);
periksa("updated bukan array", bacaKonfirmasiConfig({ updated: "semua", set_rts: "OK" }, DIKIRIM).cocok, false);

// ── Ketidakcocokan nilai harus tertangkap ──────────────────────────────────
// Logger bisa menjawab OK sambil menyimpan angka yang berbeda.
console.log("Nilai berbeda tertangkap:");
const bedaPrism = bacaKonfirmasiConfig({ ...BALASAN_CONFIG, prismConst: "0" }, DIKIRIM);
periksa("prismConst berbeda terdeteksi", bedaPrism.beda.length, 1);
periksa("status tetap ok walau ada beda", bedaPrism.ok, true);
periksa("beda memuat nilai kirim & terima", bedaPrism.beda[0], {
  medan: "prismConst",
  dikirim: "30",
  diterima: "0",
});
const bedaCoor = bacaKonfirmasiConfig(
  { ...BALASAN_CONFIG, locCoor: ["401320.988", "525952", "99.999"] },
  DIKIRIM
);
periksa("locCoor berbeda terdeteksi", bedaCoor.beda.length, 1);

// Medan yang TIDAK di-echo tidak boleh dilaporkan beda hanya karena absen.
periksa(
  "stepRecord/retries/cycleTime tidak dilaporkan beda",
  bacaKonfirmasiConfig(BALASAN_CONFIG, { ...DIKIRIM, retries: "1", cycleTime: "10" }).beda.length,
  0
);

// Tanpa data kiriman, pencocokan dilewati — bukan dianggap semua berbeda.
periksa("tanpa data kiriman → beda kosong", bacaKonfirmasiConfig(BALASAN_CONFIG, null).beda.length, 0);
periksa("tanpa data kiriman tetap dikenali", bacaKonfirmasiConfig(BALASAN_CONFIG, null).cocok, true);

// set_rts selain OK berarti gagal, walau `updated` terisi.
console.log("Status selain OK:");
periksa("set_rts FAIL → tidak ok", bacaKonfirmasiConfig({ ...BALASAN_CONFIG, set_rts: "FAIL" }, DIKIRIM).ok, false);
periksa("set_rts hilang → tidak ok", bacaKonfirmasiConfig({ updated: ["jobName"] }, DIKIRIM).ok, false);
periksa("set_rts huruf kecil 'ok' → ok", bacaKonfirmasiConfig({ ...BALASAN_CONFIG, set_rts: "ok" }, DIKIRIM).ok, true);

// ── setHome: penolakan TIDAK boleh terbaca sebagai tersimpan ───────────────
// Kode sebelumnya membaca `value` tanpa memilah, sehingga "RTS Off" tampil
// sebagai "Set Home tersimpan". Padahal keduanya berarti EEPROM tidak disentuh
// dan posisi home lama tetap utuh — operator dapat centang hijau untuk sesuatu
// yang tidak pernah tersimpan, di titik acuan pulang teleskop.
console.log("setHome — tahapan vs rekaman vs penolakan:");
for (const t of ["start", "check", "read"]) {
  periksa(`"${t}" → tahap`, bacaBalasanSetHome({ value: t }).jenis, "tahap");
}
periksa('"done" → selesai', bacaBalasanSetHome({ value: "done" }).jenis, "selesai");
periksa('"RTS Off" → ditolak', bacaBalasanSetHome({ value: "RTS Off" }).jenis, "ditolak");
periksa('"read failed" → ditolak', bacaBalasanSetHome({ value: "read failed" }).jenis, "ditolak");

const REKAMAN = "HOME-01,0,151,38,71,206,04,62;";
periksa("rekaman → tersimpan", bacaBalasanSetHome({ setHome: REKAMAN }).jenis, "tersimpan");
periksa("rekaman utuh, tidak dipangkas", bacaBalasanSetHome({ setHome: REKAMAN }).rekaman, REKAMAN);
// Aturan pemilahan dokumen: ADA `value` → tahapan/penolakan, TIDAK ada → rekaman.
periksa(
  "value menang atas kunci senama",
  bacaBalasanSetHome({ value: "RTS Off", setHome: REKAMAN }).jenis,
  "ditolak"
);
periksa("paket kosong → bukan", bacaBalasanSetHome({}).jenis, "bukan");
periksa("undefined → bukan", bacaBalasanSetHome(undefined).jenis, "bukan");

// ── TurningTarget: tahapan + penolakan bad target ──────────────────────────
console.log("TurningTarget:");
periksa('"start" → kemajuan', klasifikasiTurningTarget({ value: "start", target: 3 }), "kemajuan");
periksa('"rotate" → kemajuan', klasifikasiTurningTarget({ value: "rotate", target: 3 }), "kemajuan");
periksa('"done" → selesai', klasifikasiTurningTarget({ value: "done" }), "selesai");
// Bentuk angka lama dipertahankan firmware demi kompatibilitas; sebelum ini,
// HANYA bentuk inilah yang dikenali kode.
periksa("angka 1 → selesai", klasifikasiTurningTarget({ value: 1 }), "selesai");
periksa("angka 0 → gagal", klasifikasiTurningTarget({ value: 0 }), "gagal");
// Tanpa mengenali ini, nomor di luar rentang tidak mengerjakan apa pun tapi
// balasannya tetap membawa status rotasi SEBELUMNYA — terlihat berhasil.
periksa('"bad target" → gagal', klasifikasiTurningTarget({ value: "bad target", target: 99 }), "gagal");
periksa("paket kosong → bukan", klasifikasiTurningTarget({}), "bukan");

// ── Rentang setelan ────────────────────────────────────────────────────────
// Firmware menerima nilai di luar rentang TANPA penolakan lalu diam-diam
// menggantinya dengan bawaan, jadi backend yang harus menolak.
console.log("Rentang retries & cycleTime:");
periksa("retries 1 sah", validasiRetries(1), null);
periksa("retries 15 sah", validasiRetries(15), null);
periksa("retries 0 ditolak", validasiRetries(0) !== null, true);
periksa("retries 16 ditolak", validasiRetries(16) !== null, true);
periksa("retries 1.5 ditolak", validasiRetries(1.5) !== null, true);

periksa("cycleTime 1000 sah", validasiCycleTime(1000), null);
periksa("cycleTime 600000 sah", validasiCycleTime(600000), null);
periksa("cycleTime 300000 sah (5 menit)", validasiCycleTime(300000), null);
// Inilah nilai yang benar-benar tersimpan di ketiga site sebelum perbaikan.
// Terbaca sebagai 10 milidetik, jauh di bawah minimum.
periksa("cycleTime 10 DITOLAK", validasiCycleTime(10) !== null, true);
periksa("cycleTime 15 DITOLAK (bekas default route)", validasiCycleTime(15) !== null, true);
periksa("cycleTime 600001 ditolak", validasiCycleTime(600001) !== null, true);
// Pesan kesalahannya harus menyebut satuan — di situlah sumber kekeliruannya,
// karena menu serial/Bluetooth memakai detik untuk setelan yang sama.
periksa("pesan menyebut milidetik", (validasiCycleTime(10) ?? "").includes("milidetik"), true);

// ── Jog (Bagian C.5) ───────────────────────────────────────────────────────
console.log("Jog — tahapan, target, penolakan:");
for (const t of ["start", "check", "read", "rotate"]) {
  periksa(`"${t}" → tahap`, bacaBalasanJog({ value: t }).jenis, "tahap");
}
periksa('"done" → selesai', bacaBalasanJog({ value: "done" }).jenis, "selesai");

// Contoh utuh dari dokumen revisi 3. Perhatikan DUA SATUAN dalam satu balasan:
// `dari_*` desimal derajat (angka mentah instrumen), `ke_*` DMS (mengikuti
// bentuk perintah rotasi). Keduanya dibiarkan sebagai string — kalau suatu
// saat ada yang mem-parse "151.3871" dan "151,53,14" dengan cara yang sama,
// asersi ini yang menangkapnya.
const JOG_TARGET = {
  value: "target",
  dari_HA: "151.3871", dari_VA: "206.0462",
  ke_HA: "151,53,14", ke_VA: "206,02,10",
};
periksa('"target" → target', bacaBalasanJog(JOG_TARGET).jenis, "target");
periksa("titik awal desimal, apa adanya", bacaBalasanJog(JOG_TARGET).dariHA, "151.3871");
periksa("titik tujuan DMS, apa adanya", bacaBalasanJog(JOG_TARGET).keVA, "206,02,10");
// `start` kini membawa selisih yang diminta. Tidak dibaca, tapi tidak boleh
// membuatnya berhenti terbaca sebagai tahap.
periksa(
  '"start" bermedan ha/va tetap tahap',
  bacaBalasanJog({ value: "start", ha: 0.5, va: -0.01 }).jenis,
  "tahap"
);

for (const t of ["RTS Off", "read failed", "bad base", "failed"]) {
  periksa(`"${t}" → ditolak`, bacaBalasanJog({ value: t }).jenis, "ditolak");
  periksa(`"${t}" punya penjelasan`, typeof SEBAB_TOLAK_JOG[t] === "string", true);
}
// Pada "bad base", sudut awal yang dianggap ngawur ikut dikirim — harus
// terbaca supaya kelihatan APA yang salah, bukan sekadar "ditolak".
const JOG_BAD = bacaBalasanJog({ value: "bad base", HA: "395,96,07", VA: "103,31,73" });
periksa("bad base membawa HA awal", JOG_BAD.HA, "395,96,07");
periksa("bad base membawa VA awal", JOG_BAD.VA, "103,31,73");
periksa("paket kosong → bukan", bacaBalasanJog({}).jenis, "bukan");

// ── ManualHAVA ─────────────────────────────────────────────────────────────
// "000,00,00" pada KEDUANYA adalah penanda gagal, bukan sudut sungguhan.
// Kalau ditampilkan apa adanya, terbaca sebagai instrumen menghadap titik nol.
console.log("ManualHAVA:");
const HAVA_OK = bacaManualHaVa({ HA: "151,38,71", VA: "206,04,62" });
periksa("bacaan normal terbaca", HAVA_OK.ada, true);
periksa("bacaan normal bukan gagal", HAVA_OK.gagal, false);
// Detik "71" bukan salah ketik dokumen. Instrumen mengirim desimal derajat
// ("151.3871"), lalu `parseAndFormat()` di firmware memotongnya seolah menit
// dan detik. Jadi bentuknya MIRIP DMS tapi nilainya 151,3871 derajat.
// Dibiarkan apa adanya: begitu firmware diperbaiki, string yang sama berubah
// makna menjadi DMS sungguhan, dan konversi yang dipasang sekarang akan
// diam-diam menjadi salah tepat saat firmware membaik.
periksa("nilai apa adanya, tidak ditafsirkan", HAVA_OK.HA, "151,38,71");
const HAVA_GAGAL = bacaManualHaVa({ HA: PENANDA_HAVA_GAGAL, VA: PENANDA_HAVA_GAGAL });
periksa("000,00,00 pada keduanya → gagal", HAVA_GAGAL.gagal, true);
// Hanya salah satu nol bukan penanda gagal — bisa jadi sudut sungguhan.
periksa(
  "hanya HA nol → bukan gagal",
  bacaManualHaVa({ HA: PENANDA_HAVA_GAGAL, VA: "206,04,62" }).gagal,
  false
);
periksa("paket kosong → tidak ada", bacaManualHaVa({}).ada, false);

// ── Arah jog: sudut ZENIT, bukan elevasi ───────────────────────────────────
// Ini asersi terpenting di blok jog. VA zenit: 0° lurus ke atas, 90° mendatar,
// 180° lurus ke bawah. Jadi MENDONGAK berarti va NEGATIF. Salah tanda di sini
// membuat teleskop bergerak berlawanan dari yang ditekan operator — dan itu
// baru ketahuan setelah alatnya benar-benar bergerak.
console.log("Arah jog (zenit):");
const deltaJog = (arah: string, n: number) =>
  arah === "kiri" ? { ha: -n, va: 0 }
  : arah === "kanan" ? { ha: n, va: 0 }
  : arah === "atas" ? { ha: 0, va: -n }
  : { ha: 0, va: n };
periksa("atas → va negatif (mendongak)", deltaJog("atas", 1).va < 0, true);
periksa("bawah → va positif (menunduk)", deltaJog("bawah", 1).va > 0, true);
periksa("kiri → ha negatif", deltaJog("kiri", 1).ha < 0, true);
periksa("kanan → ha positif", deltaJog("kanan", 1).ha > 0, true);
periksa("atas/bawah tidak menyentuh ha", deltaJog("atas", 1).ha, 0);
periksa("kiri/kanan tidak menyentuh va", deltaJog("kiri", 1).va, 0);

// ── Validasi jog ───────────────────────────────────────────────────────────
//
// SATUANNYA DERAJAT DESIMAL sejak revisi 3, sebelumnya detik busur. Selisihnya
// 3600× dan tidak memunculkan galat apa pun kalau tertukar — instrumen tetap
// bergerak, hanya ke tempat yang sama sekali lain. Asersi di bawah menahan
// dua arah kesalahan: pecahan HARUS diterima, dan angka sebesar bekas nilai
// detik busur HARUS ditolak.
console.log("Validasi jog:");
periksa("geser normal sah", validasiJog(0.5, -0.01), null);
periksa("nol-nol ditolak", validasiJog(0, 0) !== null, true);
periksa("pecahan DITERIMA", validasiJog(1.5, 0), null);
periksa("satu detik busur diterima", validasiJog(RESOLUSI_JOG_DERAJAT, 0), null);
periksa("bukan angka ditolak", validasiJog("kiri", 0) !== null, true);

// Di bawah satu detik busur instrumen tidak bergerak sama sekali, tanpa galat
// dan tanpa balasan yang berbeda. Ditolak supaya diamnya punya sebab.
periksa("di bawah resolusi ditolak", validasiJog(0.0001, 0) !== null, true);
periksa(
  "pesannya menyebut pembulatan, bukan 'tidak ada geseran'",
  (validasiJog(0.0001, 0) ?? "").includes("dibulatkan"),
  true
);
// Satu sumbu di bawah resolusi itu WAJAR — tombol arah selalu mengirim 0 di
// sumbu yang tidak digeser. Yang ditolak hanya kalau KEDUANYA di bawah.
periksa("satu sumbu nol tetap sah", validasiJog(1, 0), null);

periksa("melebihi batas ditolak", validasiJog(MAKS_JOG_DERAJAT + 1, 0) !== null, true);
periksa("tepat di batas sah", validasiJog(MAKS_JOG_DERAJAT, 0), null);
periksa("batas berlaku juga untuk negatif", validasiJog(-MAKS_JOG_DERAJAT - 1, 0) !== null, true);
// Nilai gaya revisi 2 harus ditolak, bukan diteruskan diam-diam: 3600 yang
// dimaksudkan satu derajat kini berarti sepuluh putaran penuh.
periksa("3600 gaya lama ditolak", validasiJog(3600, 0) !== null, true);

// Preset harus semuanya lolos validasi — kalau tidak, tombolnya mengirim
// sesuatu yang pasti ditolak route.
for (const l of LANGKAH_JOG) {
  periksa(`preset ${l.label} lolos validasi`, validasiJog(l.derajat, 0), null);
}
// Preset terhalus tidak boleh jatuh di bawah resolusi instrumen — kalau ada
// yang mengecilkannya lagi, tombolnya akan terlihat mati tanpa sebab.
for (const l of LANGKAH_JOG) {
  periksa(`preset ${l.label} di atas resolusi`, l.derajat >= RESOLUSI_JOG_DERAJAT, true);
}

// ── measure_bs / measure_fs (Bagian C.2) ───────────────────────────────────
console.log("Measure — tahapan, hasil, kegagalan:");
for (const t of ["start", "measure"]) {
  periksa(`"${t}" → tahap`, bacaBalasanUkur({ value: t }).jenis, "tahap");
}
periksa('"done" → selesai', bacaBalasanUkur({ value: "done" }).jenis, "selesai");
periksa('"failed" → gagal', bacaBalasanUkur({ value: "failed" }).jenis, "gagal");

const UKUR_OK = {
  HADMS: "151,38,71", VADMS: "102,50,53", SDis: "123.456", HD: "120.3451",
};
const H = bacaBalasanUkur(UKUR_OK);
periksa("hasil dikenali", H.jenis, "hasil");
periksa("hasil tidak ditandai kosong", H.kosong, false);
periksa("HADMS apa adanya", H.HADMS, "151,38,71");
// HD hanya ada di balasan ini; payload data berkala tidak memuatnya.
periksa("HD terbaca", H.HD, "120.3451");

// ── Hasil kosong TIDAK boleh terbaca sebagai bacaan ────────────────────────
// Bentuk ini mendahului {"value":"failed"}. Di revisi lama `SDis` tetap terisi
// saat gagal, jadi kebiasaan membaca angka apa adanya menampilkan jarak yang
// tidak pernah terukur.
console.log("Hasil kosong ditandai:");
const UKUR_KOSONG = bacaBalasanUkur({ HADMS: "", VADMS: "", SDis: "", HD: "" });
periksa("semua medan kosong → ditandai kosong", UKUR_KOSONG.kosong, true);
periksa("tetap berjenis hasil", UKUR_KOSONG.jenis, "hasil");
// Satu medan terisi bukan berarti kosong — itu bacaan parsial, bukan kegagalan.
periksa(
  "satu medan terisi → bukan kosong",
  bacaBalasanUkur({ HADMS: "151,38,71", VADMS: "", SDis: "", HD: "" }).kosong,
  false
);
periksa("spasi saja dihitung kosong", bacaBalasanUkur({ HADMS: " ", VADMS: " ", SDis: " ", HD: " " }).kosong, true);

periksa("paket kosong → bukan", bacaBalasanUkur({}).jenis, "bukan");
periksa("undefined → bukan", bacaBalasanUkur(undefined).jenis, "bukan");
// `value` menang atas medan hasil: penutup "failed" tidak boleh terbaca
// sebagai bacaan hanya karena kebetulan membawa medan.
periksa(
  "value menang atas medan",
  bacaBalasanUkur({ value: "failed", HADMS: "151,38,71" }).jenis,
  "gagal"
);

// Nama balasan BS dan FS tidak tertukar.
console.log("BS dan FS terpisah:");
periksa("bs → MeasureBS", JENIS_UKUR.bs.balasan, "MeasureBS");
periksa("fs → MeasureFS", JENIS_UKUR.fs.balasan, "MeasureFS");
periksa("bs → measure_bs", JENIS_UKUR.bs.perintah, "measure_bs");
periksa("fs → measure_fs", JENIS_UKUR.fs.perintah, "measure_fs");

// ── SearchArea (Bagian D) ──────────────────────────────────────────────────
// Nama medan BERBEDA antara permintaan (Hor/Ver) dan balasan
// (horizontal/vertical). Memakai nama yang sama di kedua arah gagal DIAM-DIAM:
// permintaannya diabaikan firmware, balasannya tidak pernah terbaca.
console.log("SearchArea:");
const SA = bacaBalasanSearchArea({ horizontal: 15, vertical: 15 });
periksa("balasan terbaca", SA.ada, true);
periksa("horizontal terbaca", SA.horizontal, 15);
periksa("vertical terbaca", SA.vertical, 15);
// Nama bentuk PERMINTAAN tidak boleh terbaca sebagai balasan — kalau terbaca,
// perintah kita sendiri akan tampil sebagai konfirmasi dari perangkat.
periksa("Hor/Ver bukan balasan", bacaBalasanSearchArea({ Hor: 15, Ver: 15 }).ada, false);
periksa("paket kosong → tidak ada", bacaBalasanSearchArea({}).ada, false);
periksa("undefined → tidak ada", bacaBalasanSearchArea(undefined).ada, false);
// Bentuk yang sama juga muncul di snapshot ack konfigurasi.
periksa("nilai 0 terbaca, bukan dianggap kosong", bacaBalasanSearchArea({ horizontal: 0, vertical: 0 }).horizontal, 0);

console.log("Validasi SearchArea:");
periksa("15/15 sah", validasiSearchArea(15, 15), null);
periksa("batas 0 sah", validasiSearchArea(0, 0), null);
periksa("batas 180 sah", validasiSearchArea(180, 180), null);
periksa("negatif ditolak", validasiSearchArea(-1, 15) !== null, true);
periksa("lebih dari 180 ditolak", validasiSearchArea(15, 181) !== null, true);
periksa("bukan angka ditolak", validasiSearchArea("abc", 15) !== null, true);
// Nilai yang dipasang PowerOn harus lolos validasi — kalau tidak, kolomnya
// terisi angka yang pasti ditolak route sejak modal dibuka.
periksa(
  "rentang bawaan PowerOn lolos",
  validasiSearchArea(RENTANG_SETELAH_POWERON_DERAJAT, RENTANG_SETELAH_POWERON_DERAJAT),
  null
);

// ── Diagnostik Rotate / Idle / Tilt (Bagian F.5 & F.6) ─────────────────────
console.log("Diagnostik instrumen:");
const ROT_OK = bacaDiagnostik("Rotate", { value: "ok", ms: 1840 });
periksa("Rotate ok terbaca", ROT_OK.ok, true);
periksa("ms terbaca", ROT_OK.ms, 1840);
// Keberhasilan rotasi BARU ada di revisi ini; sebelumnya hanya kegagalan.
periksa("ok tidak membawa alasan", ROT_OK.alasan, "");

const ROT_GAGAL = bacaDiagnostik("Rotate", {
  value: "failed", reason: "no_response", ms: 3001, raw: "",
});
periksa("Rotate gagal terbaca", ROT_GAGAL.ok, false);
periksa("alasan terbaca", ROT_GAGAL.alasan, "no_response");
periksa("alasan punya penjelasan", typeof ARTI_ALASAN_DIAGNOSTIK["no_response"], "string");

// `raw` inilah yang membedakan instrumen DIAM dari instrumen MENJAWAB TAPI
// ISINYA LAIN — dua masalah dengan penanganan yang sangat berbeda. Harus utuh.
const IDLE_BAD = bacaDiagnostik("Idle", {
  value: "failed", reason: "bad_response", ms: 120, raw: "Ej 0,0,50,7.2",
});
periksa("raw utuh, tidak ditafsirkan", IDLE_BAD.raw, "Ej 0,0,50,7.2");
periksa("nama operasi ikut terbawa", IDLE_BAD.nama, "Idle");
periksa("Idle punya label operasi", typeof OPERASI_DIAGNOSTIK.Idle, "string");
// Tilt menyelamatkan tafsir data: tanpa pesan ini, sensor24/25 bernilai "0"
// terlihat sama untuk instrumen yang memang datar dan yang tidak menjawab.
periksa("Tilt punya label operasi", typeof OPERASI_DIAGNOSTIK.Tilt, "string");
periksa("ketiga nama diagnostik terdaftar", NAMA_DIAGNOSTIK.length, 3);
periksa("paket kosong → tidak ada", bacaDiagnostik("Rotate", {}).ada, false);
periksa("undefined → tidak ada", bacaDiagnostik("Rotate", undefined).ada, false);

console.log(`\n${gagal === 0 ? "✅" : "❌"} ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal === 0 ? 0 : 1);
