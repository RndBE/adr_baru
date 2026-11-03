/**
 * Sudut uji sapuan dikirim sebagai derajat desimal, apa pun bentuk isiannya.
 * Jalankan: npx tsx src/lib/sudut-sapuan.test.ts
 *
 * Yang dijaga:
 *
 *   1. d,m,s dan desimal menghasilkan teks desimal bertitik di payload.
 *   2. Hasil bagi lebar/step di firmware tidak turun di bawah bilangan bulat
 *      akibat pembulatan (0,10,00 adalah 0,1666…°, bukan 0,1667°).
 *   3. Aksi stop tidak membawa sudut.
 */
import { buatPayloadSapuan, sudutSapuanKeDesimalTeks as desimal, validasiSapuan } from "./protokol-rts";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(
    `${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`
  );
}

cek("0,30,00 → 0.5", desimal("0,30,00"), "0.5");
cek("1,00,00 → 1", desimal("1,00,00"), "1");
cek("0,10,00 → 0.1666666667", desimal("0,10,00"), "0.1666666667");
cek("0,00,20", desimal("0,00,20"), "0.0055555556");
cek("0,0,1 (satu detik busur)", desimal("0,0,1"), "0.0002777778");
cek("desimal tetap desimal", desimal("0.5"), "0.5");
cek("bilangan bulat", desimal("10"), "10");
cek("45 derajat", desimal("45,00,00"), "45");
cek("spasi dipangkas", desimal(" 0,05,30 "), "0.0916666667");
cek("tidak bisa diurai → teks apa adanya", desimal("abc"), "abc");

cek(
  "payload mulai berisi desimal, rehat angka",
  buatPayloadSapuan(30002, "mulai", { step: "0,10,00", Hlebar: "0,30,00", Vlebar: "1,00,00", rehat: "5000" }),
  { set_30002: { command: "autosearch", jenis: "custom", step: "0.1666666667", Hlebar: "0.5", Vlebar: "1", rehat: 5000 } }
);
cek("payload stop tanpa sudut", buatPayloadSapuan(30002, "stop"), {
  set_30002: { command: "autosearch", jenis: "stop" },
});

// Firmware menghitung ⌊lebar/step⌋ dari angka yang KITA kirim. Dengan toleransi
// 1e-9 yang sama dengan aplikasi, tiga langkah tetap tiga.
const step = Number(desimal("0,10,00"));
const lebar = Number(desimal("0,30,00"));
cek("lebar/step dari desimal terkirim, dengan toleransi = 3", Math.floor(lebar / step + 1e-9), 3);
const r = validasiSapuan({ step: "0,10,00", Hlebar: "0,30,00", Vlebar: "0,30,00" });
cek("rencana: 7 × 7 = 49 titik", r.ok && r.rencana.titik, 49);

console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
