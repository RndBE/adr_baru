/**
 * Aturan interval Analisa Gabungan.
 * Jalankan: npx tsx src/lib/interval-gabungan.test.ts
 *
 * Yang dijaga di sini cuma dua janji, tapi keduanya mudah dilanggar tanpa
 * ketahuan di layar:
 *
 *   1. Pilihan yang disebut operator SELALU dituruti. Kalau rentang panjang
 *      diam-diam menaikkan "Data mentah" jadi rata-rata per jam, tombolnya
 *      tetap menyala "Data mentah" dan tidak ada yang memberi tahu bahwa
 *      angkanya sudah dirata-rata.
 *   2. Parameter yang tidak dikenali ditolak, bukan dijatuhkan ke "auto" —
 *      alasan yang sama.
 */
import {
  AUTO_HARI,
  AUTO_JAM,
  bacaInterval,
  FORMAT_STEMPEL,
  INTERVAL,
  KETERANGAN_RAPAT,
  LABEL_INTERVAL,
  resolusiInterval,
} from "./interval-gabungan";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`);
}

// ── Membaca parameter ───────────────────────────────────────────────────────
{
  cek("tanpa parameter jatuh ke auto", bacaInterval(null), "auto");
  cek("parameter kosong jatuh ke auto", bacaInterval(""), "auto");
  cek("mentah dikenali", bacaInterval("mentah"), "mentah");
  cek("jam dikenali", bacaInterval("jam"), "jam");
  cek("hari dikenali", bacaInterval("hari"), "hari");
  cek("salah eja DITOLAK, bukan jadi auto", bacaInterval("harian"), null);
  cek("huruf besar ditolak", bacaInterval("Jam"), null);
}

// ── Mode otomatis ───────────────────────────────────────────────────────────
{
  cek("auto, beberapa jam: mentah", resolusiInterval("auto", 0.25), "mentah");
  cek(`auto, tepat ${AUTO_JAM} hari: masih mentah`, resolusiInterval("auto", AUTO_JAM), "mentah");
  cek("auto, sedikit lewat: per jam", resolusiInterval("auto", AUTO_JAM + 0.01), "jam");
  cek("auto, sebulan: per jam", resolusiInterval("auto", 30), "jam");
  cek(`auto, tepat ${AUTO_HARI} hari: masih per jam`, resolusiInterval("auto", AUTO_HARI), "jam");
  // Tanpa tangga ketiga ini, rentang setahun meminta ~8.800 titik per prisma
  // dan terpotong di batas baris — grafiknya berakhir di tengah rentang.
  cek("auto, setahun: per hari", resolusiInterval("auto", 365), "hari");
}

// ── Pilihan operator tidak pernah ditimpa ───────────────────────────────────
{
  cek("mentah setahun tetap mentah", resolusiInterval("mentah", 365), "mentah");
  cek("per jam sejam tetap per jam", resolusiInterval("jam", 0.04), "jam");
  cek("per hari sejam tetap per hari", resolusiInterval("hari", 0.04), "hari");
}

// ── Stempel ember ───────────────────────────────────────────────────────────
{
  // Seluruh prisma pada satu ember HARUS berbagi stempel yang persis sama,
  // karena seriGabungan() menyatukan mereka jadi satu baris grafik lewat
  // jarak antar stempel. Satu saja bagian yang masih berubah di dalam ember
  // (menit pada mode jam, jam pada mode hari) memecah satu running jadi
  // banyak baris yang semuanya "tidak lengkap".
  cek("ember jam tidak menyisakan menit", /%i|%s/.test(FORMAT_STEMPEL.jam), false);
  cek("ember hari tidak menyisakan jam", /%H|%i|%s/.test(FORMAT_STEMPEL.hari), false);
  cek("mode mentah menyimpan detik", FORMAT_STEMPEL.mentah.includes("%s"), true);
  // Tiga-tiganya tetap DATETIME lengkap: Date.parse di klien (keMs) menolak
  // stempel yang cuma tanggal.
  for (const k of ["mentah", "jam", "hari"] as const) {
    cek(
      `stempel ${k} tetap berbentuk tanggal + jam`,
      /^%Y-%m-%d .+:.+:.+$/.test(FORMAT_STEMPEL[k]),
      true
    );
  }
}

// ── Setiap pilihan punya kata-katanya ───────────────────────────────────────
{
  cek("semua pilihan punya label", INTERVAL.every((i) => !!LABEL_INTERVAL[i]), true);
  cek(
    "tiga mode nyata punya keterangan",
    (["mentah", "jam", "hari"] as const).every((i) => !!KETERANGAN_RAPAT[i]),
    true
  );
}

console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
