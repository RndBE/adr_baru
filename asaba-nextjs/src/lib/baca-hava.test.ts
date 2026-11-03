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
  FORMAT_STRING_HAVA,
  keadaanBacaAwal,
  kosongkanBacaan,
  mulaiBaca,
  terapkanBacaan,
  tutupBacaTanpaJawaban,
  ubahSudutHaVa,
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

// ── Desimal dan d,m,s ───────────────────────────────────────────────────────
cek("format yang diasumsikan firmware sekarang", FORMAT_STRING_HAVA, "desimal-terpotong");
cek("HA 208,21,20 → 208,2120°", ubahSudutHaVa("208,21,20"), { derajat: 208.212, desimalTeks: "208.2120", dmsTeks: "208° 12′ 43.2″" });
cek("VA 098,93,37 (menit 93 = bukti desimal)", ubahSudutHaVa("098,93,37"), { derajat: 98.9337, desimalTeks: "98.9337", dmsTeks: "98° 56′ 01.3″" });
cek("contoh dokumen 151,38,71", ubahSudutHaVa("151,38,71")?.desimalTeks, "151.3871");
cek("nol di depan dan kosong", ubahSudutHaVa("000,00,00"), { derajat: 0, desimalTeks: "0.0000", dmsTeks: "0° 00′ 00.0″" });
cek("tepi atas 10,9999° dibulatkan ke 0,1″ tanpa 60", ubahSudutHaVa("010,99,99")?.dmsTeks, "10° 59′ 59.6″");
cek("bukan tiga kelompok → null", ubahSudutHaVa("208.2120"), null);
cek("bukan angka → null", ubahSudutHaVa("a,b,c"), null);
cek("kosong → null", ubahSudutHaVa(""), null);

console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
