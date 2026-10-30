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
  bacaAutoSearch,
  MEDAN_CONFIG_TER_ECHO,
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
  BAWAAN_SEARCH_AREA_DERAJAT,
  bacaBalasanTracking,
  bacaDiagnostik,
  NAMA_DIAGNOSTIK,
  OPERASI_DIAGNOSTIK,
  ARTI_ALASAN_DIAGNOSTIK,
  bacaBalasanTilt,
  validasiTrackEvery,
  NILAI_TRACK_EVERY,
  jadwalTerlewat,
  bacaBalasanReplay,
  uraiBarisReplay,
  validasiTanggalReplay,
  keTanggalReplay,
  KOLOM_REPLAY,
  SEBAB_TOLAK_REPLAY,
  MAKS_JUMLAH_REPLAY,
  uraiSudutSapuan,
  langkahPerSisi,
  hitungTitikSapuan,
  validasiSapuan,
  buatPayloadSapuan,
  bacaBalasanSapuan,
  MAKS_LANGKAH_PER_SISI,
  uraiModeCari,
  formatModeCari,
  labelModeCari,
  validasiModeCari,
  bacaBalasanTargetSearch,
  buatPayloadTargetSearch,
  validasiSapuanGlobal,
  buatPayloadSapuanGlobal,
  bacaGalatSapuanGlobal,
  KUNCI_SAPUAN_GLOBAL,
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
periksa('"scheduled" → kemajuan', klasifikasiTracking("scheduled"), "kemajuan");

// ── Bentuk balasan AutoTracking ─────────────────────────────────────────────
//
// Kemajuan per target TIDAK punya `value` dan memakai `ke`/`dari`. Pembaca
// yang mencari `value` menjatuhkannya diam-diam: indikator berhenti di "start"
// sampai "finished" datang berpuluh menit kemudian, tanpa galat apa pun.
console.log("Bentuk balasan AutoTracking:");
const TRK_TARGET = bacaBalasanTracking({ ke: 1, dari: 50, status: "search" });
periksa("pesan per target terbaca tanpa value", TRK_TARGET.ada, true);
periksa("nilainya disintesis jadi target", TRK_TARGET.nilai, "target");
periksa("ke terbaca", TRK_TARGET.ke, 1);
periksa("dari terbaca", TRK_TARGET.dari, 50);
periksa("status terbaca", TRK_TARGET.status, "search");
periksa("per target = kemajuan", TRK_TARGET.kelas, "kemajuan");

const TRK_MULAI = bacaBalasanTracking({ value: "start" });
periksa("start terbaca", TRK_MULAI.nilai, "start");
periksa("start tanpa dari → null", TRK_MULAI.dari, null);

const TRK_SELESAI = bacaBalasanTracking({ value: "finished" });
periksa("finished → selesai", TRK_SELESAI.kelas, "selesai");
periksa("RTS Off → gagal", bacaBalasanTracking({ value: "RTS Off" }).kelas, "gagal");

// Bentuk sebelumnya harus tetap terbaca: unit yang belum di-flash masih
// mengirim current/total di dalam value "target".
const TRK_LAMA = bacaBalasanTracking({ value: "target", current: 3, total: 50, status: "measure" });
periksa("bentuk lama: ke dari current", TRK_LAMA.ke, 3);
periksa("bentuk lama: dari dari total", TRK_LAMA.dari, 50);
periksa("bentuk lama: retries", bacaBalasanTracking({ value: "start", total: 50, retries: 2 }).retries, 2);

// Paket asing tidak boleh ikut terbaca sebagai kemajuan tracking.
periksa("objek kosong → tidak ada", bacaBalasanTracking({}).ada, false);
periksa("undefined → tidak ada", bacaBalasanTracking(undefined).ada, false);
periksa("paket tak dikenal → tidak ada", bacaBalasanTracking({ foo: 1 }).ada, false);
// Target pertama bernomor 1, tapi nol tetap harus terbaca sebagai angka —
// bukan dianggap kosong oleh pemeriksaan yang memakai falsy.
periksa("ke 0 terbaca", bacaBalasanTracking({ ke: 0, dari: 50 }).ke, 0);

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
periksa("Hor batas 180 sah", validasiSearchArea(180, 90), null);
periksa("negatif ditolak", validasiSearchArea(-1, 15) !== null, true);
periksa("Hor lebih dari 180 ditolak", validasiSearchArea(181.5, 15) !== null, true);
periksa("bukan angka ditolak", validasiSearchArea("abc", 15) !== null, true);

// Batas vertikal 90, BUKAN 180. Revisi sebelumnya memakai satu rentang untuk
// keduanya, jadi nilai vertikal yang tidak akan pernah berlaku lolos ke alat.
periksa("Ver 90 sah", validasiSearchArea(15, 90), null);
periksa("Ver 91.5 ditolak", validasiSearchArea(15, 91.5) !== null, true);
periksa("Ver 180 ditolak", validasiSearchArea(15, 180) !== null, true);

