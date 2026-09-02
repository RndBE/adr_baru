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
  MAKS_JOG_DETIK,
  PENANDA_HAVA_GAGAL,
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

const JOG_TARGET = {
  value: "target",
  dari_HA: "151,38,11", dari_VA: "206,04,02",
  ke_HA: "151,38,41", ke_VA: "206,03,47",
};
periksa('"target" → target', bacaBalasanJog(JOG_TARGET).jenis, "target");
periksa("titik awal terbaca", bacaBalasanJog(JOG_TARGET).dariHA, "151,38,11");
periksa("titik tujuan terbaca", bacaBalasanJog(JOG_TARGET).keVA, "206,03,47");

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
periksa("atas → va negatif (mendongak)", deltaJog("atas", 60).va < 0, true);
periksa("bawah → va positif (menunduk)", deltaJog("bawah", 60).va > 0, true);
periksa("kiri → ha negatif", deltaJog("kiri", 60).ha < 0, true);
periksa("kanan → ha positif", deltaJog("kanan", 60).ha > 0, true);
periksa("atas/bawah tidak menyentuh ha", deltaJog("atas", 60).ha, 0);
periksa("kiri/kanan tidak menyentuh va", deltaJog("kiri", 60).va, 0);

// ── Validasi jog ───────────────────────────────────────────────────────────
console.log("Validasi jog:");
periksa("geser normal sah", validasiJog(30, -15), null);
periksa("nol-nol ditolak", validasiJog(0, 0) !== null, true);
periksa("pecahan ditolak", validasiJog(1.5, 0) !== null, true);
periksa("melebihi batas ditolak", validasiJog(MAKS_JOG_DETIK + 1, 0) !== null, true);
periksa("tepat di batas sah", validasiJog(MAKS_JOG_DETIK, 0), null);
periksa("batas berlaku juga untuk negatif", validasiJog(-MAKS_JOG_DETIK - 1, 0) !== null, true);
// Preset harus semuanya lolos validasi — kalau tidak, tombolnya mengirim
// sesuatu yang pasti ditolak route.
for (const l of LANGKAH_JOG) {
  periksa(`preset ${l.label} lolos validasi`, validasiJog(l.detik, 0), null);
}

console.log(`\n${gagal === 0 ? "✅" : "❌"} ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal === 0 ? 0 : 1);
