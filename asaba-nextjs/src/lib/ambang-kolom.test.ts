/**
 * Pemeriksaan pembacaan ambang tab Ambang Batas (Master Data).
 * Jalankan: npx tsx src/lib/ambang-kolom.test.ts
 */
import { KOLOM_AMBANG, bacaAmbang } from "./ambang-kolom";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`);
}

const SAH = {
  geser_normal_max: "35", geser_waspada_max: "80", geser_siaga_max: "150",
  laju_waspada_min: "35", laju_siaga_min: "80", laju_awas_min: "150",
};

cek("ambang sah terbaca sebagai angka", bacaAmbang(SAH).data, {
  geser_normal_max: 35, geser_waspada_max: 80, geser_siaga_max: 150,
  laju_waspada_min: 35, laju_siaga_min: 80, laju_awas_min: 150,
});
cek("desimal diterima", bacaAmbang({ ...SAH, geser_normal_max: "35.5" }).data?.geser_normal_max, 35.5);

// Kosong harus DITOLAK, tidak boleh jatuh ke bawaan 50/100/200 seperti normalizeBody().
for (const k of KOLOM_AMBANG) {
  cek(`${k} kosong ditolak`, typeof bacaAmbang({ ...SAH, [k]: "" }).error, "string");
}
cek("kolom hilang ditolak", typeof bacaAmbang({ geser_normal_max: 35 }).error, "string");
cek("bukan angka ditolak", typeof bacaAmbang({ ...SAH, geser_siaga_max: "abc" }).error, "string");

cek(
  "pergeseran tidak menaik ditolak",
  bacaAmbang({ ...SAH, geser_waspada_max: "200" }).error,
  "Ambang pergeseran harus menaik: Waspada < Siaga < Awas"
);
cek("pergeseran sama besar ditolak", typeof bacaAmbang({ ...SAH, geser_waspada_max: "35" }).error, "string");
cek(
  "kecepatan tidak menaik ditolak",
  bacaAmbang({ ...SAH, laju_awas_min: "10" }).error,
  "Ambang kecepatan harus menaik: Waspada < Siaga < Awas"
);
cek("Waspada pergeseran 0 ditolak", typeof bacaAmbang({ ...SAH, geser_normal_max: "0" }).error, "string");
cek("kecepatan negatif ditolak", typeof bacaAmbang({ ...SAH, laju_waspada_min: "-1" }).error, "string");
cek("kecepatan Waspada 0 boleh", bacaAmbang({ ...SAH, laju_waspada_min: "0" }).error, undefined);

if (gagal) {
  console.log(`\n${gagal} pemeriksaan gagal`);
  process.exit(1);
}
console.log("\nsemua lolos");