// Kelipatan 1,5 derajat. Instrumen hanya menerima itu; nilai di antaranya
// tidak menghasilkan galat, cuma tidak berlaku seperti yang diminta.
for (const n of [1.5, 3, 4.5, 6, 7.5, 15]) {
  periksa(`kelipatan ${n} sah`, validasiSearchArea(n, n), null);
}
periksa("7 ditolak (bukan kelipatan 1,5)", validasiSearchArea(7, 15) !== null, true);
periksa("2 ditolak (bukan kelipatan 1,5)", validasiSearchArea(15, 2) !== null, true);
// 4.5 / 1.5 tidak bulat di aritmetika pecahan biner — pemeriksaan lewat sisa
// bagi akan menolaknya. Dikunci supaya tidak ada yang "menyederhanakannya".
periksa("4.5 lolos meski 4.5 % 1.5 tidak nol", validasiSearchArea(4.5, 4.5), null);

// Isi awal kolom harus lolos validasinya sendiri, kalau tidak formulir gagal
// sejak dibuka. Angka PowerOn (7) BUKAN kelipatan 1,5, jadi yang dipakai
// sebagai isi awal adalah bawaan firmware 15.
periksa(
  "isi awal SearchArea lolos",
  validasiSearchArea(BAWAAN_SEARCH_AREA_DERAJAT, BAWAAN_SEARCH_AREA_DERAJAT),
  null
);
periksa(
  "rentang PowerOn bukan kelipatan sah",
  validasiSearchArea(RENTANG_SETELAH_POWERON_DERAJAT, RENTANG_SETELAH_POWERON_DERAJAT) !== null,
  true
);

// ── getTilt → data_tilt ─────────────────────────────────────────────────────
console.log("getTilt (data_tilt):");
const TILT = bacaBalasanTilt({ tilt1: "-0.00732", tilt2: "0.0198" });
periksa("data_tilt terbaca", TILT.ada, true);
periksa("tilt1 apa adanya", TILT.tilt1, "-0.00732");
periksa("tilt2 apa adanya", TILT.tilt2, "0.0198");
// Nilai "0" hasil pembacaan tidak boleh hilang dianggap kosong: yang
// membedakannya dari 0 bawaan justru ada-tidaknya pesan Tilt gagal.
periksa("nol terbaca sebagai bacaan", bacaBalasanTilt({ tilt1: "0", tilt2: "0" }).ada, true);
periksa("paket kosong bukan bacaan", bacaBalasanTilt({}).ada, false);
periksa("undefined bukan bacaan", bacaBalasanTilt(undefined).ada, false);
// `Tilt` diagnostik BUKAN data_tilt — bentuknya beda dan artinya berlawanan.
periksa("balasan diagnostik bukan bacaan", bacaBalasanTilt({ value: "failed" }).ada, false);

// ── trackEvery ──────────────────────────────────────────────────────────────
console.log("trackEvery:");
for (const n of NILAI_TRACK_EVERY) {
  periksa(`${n} sah`, validasiTrackEvery(n), null);
}
periksa("0 mematikan jadwal, tetap sah", validasiTrackEvery(0), null);
periksa("7 ditolak", validasiTrackEvery(7) !== null, true);
periksa("45 ditolak", validasiTrackEvery(45) !== null, true);
periksa("pecahan ditolak", validasiTrackEvery(10.5) !== null, true);
periksa("bukan angka ditolak", validasiTrackEvery("sepuluh") !== null, true);

// Siklus yang lebih lama dari intervalnya MELEWATKAN jadwal, bukan menumpuknya.
periksa("50 target / 5 menit → terlewat", jadwalTerlewat(5, 50), true);
periksa("2 target / 60 menit → aman", jadwalTerlewat(60, 2), false);
periksa("jadwal mati tidak pernah terlewat", jadwalTerlewat(0, 50), false);
periksa("tanpa target tidak pernah terlewat", jadwalTerlewat(5, 0), false);

// ── replay ──────────────────────────────────────────────────────────────────
console.log("replay:");
const RP = bacaBalasanReplay({
  value: "data",
  tanggal: "20260903",
  rows: ["30002,2026-09-03,14:30:12,P5,151.63330"],
  cocok: 3,
  terkirim: 3,
  sisa: 0,
  lewati: 0,
});
periksa("paket data terbaca", RP.jenis, "data");
periksa("rows terbaca", RP.rows.length, 1);
periksa("cocok terbaca", RP.cocok, 3);
// sisa 0 harus terbaca sebagai angka nol, bukan null: itu penanda selesai.
periksa("sisa 0 terbaca", RP.sisa, 0);

