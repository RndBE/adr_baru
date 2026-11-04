/**
 * Penolakan payload yang sensornya berisi teks objek.
 * Jalankan: npx tsx src/lib/payload-sensor.test.ts
 *
 * Yang dijaga:
 *
 *   1. Payload nyata dari pengirim yang rusak (teks peta Go) ditolak.
 *   2. Payload logger asli, termasuk kolom kosong dan angka berformat ilmiah,
 *      TIDAK ikut ditolak — salah tolak berarti data asli hilang.
 *   3. Hanya kunci sensor<angka> yang diperiksa.
 */
import { sensorBerisiTeksObjek } from "./payload-sensor";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(
    `${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`
  );
}

const RUSAK = {
  id_alat: "30002",
  jam: "10:49:00",
  sensor1: "map[nama:ADR.ID_Target nilai:0 satuan:-]",
  sensor2: "map[nama:ADR.IH nilai:0 satuan:m]",
  sensor7: "map[nama:ADR.SD nilai:0 satuan:m]",
  sensor12: "map[nama:ADR.E0 nilai:9.749253947e+06 satuan:m]",
  sensor14: "0",
};
cek("payload rusak ditolak, kolom pertama dilaporkan", sensorBerisiTeksObjek(RUSAK), "sensor1");
cek("hanya satu kolom rusak tetap ditolak", sensorBerisiTeksObjek({ id_alat: "1", sensor1: "0", sensor9: "map[a:b]" }), "sensor9");
cek("spasi di depan tidak meloloskan", sensorBerisiTeksObjek({ sensor3: "  map[nama:x]" }), "sensor3");
cek("[object Object] ikut ditolak", sensorBerisiTeksObjek({ sensor4: "[object Object]" }), "sensor4");

const ASLI = {
  id_alat: "30002",
  tanggal: "2026-11-04",
  jam: "10:49:00",
  sensor1: "0",
  sensor5: "",
  sensor6: "",
  sensor7: "28.8276",
  sensor11: "464232.796",
  sensor12: "9749253.947",
  sensor13: "38.813",
  sensor14: "1",
  sensor20: "36.86",
  sn: "map-sensor-01",
};
cek("payload logger asli lolos", sensorBerisiTeksObjek(ASLI), null);
cek("angka berformat ilmiah lolos", sensorBerisiTeksObjek({ sensor12: "9.749253947e+06" }), null);
cek("kolom kosong lolos", sensorBerisiTeksObjek({ sensor5: "" }), null);
cek("kunci selain sensor<angka> tidak diperiksa", sensorBerisiTeksObjek({ sn: "map[x]", catatan: "map[y]" }), null);
cek("payload kosong lolos", sensorBerisiTeksObjek({}), null);

console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
