/**
 * Pemeriksaan stepRecord dari slot terisi. Jalankan: npx tsx src/lib/step-record.test.ts
 *
 * Kasus pertama adalah keadaan yang memicu fitur ini: dua prisma, satu dihapus,
 * stepRecord di logger harus turun dari 2 ke 1.
 */
import { nomorSlot, rencanaStepRecord } from "./step-record";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`);
}

cek("P1+P2, P2 dihapus → 1, berurutan", rencanaStepRecord([1]), {
  jumlah: 1, berurutan: true, kosong: [], diLuar: [],
});

// P1 yang dihapus: jumlahnya tetap 1, tapi slot yang tersisa di luar jangkauan.
cek("P1+P2, P1 dihapus → 1, slot 1 kosong, slot 2 di luar", rencanaStepRecord([2]), {
  jumlah: 1, berurutan: false, kosong: [1], diLuar: [2],
});

cek("enam prisma berurutan", rencanaStepRecord([1, 2, 3, 4, 5, 6]).jumlah, 6);
cek("urutan masukan tidak berpengaruh", rencanaStepRecord([3, 1, 2]).berurutan, true);
cek("lubang di tengah", rencanaStepRecord([1, 2, 4]), {
  jumlah: 3, berurutan: false, kosong: [3], diLuar: [4],
});
cek("kosong semua → 0", rencanaStepRecord([]), { jumlah: 0, berurutan: true, kosong: [], diLuar: [] });
cek("duplikat dan nilai tak sah diabaikan", rencanaStepRecord([1, 1, 0, -2, 2.5, 2]).jumlah, 2);

cek("nomorSlot P7", nomorSlot("P7"), 7);
cek("nomorSlot huruf kecil + spasi", nomorSlot(" p12 "), 12);
cek("nomorSlot bukan slot", nomorSlot("BS1"), null);

if (gagal) {
  console.error(`\n${gagal} pemeriksaan gagal`);
  process.exit(1);
}
console.log("\nsemua lolos");
