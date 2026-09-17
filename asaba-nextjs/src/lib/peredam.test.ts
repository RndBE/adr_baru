/**
 * Pemeriksaan peredam peringatan. Jalankan: npx tsx src/lib/peredam.test.ts
 *
 * Kasus pertama di bawah bukan kasus karangan: ia meniru jendela nyata dari
 * tabel `log_siaga` di basis data ini — 15 Juni 2024, 11.42 sampai 11.53, enam
 * perubahan status beruntun sementara nilai terukurnya nyaris tidak bergerak.
 * Kalau peredam ini benar, jendela seperti itu tidak menghasilkan satu pun pesan.
 */
import { type AmbangSite } from "./ambang";
import {
  KEBIJAKAN_BAWAAN,
  keadaanAwal,
  nilaiPeredam,
  tingkatEfektif,
  type KeadaanPrisma,
} from "./peredam";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`);
}

/** Ambang bawaan t_site: Normal <50, Waspada 50–100, Siaga 100–200, Awas >=200. */
const AMBANG: AmbangSite = {
  geser: { normalMax: 50, waspadaMax: 100, siagaMax: 200 },
  laju: { waspadaMin: 40, siagaMin: 80, awasMin: 120 },
};

const MENIT = 60_000;

/**
 * Bawaan `konfirmasiSiklus` turun ke 1 pada 17 September 2026 — tiap perubahan
 * tingkat langsung dikabarkan. Uji di bawah yang memang menguji MEKANISME
 * "harus terlihat N siklus beruntun" karena itu menyebut angkanya tegas: yang
 * dijaga adalah logikanya, bukan nilai bawaan yang boleh berubah sewaktu-waktu
 * mengikuti kebutuhan lapangan.
 */
const KONFIRMASI_3 = { konfirmasiSiklus: 3 } as const;

/** Jalankan deret bacaan, kembalikan jumlah pesan dan urutan alasannya. */
function jalankan(
  bacaan: Array<{ mm: number; menit: number }>,
  kebijakan?: Parameters<typeof nilaiPeredam>[0]["kebijakan"],
  awal: KeadaanPrisma = keadaanAwal()
) {
  let keadaan = awal;
  const pesan: Array<{ dari: string; ke: string; menit: number }> = [];
  const alasan: string[] = [];
  for (const b of bacaan) {
    const h = nilaiPeredam({
      keadaan,
      nilaiMm: b.mm,
      ambang: AMBANG,
      sekarangMs: b.menit * MENIT,
      kebijakan,
    });
    keadaan = h.keadaan;
    alasan.push(h.alasan ?? "KIRIM");
    if (h.kirim && h.diakui) pesan.push({ ...h.diakui, menit: b.menit });
  }
  return { pesan, alasan, keadaan };
}

// ── Kasus nyata: jendela sebelas menit di log_siaga ───────────────────────────
//
// Pola aslinya Aman → Siaga 2 → Siaga 3 → Aman → Siaga 1 → Aman dalam 11 menit.
// Di sini dipetakan ke ambang pergeseran: tiap bacaan melompat ke tingkat lain
// dan tidak ada satu pun yang bertahan tiga siklus beruntun.
{
  const { pesan } = jalankan([
    { mm: 49, menit: 0 },   // Normal
    { mm: 105, menit: 3 },  // Siaga
    { mm: 51, menit: 6 },   // Waspada
    { mm: 48, menit: 7 },   // Normal
    { mm: 205, menit: 9 },  // Awas
    { mm: 49, menit: 11 },  // Normal
  ], KONFIRMASI_3);
  cek("jendela 11 menit yang berkedip -> tidak ada pesan", pesan.length, 0);
}

// ── Eskalasi sungguhan: bertahan tiga siklus ─────────────────────────────────
{
  const { pesan, alasan } = jalankan([
    { mm: 120, menit: 0 },
    { mm: 125, menit: 15 },
    { mm: 130, menit: 30 },
  ], KONFIRMASI_3);
  cek("tiga siklus beruntun -> satu pesan", pesan, [{ dari: "Normal", ke: "Siaga", menit: 30 }]);
  cek("dua siklus pertama menunggu konfirmasi", alasan.slice(0, 2), ["belum-konfirmasi", "belum-konfirmasi"]);
}

// ── Konfirmasi harus BERUNTUN ────────────────────────────────────────────────
{
  const { pesan } = jalankan([
    { mm: 120, menit: 0 },  // calon Siaga (1)
    { mm: 120, menit: 15 }, // calon Siaga (2)
    { mm: 30, menit: 30 },  // Normal — calon batal
    { mm: 120, menit: 45 }, // calon Siaga mulai dari 1 lagi
    { mm: 120, menit: 60 }, // (2)
  ], KONFIRMASI_3);
  cek("selingan memutus hitungan -> belum ada pesan", pesan.length, 0);
}

// ── Waspada IKUT dikirim sejak 17 September 2026 ─────────────────────────────
//
// Bawaannya dulu "Siaga", dan uji ini dulu menegaskan Waspada TIDAK dikirim.
// Keputusan operasional mengubahnya: yang ingin diketahui adalah saat keadaan
// mulai meninggalkan Normal, bukan cuma saat sudah gawat.
{
  const { pesan, alasan, keadaan } = jalankan([
    { mm: 60, menit: 0 },
    { mm: 62, menit: 15 },
    { mm: 61, menit: 30 },
  ], KONFIRMASI_3);
  cek("Waspada dikirim", pesan.length, 1);
  cek("tingkatnya diakui", keadaan.tingkat, "Waspada");
  cek("tidak ada alasan diam pada siklus ketiga", alasan[2], "KIRIM");
}

// Jalur "di-bawah-ambang-kirim" tetap ada dan tetap diuji — sekarang lewat
// kebijakan yang disetel tegas, supaya perilakunya tidak hilang dari jaring
// pengaman hanya karena bawaannya berubah.
{
  const { pesan, alasan, keadaan } = jalankan(
    [
      { mm: 60, menit: 0 },
      { mm: 62, menit: 15 },
      { mm: 61, menit: 30 },
    ],
    { ...KONFIRMASI_3, kirimMulaiDari: "Siaga" }
  );
  cek("dengan ambang Siaga: Waspada didiamkan", pesan.length, 0);
  cek("dengan ambang Siaga: tingkat tetap diakui", keadaan.tingkat, "Waspada");
  cek("dengan ambang Siaga: alasannya jelas", alasan[2], "di-bawah-ambang-kirim");
}

// Pulih ikut melebar: kembali ke Normal dari Waspada kini dikabarkan, karena
// `pulih` diukur terhadap ambang kirim yang sama.
{
  const { pesan } = jalankan([
    { mm: 60, menit: 0 },
    { mm: 62, menit: 15 },
    { mm: 61, menit: 30 },
    { mm: 10, menit: 90 },
    { mm: 11, menit: 105 },
    { mm: 12, menit: 120 },
  ], KONFIRMASI_3);
  cek("naik ke Waspada lalu pulih ke Normal: dua pesan", pesan.length, 2);
  cek("pesan kedua adalah pulih", pesan[1] && `${pesan[1].dari}->${pesan[1].ke}`, "Waspada->Normal");
}

// ── Jeda menahan pesan kedua ─────────────────────────────────────────────────
{
  const { pesan, alasan } = jalankan([
    { mm: 120, menit: 0 },
    { mm: 125, menit: 5 },
    { mm: 130, menit: 10 },  // KIRIM: Normal -> Siaga
    { mm: 210, menit: 15 },
    { mm: 215, menit: 20 },
    { mm: 220, menit: 25 },  // terkonfirmasi Awas, tapi baru 15 menit sejak kirim
  ], KONFIRMASI_3);
  cek("kenaikan kedua tertahan jeda 30 menit", pesan.length, 1);
  cek("alasannya jeda, bukan yang lain", alasan[5], "dalam-jeda");
}

// ── Awas tetap berangkat setelah jeda lewat ──────────────────────────────────
{
  const { pesan } = jalankan([
    { mm: 120, menit: 0 },
    { mm: 125, menit: 5 },
    { mm: 130, menit: 10 },  // KIRIM Siaga
    { mm: 210, menit: 45 },
    { mm: 215, menit: 50 },
    { mm: 220, menit: 55 },  // KIRIM Awas — 45 menit sejak pesan terakhir
  ], KONFIRMASI_3);
  cek("setelah jeda lewat, Awas berangkat", pesan.map((p) => p.ke), ["Siaga", "Awas"]);
}

// ── Pesan pulih: kembali ke Normal, dan TIDAK kena jeda ──────────────────────
{
  const awal: KeadaanPrisma = {
    tingkat: "Siaga",
    tingkatCalon: null,
    hitungCalon: 0,
    kirimTerakhirMs: 0, // baru saja mengirim
  };
  const { pesan } = jalankan(
    [
      { mm: 10, menit: 1 },
      { mm: 10, menit: 2 },
      { mm: 10, menit: 3 },
    ],
    KONFIRMASI_3,
    awal
  );
  cek("pulih ke Normal dikirim walau masih dalam jeda", pesan, [
    { dari: "Siaga", ke: "Normal", menit: 3 },
  ]);
}

// ── Turun tapi belum pulih penuh: dicatat, tidak dikirim ─────────────────────
{
  const awal: KeadaanPrisma = {
    tingkat: "Awas", tingkatCalon: null, hitungCalon: 0, kirimTerakhirMs: null,
  };
  const { pesan, alasan, keadaan } = jalankan(
    [{ mm: 120, menit: 0 }, { mm: 120, menit: 15 }, { mm: 120, menit: 30 }],
    KONFIRMASI_3,
    awal
  );
  cek("Awas -> Siaga tidak dikirim", pesan.length, 0);
  cek("tapi diakui turun", keadaan.tingkat, "Siaga");
  cek("alasannya bukan-kenaikan", alasan[2], "bukan-kenaikan");
}

// ── Histeresis: menggantung persis di ambang ─────────────────────────────────
//
// Batas masuk Siaga = 100. Dengan rasio 0,1 penurunan baru diakui di bawah 90.
cek("99 mm dari Siaga: masih ditahan", tingkatEfektif(99, AMBANG, "Siaga", 0.1), "Siaga");
cek("95 mm dari Siaga: masih ditahan", tingkatEfektif(95, AMBANG, "Siaga", 0.1), "Siaga");
cek("89 mm dari Siaga: penurunan diakui", tingkatEfektif(89, AMBANG, "Siaga", 0.1), "Waspada");
cek("naik tidak pernah ditahan", tingkatEfektif(205, AMBANG, "Normal", 0.1), "Awas");
cek("dari Normal tidak ada yang ditahan", tingkatEfektif(10, AMBANG, "Normal", 0.1), "Normal");

// Tanpa histeresis, nilai yang bergetar di sekitar 100 akan bolak-balik.
{
  const { keadaan } = jalankan(
    [{ mm: 101, menit: 0 }, { mm: 99, menit: 5 }, { mm: 101, menit: 10 }],
    { konfirmasiSiklus: 1 }
  );
  cek("getaran di sekitar ambang tidak menurunkan tingkat", keadaan.tingkat, "Siaga");
}

// ── Bawaan sekarang: tanpa konfirmasi ────────────────────────────────────────
//
// Diminta 17 September 2026 setelah peringatan mengering di lapangan. Pada
// kolam_bpp, nilai yang melompat antara ~20 dan ~330 mm membuat hitungan tiga
// siklus terus ter-reset sebelum sampai tiga: P5 terbaca 331 mm tapi masih
// tercatat Waspada, P7 terbaca 239 mm tapi masih Siaga, dan berjam-jam tidak ada
// satu pun pesan berangkat. Uji ini menjaga supaya bawaannya tidak diam-diam
// dinaikkan lagi tanpa keputusan yang sama.
{
  const { pesan, keadaan } = jalankan([{ mm: 120, menit: 0 }]);
  cek("satu bacaan Siaga langsung berangkat", pesan.length, 1);
  cek("tingkatnya langsung diakui", keadaan.tingkat, "Siaga");
}
cek("bawaan konfirmasiSiklus = 1", KEBIJAKAN_BAWAAN.konfirmasiSiklus, 1);

// Yang TIDAK ikut hilang: jeda 30 menit tetap menahan kenaikan beruntun.
{
  const { pesan } = jalankan([
    { mm: 120, menit: 0 },
    { mm: 260, menit: 10 },
  ]);
  cek("kenaikan kedua dalam 10 menit tetap tertahan jeda", pesan.length, 1);
}

// Dan histeresis tetap menahan penurunan yang menggantung di ambang.
{
  const { keadaan } = jalankan([
    { mm: 120, menit: 0 },
    { mm: 99, menit: 40 },
  ]);
  cek("turun ke 99 mm dari Siaga masih ditahan histeresis", keadaan.tingkat, "Siaga");
}

console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
