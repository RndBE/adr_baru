/**
 * Pemeriksaan aturan alarm suara ambang. Jalankan: npx tsx src/lib/alarm-ambang.test.ts
 */
import {
  POLA_BUNYI,
  akuiSemua,
  belumDiakui,
  rapikanDiakui,
  sintesisPola,
  terburuk,
  uraiDiakui,
  type PrismaAlarm,
  type TingkatAlarm,
} from "./alarm-ambang";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`);
}

function p(idPrisma: string, tingkat: TingkatAlarm, site = "kolam_bpp"): PrismaAlarm {
  return { site, namaSite: site, idPrisma, tingkat, nilaiMm: 100, waktu: null };
}
const id = (d: PrismaAlarm[]) => d.map((x) => `${x.idPrisma}:${x.tingkat}`);

cek("tanpa prisma di atas Normal, tidak ada tingkat terburuk", terburuk([]), null);
cek("terburuk memilih Awas", terburuk([p("P1", "Waspada"), p("P2", "Awas"), p("P3", "Siaga")]), "Awas");

const awal = [p("P1", "Waspada"), p("P2", "Siaga")];
cek("belum ada yang didengar: semua berbunyi", id(belumDiakui(awal, {})), ["P1:Waspada", "P2:Siaga"]);

const sudah = akuiSemua(awal, {});
cek("sesudah Matikan bunyi: diam", belumDiakui(awal, sudah).length, 0);

// P2 naik ke Awas: harus berbunyi lagi walau P2 sudah dimatikan saat Siaga.
const naik = [p("P1", "Waspada"), p("P2", "Awas")];
cek("kenaikan sesudah dimatikan berbunyi lagi", id(belumDiakui(naik, rapikanDiakui(sudah, naik))), ["P2:Awas"]);

// Prisma lain yang baru masuk Waspada juga berbunyi.
const tambah = [...awal, p("P5", "Waspada")];
cek("prisma baru di atas Normal berbunyi", id(belumDiakui(tambah, rapikanDiakui(sudah, tambah))), ["P5:Waspada"]);

// Sama nama prisma, site lain: bukan prisma yang sama.
const siteLain = [...awal, p("P1", "Waspada", "site_lain")];
cek("slot sama di site lain tidak ikut dimatikan", id(belumDiakui(siteLain, sudah)), ["P1:Waspada"]);

// Turun tingkat: diam, dan catatannya ikut turun.
const awasDidengar = akuiSemua([p("P2", "Awas")], {});
const turun = [p("P2", "Siaga")];
const rapiTurun = rapikanDiakui(awasDidengar, turun);
cek("turun dari Awas ke Siaga tidak berbunyi", belumDiakui(turun, rapiTurun).length, 0);
cek("catatan ikut turun ke Siaga", rapiTurun, { "kolam_bpp|P2": "Siaga" });
cek("naik lagi ke Awas sesudah turun berbunyi", id(belumDiakui([p("P2", "Awas")], rapiTurun)), ["P2:Awas"]);

// Kembali Normal: catatannya dibuang, kenaikan berikutnya berbunyi dari awal.
const rapiNormal = rapikanDiakui(sudah, [p("P2", "Siaga")]);
cek("prisma yang kembali Normal dibuang dari catatan", rapiNormal, { "kolam_bpp|P2": "Siaga" });
cek("Waspada lagi sesudah Normal berbunyi", id(belumDiakui([p("P1", "Waspada")], rapiNormal)), ["P1:Waspada"]);

cek("akuiSemua tidak menurunkan catatan yang lebih tinggi", akuiSemua([p("P2", "Siaga")], { "kolam_bpp|P2": "Awas" }), {
  "kolam_bpp|P2": "Awas",
});

cek("localStorage rusak jadi kosong", uraiDiakui("{bukan json"), {});
cek("localStorage berisi tingkat asing dibuang", uraiDiakui('{"a|P1":"Awas","a|P2":"Bahaya","a|P3":3}'), { "a|P1": "Awas" });
cek("localStorage array dibuang", uraiDiakui("[1,2]"), {});

for (const t of ["Waspada", "Siaga", "Awas"] as const) {
  const data = sintesisPola(POLA_BUNYI[t], 48000);
  let puncak = 0;
  for (const v of data) puncak = Math.max(puncak, Math.abs(v));
  cek(`pola ${t}: panjang satu periode`, data.length, Math.round(POLA_BUNYI[t].periode * 48000));
  cek(`pola ${t}: tidak terpotong (|x| <= 1)`, puncak <= 1, true);
  cek(`pola ${t}: tidak senyap`, puncak > 0.5, true);
  // Awal dan akhir putaran harus ~0 supaya sambungan loop tidak berbunyi klik.
  cek(`pola ${t}: sambungan loop senyap`, Math.abs(data[0]) < 0.01 && Math.abs(data[data.length - 1]) < 0.01, true);
}

if (gagal) {
  console.log(`\n${gagal} pemeriksaan gagal`);
  process.exit(1);
}
console.log("\nsemua lolos");
