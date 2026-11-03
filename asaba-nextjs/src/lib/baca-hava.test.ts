/**
 * Keadaan bacaan HA/VA, diputar dari balasan ManualHAVA.
 * Jalankan: npx tsx src/lib/baca-hava.test.ts
 *
 * Yang dijaga:
 *
 *   1. Balasan yang datang tanpa diminta (halaman lain memicu manual_hava di
 *      topik yang sama) tidak mengubah apa pun.
 *   2. "000,00,00" adalah gagal baca, bukan sudut.
 *   3. Bacaan dikosongkan begitu instrumen bergerak.
 */
import { bacaManualHaVa } from "./protokol-rts";
import {
  keadaanBacaAwal,
  kosongkanBacaan,
  mulaiBaca,
  terapkanBacaan,
  tutupBacaTanpaJawaban,
} from "./baca-hava";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(
    `${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`
  );
}

const awal = keadaanBacaAwal();
const bacaan = bacaManualHaVa({ HA: "151,38,71", VA: "206,04,62" });
cek("bacaan tanpa diminta diabaikan", terapkanBacaan(awal, bacaan, 1).fase, "diam");

const menunggu = mulaiBaca();
cek("mulaiBaca menunggu", menunggu.fase, "menunggu");

const ada = terapkanBacaan(menunggu, bacaan, 5000);
cek("bacaan diterima apa adanya", [ada.fase, ada.HA, ada.VA, ada.waktuMs], ["ada", "151,38,71", "206,04,62", 5000]);

const gagalBaca = terapkanBacaan(menunggu, bacaManualHaVa({ HA: "000,00,00", VA: "000,00,00" }), 5000);
cek("000,00,00 = gagal, angkanya tidak ditampilkan", [gagalBaca.fase, gagalBaca.HA], ["gagal", ""]);

cek("balasan bukan ManualHAVA diabaikan", terapkanBacaan(menunggu, bacaManualHaVa(undefined), 1).fase, "menunggu");
cek("bacaan kedua menimpa yang pertama hanya saat diminta lagi", terapkanBacaan(ada, bacaManualHaVa({ HA: "1,1,1", VA: "2,2,2" }), 9).HA, "151,38,71");
cek("tanpa jawaban → gagal dengan pesan", tutupBacaTanpaJawaban(menunggu, "x"), { fase: "gagal", HA: "", VA: "", waktuMs: null, pesan: "x" });
cek("tutupBacaTanpaJawaban tidak menyentuh bacaan yang sudah ada", tutupBacaTanpaJawaban(ada, "x").fase, "ada");
cek("kosongkanBacaan", kosongkanBacaan(ada).fase, "diam");
cek("kosongkanBacaan saat diam tidak membuat objek baru", kosongkanBacaan(awal) === awal, true);

console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