periksa("done → selesai", bacaBalasanReplay({ value: "done" }).jenis, "selesai");
for (const n of ["bad request", "no file", "empty"]) {
  periksa(`"${n}" → ditolak`, bacaBalasanReplay({ value: n }).jenis, "ditolak");
  periksa(`"${n}" punya penjelasan`, typeof SEBAB_TOLAK_REPLAY[n], "string");
}
periksa("paket tanpa value → bukan", bacaBalasanReplay({ rows: [] }).jenis, "bukan");
periksa("undefined → bukan", bacaBalasanReplay(undefined).jenis, "bukan");

// Satu permintaan dibatasi firmware; UI memakai angka yang sama untuk
// menghitung `lewati` berikutnya.
periksa("batas jumlah 20", MAKS_JUMLAH_REPLAY, 20);

// Baris CSV — jumlah medan harus PAS. Berkas sensor lama punya cacat persis
// ini: HA-nya berisi koma, tiap baris jadi punya lebih banyak medan daripada
// headernya, dan pengurai per kolom salah baca tanpa galat.
const BARIS = "30002,2026-09-03,14:30:12,P5,151.63330,102.84806,3.2877,3.2058," +
  "1000.1,2000.2,100.3,1000.0,2000.0,100.0,1.5,0.0,-30,-0.00732,0.0198";
const URAI = uraiBarisReplay(BARIS);
periksa("baris utuh terurai", URAI !== null, true);
periksa("jumlah kolom 19", KOLOM_REPLAY.length, 19);
periksa("target terbaca", URAI?.target, "P5");
periksa("HA desimal apa adanya", URAI?.HA, "151.63330");
periksa("tilt2 kolom terakhir", URAI?.tilt2, "0.0198");
periksa("medan kurang → null", uraiBarisReplay("30002,2026-09-03"), null);
periksa("medan lebih → null", uraiBarisReplay(BARIS + ",lebih"), null);

console.log("Tanggal replay:");
periksa("20260903 sah", validasiTanggalReplay("20260903"), null);
periksa("bentuk ISO ditolak", validasiTanggalReplay("2026-09-03") !== null, true);
periksa("7 angka ditolak", validasiTanggalReplay("2026903") !== null, true);
periksa("bulan 13 ditolak", validasiTanggalReplay("20261303") !== null, true);
periksa("tanggal 32 ditolak", validasiTanggalReplay("20260932") !== null, true);
periksa("tahun 1999 ditolak", validasiTanggalReplay("19990903") !== null, true);
periksa("kosong ditolak", validasiTanggalReplay("") !== null, true);
// Input tanggal HTML memberi YYYY-MM-DD; protokol minta YYYYMMDD.
periksa("konversi dari input tanggal", keTanggalReplay("2026-09-03"), "20260903");
periksa(
  "hasil konversi lolos validasi",
  validasiTanggalReplay(keTanggalReplay("2026-09-03")),
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

// ── autoSearch — mode AutoTracking (Bagian D) ────────────────────────────────
//
// Firmware menerima tiga pasang bentuk untuk setelan yang sama. Mengirim bentuk
// yang tidak dikenal TIDAK menghasilkan galat yang terlihat — hanya balasan
// terpisah {"autoSearch":{"error":"unknown value"}} yang gampang terlewat, dan
// modenya diam-diam tidak berubah.
console.log("\nMode AutoTracking:");
periksa("true", bacaAutoSearch(true), true);
periksa("false", bacaAutoSearch(false), false);
periksa("angka 1", bacaAutoSearch(1), true);
periksa("angka 0", bacaAutoSearch(0), false);
periksa('"ON"', bacaAutoSearch("ON"), true);
periksa('"OFF"', bacaAutoSearch("OFF"), false);
periksa('"on" huruf kecil', bacaAutoSearch("on"), true);
periksa('"true" sebagai teks', bacaAutoSearch("true"), true);
periksa('"1" sebagai teks', bacaAutoSearch("1"), true);
// Yang tidak dikenal WAJIB null, bukan jatuh ke false: false adalah perintah
// mematikan penyapuan, dan salah ketik tidak boleh diam-diam jadi perintah.
periksa("nilai asing → null", bacaAutoSearch("yes"), null);
periksa("angka lain → null", bacaAutoSearch(2), null);
periksa("kosong → null", bacaAutoSearch(""), null);
periksa("undefined → null", bacaAutoSearch(undefined), null);

// "turning" hanya terbit saat autoSearch dimatikan. Tanpa terdaftar di sini,
// tahap pertama tiap target tampil sebagai kata asing di antarmuka.
periksa("STATUS_TARGET_SAH memuat turning", STATUS_TARGET_SAH.includes("turning"), true);
periksa("STATUS_TARGET_SAH memuat search", STATUS_TARGET_SAH.includes("search"), true);
// autoSearch selalu ikut snapshot ack, jadi selisihnya harus ikut dibandingkan.
periksa(
  "autoSearch termasuk medan yang echo-nya dicocokkan",
  MEDAN_CONFIG_TER_ECHO.includes("autoSearch"),
  true
);

// ── Uji sapuan custom: command "autosearch" (ADR_RTS_PORTING §3.2) ──────────
// Contoh balasan di bawah disalin dari dokumen itu.
console.log("\nUji sapuan custom (autosearch):");

// Sudut: d,m,s atau derajat desimal.
periksa('"0,30,00" → 0,5°', uraiSudutSapuan("0,30,00"), 0.5);
periksa('"1,00,00" → 1°', uraiSudutSapuan("1,00,00"), 1);
periksa('"0.5" desimal', uraiSudutSapuan("0.5"), 0.5);
periksa("angka 2", uraiSudutSapuan(2), 2);
periksa('"-1" tetap terurai (nilainya yang ditolak)', uraiSudutSapuan("-1"), -1);
periksa("menit 60 ditolak", uraiSudutSapuan("0,60,00"), null);
periksa("dua bagian ditolak", uraiSudutSapuan("1,30"), null);
periksa("huruf ditolak", uraiSudutSapuan("abc"), null);
periksa("kosong ditolak", uraiSudutSapuan(""), null);
periksa("undefined ditolak", uraiSudutSapuan(undefined), null);

// Rumus titik: contoh dokumen 0,5° step, ±1° → 5 × 5 = 25.
periksa("titik contoh dokumen = 25", hitungTitikSapuan(0.5, 1, 1), 25);
periksa("langkah per sisi 1/0.5 = 2", langkahPerSisi(1, 0.5), 2);
// Toleransi pembulatan: 0.6/0.2 = 2.9999999999999996 di float, harus tetap 3.
periksa("0.6/0.2 = 3 langkah, bukan 2", langkahPerSisi(0.6, 0.2), 3);
periksa("3/0.3 = 10 langkah", langkahPerSisi(3, 0.3), 10);
periksa("lebar < step → hanya titik tengah di sumbu itu", hitungTitikSapuan(1, 0.5, 2), 1 * 5);
periksa("maksimum 61 × 61 titik", hitungTitikSapuan(1, 30, 30), 61 * 61);

// Validasi: pesan sama dengan firmware.
const contoh = { step: "0,30,00", Hlebar: "1,00,00", Vlebar: "1,00,00", rehat: 500 };
const ok1 = validasiSapuan(contoh);
periksa("contoh dokumen lolos", ok1.ok, true);
if (ok1.ok) {
  periksa("rencana: 25 titik", ok1.rencana.titik, 25);
  periksa("rencana: rehat 500", ok1.rencana.rehat, 500);
  // 25 × (850 + 500) ms = 33,75 detik → dibulatkan naik.
  periksa("rencana: minimal 34 detik", ok1.rencana.minimalDetik, 34);
}
const tanpaRehat = validasiSapuan({ step: "0,30,00", Hlebar: "1,00,00", Vlebar: "1,00,00" });
periksa("tanpa rehat tetap lolos", tanpaRehat.ok, true);
if (tanpaRehat.ok) periksa("tanpa rehat → undefined", tanpaRehat.rencana.rehat, undefined);

periksa(
  "medan kosong → galat bentuk",
  validasiSapuan({ step: "0,30,00", Hlebar: "1,00,00" }),
  { ok: false, galat: "step, Hlebar, dan Vlebar wajib, bentuk d,m,s atau derajat desimal" }
);
periksa(
  "salah bentuk → galat bentuk",
  validasiSapuan({ step: "x", Hlebar: "1", Vlebar: "1" }),
  { ok: false, galat: "step, Hlebar, dan Vlebar wajib, bentuk d,m,s atau derajat desimal" }
);
periksa(
  "nilai 0 ditolak",
  validasiSapuan({ step: "0", Hlebar: "1", Vlebar: "1" }),
  { ok: false, galat: "nilai harus lebih dari 0 dan maksimum 45 derajat" }
);
periksa(
  "nilai negatif ditolak",
  validasiSapuan({ step: "-1", Hlebar: "1", Vlebar: "1" }),
  { ok: false, galat: "nilai harus lebih dari 0 dan maksimum 45 derajat" }
);
periksa(
  "46° ditolak",
  validasiSapuan({ step: "10", Hlebar: "46", Vlebar: "1" }),
  { ok: false, galat: "nilai harus lebih dari 0 dan maksimum 45 derajat" }
);
periksa("45° tepat lolos", validasiSapuan({ step: "45", Hlebar: "45", Vlebar: "45" }).ok, true);
periksa(
  "rehat 10001 ditolak",
  validasiSapuan({ ...contoh, rehat: 10001 }),
  { ok: false, galat: "rehat dalam milidetik, 0 sampai 10000" }
);
periksa("rehat 0 lolos", validasiSapuan({ ...contoh, rehat: 0 }).ok, true);
periksa("rehat 10000 lolos", validasiSapuan({ ...contoh, rehat: 10000 }).ok, true);
periksa("rehat pecahan ditolak", validasiSapuan({ ...contoh, rehat: 1.5 }).ok, false);
periksa("rehat negatif ditolak", validasiSapuan({ ...contoh, rehat: -1 }).ok, false);
periksa("rehat string kosong dianggap tidak dikirim", validasiSapuan({ ...contoh, rehat: "" }).ok, true);

// 30 langkah per sisi lolos, 31 ditolak.
periksa(
  `tepat ${MAKS_LANGKAH_PER_SISI} langkah per sisi lolos`,
  validasiSapuan({ step: "1", Hlebar: "30", Vlebar: "30" }).ok,
  true
);
const kebanyakan = validasiSapuan({ step: "0,0,10", Hlebar: "1,00,00", Vlebar: "1,00,00" });
periksa("360 langkah per sisi ditolak", kebanyakan.ok, false);
periksa(
  "galat langkah menyebut batasnya",
  !kebanyakan.ok && kebanyakan.galat.includes(`maksimum ${MAKS_LANGKAH_PER_SISI} per sisi`),
  true
);

// Payload.
periksa("payload mulai", buatPayloadSapuan(10284, "mulai", contoh), {
  set_10284: {
    command: "autosearch",
    jenis: "custom",
    step: "0,30,00",
    Hlebar: "1,00,00",
    Vlebar: "1,00,00",
    rehat: 500,
  },
});
periksa(
  "payload tanpa rehat tidak memuat kunci rehat",
  "rehat" in (buatPayloadSapuan("10284", "mulai", { step: "1", Hlebar: "2", Vlebar: "2" }).set_10284 as object),
  false
);
periksa("payload stop", buatPayloadSapuan(10284, "stop"), {
  set_10284: { command: "autosearch", jenis: "stop" },
});
periksa(
  "payload memangkas spasi",
  (buatPayloadSapuan(1, "mulai", { step: " 0,30,00 ", Hlebar: "1", Vlebar: "1" }).set_1 as { step: string }).step,
  "0,30,00"
);

// Balasan — urutan dokumen.
periksa('"check" → tahap', bacaBalasanSapuan({ value: "check" }), {
  jenis: "tahap", nilai: "check", selesai: false,
});
periksa('"read" → tahap', bacaBalasanSapuan({ value: "read" }).jenis, "tahap");

const mulai = bacaBalasanSapuan({
  ke: 0, dari: 0, tahap: "sweep", titik: 25, langkah_ha: 1800.0, langkah_va: 1800.0,
});
periksa("mulai sapuan", mulai, {
  jenis: "mulai", nilai: "sweep", selesai: false,
  titik: 25, langkahHaDetik: 1800, langkahVaDetik: 1800,
});

const titikBelum = bacaBalasanSapuan({ tembakan: 1, dari: 25, ha: "151,08,07", va: "102,20,53", SDis: "" });
periksa("titik: SDis kosong → belum kena", titikBelum.kena, false);
periksa("titik: progres 1/25", [titikBelum.tembakan, titikBelum.dari], [1, 25]);
periksa("titik: SDis tetap string kosong, bukan 0", titikBelum.SDis, "");
const titikKena = bacaBalasanSapuan({ tembakan: 7, dari: 25, ha: "151,08,07", va: "102,20,53", SDis: "4.1120" });
periksa("titik: SDis berisi → kena", titikKena.kena, true);
periksa("titik: tidak selesai", titikKena.selesai, false);

const rotateGagal = bacaBalasanSapuan({ tembakan: 3, dari: 25, ha: "1", va: "2", value: "rotate gagal" });
periksa("rotate gagal → titik, bukan akhir", rotateGagal.jenis, "titik");
periksa("rotate gagal → tidak dianggap kena", [rotateGagal.rotateGagal, rotateGagal.kena], [true, false]);
periksa("rotate gagal → sapuan lanjut", rotateGagal.selesai, false);

// Perangkap 1: dua "ketemu" di kunci yang sama.
const akhirKetemu = bacaBalasanSapuan({
  ke: 0, tahap: "sweep", value: "ketemu", titik_ke: 7, ha: "151,08,07", va: "102,20,53",
});
periksa("penutup sapuan 'ketemu' → akhir, BUKAN hasil", akhirKetemu.jenis, "akhir");
periksa("penutup sapuan belum selesai (hasil menyusul)", akhirKetemu.selesai, false);
periksa("penutup sapuan memuat titik_ke", akhirKetemu.titikKe, 7);
const hasilKetemu = bacaBalasanSapuan({
  jenis: "custom", rehat: 500, value: "ketemu", SDis: "4.1120", HA: "151,08,07", VA: "102,20,53",
});
periksa("hasil akhir 'ketemu' → hasil", hasilKetemu.jenis, "hasil");
periksa("hasil akhir selesai", hasilKetemu.selesai, true);
periksa("hasil akhir memuat SDis", [hasilKetemu.hasil, hasilKetemu.SDis, hasilKetemu.rehat], ["ketemu", "4.1120", 500]);

const habis = bacaBalasanSapuan({ ke: 0, tahap: "sweep", value: "habis", titik: 25 });
periksa("habis → akhir dengan jumlah titik", [habis.jenis, habis.nilai, habis.titik], ["akhir", "habis", 25]);
const hasilGagal = bacaBalasanSapuan({ jenis: "custom", rehat: 500, value: "gagal", SDis: "", HA: "x", VA: "y" });
periksa("hasil akhir 'gagal'", [hasilGagal.jenis, hasilGagal.hasil, hasilGagal.selesai], ["hasil", "gagal", true]);

// Perangkap 2: "dibatalkan" membawa tembakan/dari, tapi bukan pesan titik.
const batal = bacaBalasanSapuan({ ke: 0, tahap: "sweep", value: "dibatalkan", tembakan: 7, dari: 25 });
periksa("dibatalkan → akhir, BUKAN titik", batal.jenis, "akhir");
periksa("dibatalkan memuat progres terakhir", [batal.tembakan, batal.dari], [7, 25]);

// Stop.
periksa(
  "stop diminta",
  bacaBalasanSapuan({ value: "stop diminta", berjalan: true }),
  { jenis: "stop", nilai: "stop diminta", selesai: false, berjalan: true }
);
periksa(
  "stop tanpa sapuan berjalan",
  bacaBalasanSapuan({ value: "tidak ada sapuan berjalan", berjalan: false }),
  { jenis: "stop", nilai: "tidak ada sapuan berjalan", selesai: true, berjalan: false }
);

// Penolakan.
periksa(
  "ditolak: sibuk",
  bacaBalasanSapuan({ error: "sedang sibuk", alasan: "AutoTracking" }),
  { jenis: "ditolak", nilai: "sedang sibuk", selesai: true, pesan: "sedang sibuk", keterangan: "AutoTracking" }
);
const sapuanJalan = bacaBalasanSapuan({
  error: "sapuan sedang berjalan", saran: "kirim jenis stop untuk membatalkan",
});
periksa("ditolak: sapuan lain berjalan memuat saran", sapuanJalan.keterangan, "kirim jenis stop untuk membatalkan");
periksa("ditolak: nilai di luar batas", bacaBalasanSapuan({ error: "nilai harus lebih dari 0 dan maksimum 45 derajat" }).jenis, "ditolak");
periksa(
  "ditolak: RTS Off menutup perintah tanpa hasil akhir",
  bacaBalasanSapuan({ value: "RTS Off" }),
  { jenis: "ditolak", nilai: "RTS Off", selesai: true, pesan: "RTS Off" }
);
periksa("ditolak: read failed", [bacaBalasanSapuan({ value: "read failed" }).jenis, bacaBalasanSapuan({ value: "read failed" }).selesai], ["ditolak", true]);

// jenis rts / manual: check → search|measure → hasil.
periksa('"search" → tahap', bacaBalasanSapuan({ value: "search" }).jenis, "tahap");
periksa('"measure" → tahap', bacaBalasanSapuan({ value: "measure" }).jenis, "tahap");
const hasilRts = bacaBalasanSapuan({ jenis: "rts", value: "ketemu", SDis: "12.3" });
periksa("hasil jenis rts", [hasilRts.jenis, hasilRts.SDis, hasilRts.selesai], ["hasil", "12.3", true]);

// Bukan balasan sapuan.
periksa("null → bukan", bacaBalasanSapuan(null).jenis, "bukan");
periksa("string → bukan", bacaBalasanSapuan("check").jenis, "bukan");
periksa("objek kosong → bukan", bacaBalasanSapuan({}).jenis, "bukan");
periksa("nilai asing tetap tampil sebagai tahap", bacaBalasanSapuan({ value: "baru" }).jenis, "tahap");
// Firmware lama memakai `stage`.
periksa("kunci stage ikut terbaca", bacaBalasanSapuan({ stage: "check" }).jenis, "tahap");

// ── Cara cari per slot: `mode` (ADR_RTS_PORTING §3.1) ───────────────────────
console.log("\nCara cari per slot (mode):");

periksa('"as" → [as]', uraiModeCari("as"), ["as"]);
periksa('"as+ac" → rantai berurutan', uraiModeCari("as+ac"), ["as", "ac"]);
periksa('"ac+as" → urutan dipertahankan', uraiModeCari("ac+as"), ["ac", "as"]);
periksa('"as+ac+man" → tiga kode', uraiModeCari("as+ac+man"), ["as", "ac", "man"]);
periksa("kosong → bawaan as", uraiModeCari(""), ["as"]);
periksa("undefined → bawaan as", uraiModeCari(undefined), ["as"]);
periksa("null → bawaan as", uraiModeCari(null), ["as"]);
periksa("spasi dan huruf besar ditoleransi", uraiModeCari(" AS + Ac "), ["as", "ac"]);
periksa("nama telemetri rts/custom/manual dikenali", uraiModeCari("rts+custom+manual"), ["as", "ac", "man"]);
periksa("array diterima", uraiModeCari(["as", "ac"]), ["as", "ac"]);
periksa("kode asing → null", uraiModeCari("as+xx"), null);
periksa("kosong di tengah → null", uraiModeCari("as++ac"), null);
periksa("empat kode → null", uraiModeCari("as+ac+man+as"), null);
periksa("ulangan → null", uraiModeCari("as+as"), null);
periksa("ulangan lewat alias → null", uraiModeCari("as+rts"), null);
periksa("tanda lain → null", uraiModeCari("as,ac"), null);

periksa("format: kode pendek dipisah +", formatModeCari(["as", "ac"]), "as+ac");
periksa("format dari alias selalu kode pendek", formatModeCari(uraiModeCari("rts+custom") ?? []), "as+ac");
periksa("label", labelModeCari(["as", "ac"]), "AutoSearch → Custom");
periksa("validasi sah → null", validasiModeCari("as+ac"), null);
periksa("validasi kosong → null", validasiModeCari(""), null);
periksa("validasi salah → pesan", typeof validasiModeCari("zz"), "string");
periksa(
  "validasi menyebut batas tiga",
  (validasiModeCari("as+ac+man+as") ?? "").includes("paling banyak 3"),
  true
);

// Balasan targetSearch.
const tsOk = bacaBalasanTargetSearch({ slot: 3, mode: "as+ac", record: "P3,0,...", value: "OK" });
periksa("targetSearch OK", [tsOk.ada, tsOk.ok, tsOk.slot, tsOk.mode, tsOk.record], [true, true, 3, ["as", "ac"], "P3,0,..."]);
const tsGalat = bacaBalasanTargetSearch({ error: "slot kosong", slot: 3 });
periksa("targetSearch galat → tidak ok", [tsGalat.ada, tsGalat.ok, tsGalat.galat, tsGalat.slot], [true, false, "slot kosong", 3]);
periksa("targetSearch value selain OK → tidak ok", bacaBalasanTargetSearch({ slot: 3, mode: "as", value: "gagal" }).ok, false);
periksa("targetSearch tanpa value → tidak ok", bacaBalasanTargetSearch({ slot: 3, mode: "as" }).ok, false);
periksa("targetSearch ok dengan huruf kecil", bacaBalasanTargetSearch({ slot: 1, mode: "as", value: "ok" }).ok, true);
periksa("targetSearch mode telemetri dibaca", bacaBalasanTargetSearch({ slot: 1, mode: "custom", value: "OK" }).mode, ["ac"]);
periksa("targetSearch mode tak terbaca → null", bacaBalasanTargetSearch({ slot: 1, mode: "zz", value: "OK" }).mode, null);
periksa("targetSearch error + value OK → tidak ok", bacaBalasanTargetSearch({ error: "x", value: "OK" }).ok, false);
periksa("null → tidak ada", bacaBalasanTargetSearch(null).ada, false);
periksa("objek kosong → tidak ada", bacaBalasanTargetSearch({}).ada, false);
periksa("string → tidak ada", bacaBalasanTargetSearch("OK").ada, false);

periksa("payload targetSearch", buatPayloadTargetSearch(10284, 3, ["as", "ac"]), {
  set_10284: { command: "set_rts", targetSearch: { slot: 3, mode: "as+ac" } },
});

// ── Sapuan custom GLOBAL: set_rts langkah/rentang/rehat ──────────────────────
console.log("\nSapuan custom global (set_rts):");

const gl = validasiSapuanGlobal({
  langkahHA: "0,00,01", langkahVA: "0,00,01", rentangHA: "0,00,20", rentangVA: "0,00,20", rehat: 5000,
});
periksa("contoh lengkap lolos", gl.ok, true);
if (gl.ok) {
  periksa("titik 41 × 41 = 1681", gl.rencana.titik, 1681);
  // 1681 × (850 + 5000) ms = 9833,85 dtk → dibulatkan naik.
  periksa("minimal 9834 dtk", gl.rencana.minimalDetik, 9834);
  periksa("semua kunci terkirim apa adanya", gl.rencana.dikirim, {
    langkahHA: "0,00,01", langkahVA: "0,00,01", rentangHA: "0,00,20", rentangVA: "0,00,20", rehat: 5000,
  });
  periksa("tidak kosong", gl.rencana.kosong, false);
}
const kosongGl = validasiSapuanGlobal({ langkahHA: "", rentangHA: undefined, rehat: "  " });
periksa("semua kosong → ok tapi kosong", kosongGl.ok && kosongGl.rencana.kosong, true);
periksa("semua kosong → tidak ada yang dikirim", kosongGl.ok && Object.keys(kosongGl.rencana.dikirim).length, 0);

const sebagian = validasiSapuanGlobal({ rentangHA: "1,00,00", rehat: "300" });
periksa("sebagian lolos", sebagian.ok, true);
if (sebagian.ok) {
  periksa("sebagian: hanya yang diisi", sebagian.rencana.dikirim, { rentangHA: "1,00,00", rehat: 300 });
  periksa("sebagian: titik tidak diketahui", [sebagian.rencana.titik, sebagian.rencana.minimalDetik], [null, null]);
}

periksa(
  "sudut 0 ditolak dengan pesan firmware",
  validasiSapuanGlobal({ langkahHA: "0" }),
  { ok: false, galat: "Langkah HA: sudut lebih dari 0 dan maksimum 45 derajat" }
);
periksa(
  "46° ditolak",
  validasiSapuanGlobal({ rentangVA: "46" }),
  { ok: false, galat: "Rentang VA: sudut lebih dari 0 dan maksimum 45 derajat" }
);
periksa("45° tepat lolos", validasiSapuanGlobal({ rentangVA: "45" }).ok, true);
periksa(
  "bentuk salah",
  validasiSapuanGlobal({ langkahVA: "abc" }),
  { ok: false, galat: "Langkah VA: bentuk d,m,s atau derajat desimal" }
);
periksa("menit 60 ditolak", validasiSapuanGlobal({ langkahHA: "0,60,00" }).ok, false);
periksa(
  "rehat 10001 ditolak",
  validasiSapuanGlobal({ rehat: 10001 }),
  { ok: false, galat: "Rehat: milidetik, 0 sampai 10000" }
);
periksa("rehat pecahan ditolak", validasiSapuanGlobal({ rehat: 1.5 }).ok, false);
periksa("rehat 0 lolos", validasiSapuanGlobal({ rehat: 0 }).ok, true);
periksa("rehat 10000 lolos", validasiSapuanGlobal({ rehat: "10000" }).ok, true);

// 30 langkah per sisi dihitung per sumbu yang lengkap.
periksa("HA 30 langkah lolos", validasiSapuanGlobal({ langkahHA: "1", rentangHA: "30" }).ok, true);
const kebanyakanHa = validasiSapuanGlobal({ langkahHA: "0,00,01", rentangHA: "1,00,00" });
periksa("HA 3600 langkah ditolak", kebanyakanHa.ok, false);
periksa(
  "galat langkah menyebut sumbunya",
  !kebanyakanHa.ok && kebanyakanHa.galat.startsWith("HA: rentang/langkah = 3600"),
  true
);
periksa(
  "VA lengkap dihitung sendiri-sendiri",
  validasiSapuanGlobal({ langkahHA: "1", rentangHA: "1", langkahVA: "0,00,01", rentangVA: "1,00,00" }).ok,
  false
);
periksa(
  "langkah tanpa rentang tidak diperiksa batas langkahnya",
  validasiSapuanGlobal({ langkahHA: "0,00,01" }).ok,
  true
);

periksa("payload hanya kunci yang diisi", buatPayloadSapuanGlobal(10284, { rentangHA: "1,00,00", rehat: 300 }), {
  set_10284: { command: "set_rts", rentangHA: "1,00,00", rehat: 300 },
});
periksa("lima kunci protokol", [...KUNCI_SAPUAN_GLOBAL], ["langkahHA", "langkahVA", "rentangHA", "rentangVA", "rehat"]);

periksa(
  "galat per kunci terbaca",
  bacaGalatSapuanGlobal({ error_langkahHA: "di luar rentang" }),
  "Langkah HA: di luar rentang"
);
periksa(
  "beberapa galat digabung",
  bacaGalatSapuanGlobal({ error_rentangHA: "x", error_rehat: "y" }),
  "Rentang HA: x; Rehat: y"
);
periksa("tanpa galat → null", bacaGalatSapuanGlobal({ updated: ["rehat"], set_rts: "OK" }), null);
periksa("kunci error lain diabaikan", bacaGalatSapuanGlobal({ error_trackEvery: "x" }), null);
periksa("bukan objek → null", bacaGalatSapuanGlobal("error_rehat"), null);
periksa("null → null", bacaGalatSapuanGlobal(null), null);

console.log(`\n${gagal === 0 ? "✅" : "❌"} ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal === 0 ? 0 : 1);
