/**
 * Pemeriksaan penyusunan dan penyaluran peringatan.
 * Jalankan: npx tsx src/lib/kirim-peringatan.test.ts
 *
 * Yang diuji di sini hanya bagian yang MURNI — pemilihan penerima, baris
 * subjek, badan HTML — plus satu keadaan fan-out yang tidak menyentuh jaringan.
 * Pengiriman SMTP dan Telegram sendiri tidak bisa diuji tanpa server, sama
 * seperti alur MQTT; yang bisa dijaga adalah semua keputusan yang diambil
 * SEBELUM soketnya dibuka, dan itu yang menentukan pesan sampai ke siapa.
 */
import {
  chatIdWhatsapp,
  kirimPeringatan,
  penerimaEmail,
  subjekPeringatan,
  susunHtml,
  susunTeks,
  susunTeksWa,
  tingkatTerburuk,
  tujuanWhatsapp,
  type RingkasanSiklus,
} from "./kirim-peringatan";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`);
}

function bersihkanEnv() {
  for (const k of Object.keys(process.env)) {
    if (
      k.startsWith("ALERT_EMAIL") ||
      k.startsWith("SMTP_") ||
      k.startsWith("TELEGRAM_") ||
      k.startsWith("WHATSAPP_")
    ) {
      delete process.env[k];
    }
  }
}

function ringkasan(p: Partial<RingkasanSiklus> = {}): RingkasanSiklus {
  return {
    namaSite: "Bendungan Uji",
    waktu: "2026-09-15 08:30:00",
    naik: [],
    pulih: [],
    hilang: [],
    tetap: 0,
    acuanR0: null,
    waktuAcuanR0: null,
    ...p,
  };
}

// ── Penerima ────────────────────────────────────────────────────────────────

bersihkanEnv();
cek("tanpa env: tidak ada penerima", penerimaEmail("ccp"), []);

process.env.ALERT_EMAIL_TO = "umum@contoh.id";
cek("cadangan dipakai site mana pun", penerimaEmail("ccp"), ["umum@contoh.id"]);

process.env.ALERT_EMAIL_TO_CCP = "ccp@contoh.id";
cek("per site menang atas cadangan", penerimaEmail("ccp"), ["ccp@contoh.id"]);
cek("site lain tetap jatuh ke cadangan", penerimaEmail("tambang"), ["umum@contoh.id"]);

// Akhiran kunci harus sama aturannya dengan Telegram: bukan huruf/angka jadi "_".
process.env.ALERT_EMAIL_TO_POLITEKNIK_PU = "pu@contoh.id";
cek("site bertanda hubung dinormalkan", penerimaEmail("politeknik-pu"), ["pu@contoh.id"]);
cek("site bertitik dinormalkan", penerimaEmail("politeknik.pu"), ["pu@contoh.id"]);

// Daftar ditulis manusia ke .env — pemisahnya tidak bisa dituntut seragam.
process.env.ALERT_EMAIL_TO_CCP = "a@contoh.id, b@contoh.id;c@contoh.id  d@contoh.id";
cek("koma, titik koma, dan spasi sama-sama memisah", penerimaEmail("ccp"), [
  "a@contoh.id",
  "b@contoh.id",
  "c@contoh.id",
  "d@contoh.id",
]);

process.env.ALERT_EMAIL_TO_CCP = "a@contoh.id,,, ,b@contoh.id";
cek("pemisah berlebih tidak jadi alamat kosong", penerimaEmail("ccp"), [
  "a@contoh.id",
  "b@contoh.id",
]);

process.env.ALERT_EMAIL_TO_CCP = "a@contoh.id, A@Contoh.id, b@contoh.id";
cek("kembar tanpa peduli besar kecil huruf dibuang", penerimaEmail("ccp"), [
  "a@contoh.id",
  "b@contoh.id",
]);

// Satu entri rusak tidak boleh menjatuhkan seluruh kiriman.
process.env.ALERT_EMAIL_TO_CCP = "bukan-alamat, tanpa@titik, b@contoh.id";
cek("entri tak berbentuk alamat disaring", penerimaEmail("ccp"), ["b@contoh.id"]);

bersihkanEnv();

// ── Subjek ──────────────────────────────────────────────────────────────────

const naikSatu = ringkasan({
  naik: [{ idPrisma: "P3", dari: "Waspada", ke: "Siaga", nilaiMm: 134.7 }],
});
cek(
  "satu prisma naik: prisma disebut namanya",
  subjekPeringatan(naikSatu),
  "[Siaga] Bendungan Uji — prisma P3 naik ke Siaga"
);

const naikBanyak = ringkasan({
  naik: [
    { idPrisma: "P3", dari: "Waspada", ke: "Siaga", nilaiMm: 134.7 },
    { idPrisma: "P7", dari: "Normal", ke: "Awas", nilaiMm: 260.1 },
  ],
});
// Tingkat di subjek harus yang PALING gawat, bukan yang pertama di daftar.
cek(
  "banyak prisma: tingkat terburuk yang dipakai",
  subjekPeringatan(naikBanyak),
  "[Awas] Bendungan Uji — 2 prisma naik ke Awas"
);
cek("tingkat terburuk dari kolom ke", tingkatTerburuk(naikBanyak), "Awas");
cek("tanpa kenaikan tidak ada tingkat terburuk", tingkatTerburuk(ringkasan()), null);

cek(
  "pulih punya subjeknya sendiri",
  subjekPeringatan(ringkasan({ pulih: [{ idPrisma: "P3", dari: "Siaga", ke: "Normal", nilaiMm: 12 }] })),
  "[Pulih] Bendungan Uji — prisma P3 kembali Normal"
);
cek(
  "prisma hilang punya subjeknya sendiri",
  subjekPeringatan(ringkasan({ hilang: [{ idPrisma: "P9", siklus: 3 }] })),
  "[Prisma hilang] Bendungan Uji — Prisma P9 gagal ditembak"
);
// Kenaikan selalu mengalahkan pulih: yang mendesak yang naik ke atas.
cek(
  "kenaikan menang atas pulih di siklus yang sama",
  subjekPeringatan(
    ringkasan({
      naik: [{ idPrisma: "P3", dari: "Waspada", ke: "Siaga", nilaiMm: 134 }],
      pulih: [{ idPrisma: "P5", dari: "Siaga", ke: "Normal", nilaiMm: 10 }],
    })
  ),
  "[Siaga] Bendungan Uji — prisma P3 naik ke Siaga"
);

// ── Badan pesan ─────────────────────────────────────────────────────────────

{
  const html = susunHtml(naikBanyak);
  cek("HTML memuat tingkat terburuk", html.includes("Awas — Bendungan Uji"), true);
  cek("HTML memuat id prisma", html.includes("P7"), true);
  cek("HTML membulatkan mm seperti teks", html.includes("260 mm"), true);
  cek("HTML memakai warna Awas dari globals.css", html.includes("#d03b3b"), true);
}

{
  // Nama site datang dari basis data, jadi tidak boleh masuk HTML apa adanya.
  const html = susunHtml(ringkasan({ namaSite: 'Situ <script>alert("x")</script>' }));
  cek("nama site tidak lolos sebagai tag", html.includes("<script>"), false);
  cek("nama site lolos sebagai teks", html.includes("&lt;script&gt;"), true);
}

{
  const r = ringkasan({
    naik: [{ idPrisma: "P3", dari: "Waspada", ke: "Siaga", nilaiMm: 134.7 }],
    acuanR0: "LOG123",
    waktuAcuanR0: "2026-01-04",
  });
  // Acuan R0 wajib ada di KEDUA kanal — penerima email tidak boleh dapat angka
  // tanpa tahu angka itu diukur terhadap apa.
  cek("teks menyebut acuan R0", susunTeks(r).includes("Acuan R0: sesi LOG123"), true);
  cek("HTML menyebut acuan R0", susunHtml(r).includes("Acuan R0: sesi LOG123"), true);
}

// ── WhatsApp: nomor jadi chatId ─────────────────────────────────────────────
//
// Bagian yang paling mudah salah, dan salahnya paling mahal: nomor yang keliru
// ditafsirkan BUKAN berarti gagal kirim, melainkan peringatan yang mendarat di
// telepon orang lain. Karena itu yang tidak dikenali dibuang, bukan ditebak.

cek("nol depan jadi 62", chatIdWhatsapp("081288888888"), "6281288888888@c.us");
cek("plus 62 dirapikan", chatIdWhatsapp("+6281288888888"), "6281288888888@c.us");
cek("sudah 62 dibiarkan", chatIdWhatsapp("6281288888888"), "6281288888888@c.us");
cek("spasi dan tanda hubung dibuang", chatIdWhatsapp("+62 812-8888-8888"), "6281288888888@c.us");
cek("kurung dibuang", chatIdWhatsapp("(0812) 8888 8888"), "6281288888888@c.us");
cek("chatId lengkap dilewatkan", chatIdWhatsapp("6281288888888@c.us"), "6281288888888@c.us");

// Grup adalah bentuk yang paling masuk akal untuk peringatan piket.
cek("id grup dilewatkan", chatIdWhatsapp("120363012345678901@g.us"), "120363012345678901@g.us");
cek("id grup tanpa akhiran diberi @g.us", chatIdWhatsapp("120363012345678901"), "120363012345678901@g.us");

cek("kosong ditolak", chatIdWhatsapp(""), null);
cek("bukan angka ditolak", chatIdWhatsapp("bukan-nomor"), null);
// Nomor asing tidak ditebak jadi nomor Indonesia.
cek("nomor luar negeri ditolak", chatIdWhatsapp("+14155551234"), null);
// Telepon rumah bukan WhatsApp: nomor seluler Indonesia selalu mulai 8.
cek("nomor rumah ditolak", chatIdWhatsapp("0215551234"), null);
cek("terlalu pendek ditolak", chatIdWhatsapp("08123"), null);
cek("terlalu panjang ditolak", chatIdWhatsapp("0812888888888888"), null);

bersihkanEnv();
process.env.WHATSAPP_TO = "081288888888";
cek("cadangan dipakai site mana pun", tujuanWhatsapp("ccp"), ["6281288888888@c.us"]);
process.env.WHATSAPP_TO_CCP = "081211111111, 0812-2222-2222; 120363012345678901@g.us";
cek("per site menang, campuran bentuk diterima", tujuanWhatsapp("ccp"), [
  "6281211111111@c.us",
  "6281222222222@c.us",
  "120363012345678901@g.us",
]);
// Satu nomor ditulis dua gaya tetap satu orang — jangan dikirimi dua kali.
process.env.WHATSAPP_TO_CCP = "081288888888, +6281288888888, 6281288888888";
cek("nomor sama beda gaya tulis dihitung sekali", tujuanWhatsapp("ccp"), ["6281288888888@c.us"]);
// Satu entri rusak tidak boleh membatalkan yang lain.
process.env.WHATSAPP_TO_CCP = "bukan-nomor, 081288888888";
cek("entri rusak disaring", tujuanWhatsapp("ccp"), ["6281288888888@c.us"]);
bersihkanEnv();

// ── WhatsApp: teks ──────────────────────────────────────────────────────────

{
  const wa = susunTeksWa(naikBanyak);
  const baris = wa.split("\n");
  cek("baris pertama ditebalkan dan ditandai tingkat", baris[0], "*[Awas] Bendungan Uji — siklus 2026-09-15 08:30:00*");
  // Isi di bawah baris pertama harus identik dengan kanal lain.
  cek(
    "sisanya sama persis dengan teks Telegram",
    baris.slice(1).join("\n"),
    susunTeks(naikBanyak).split("\n").slice(1).join("\n")
  );
}
cek(
  "siklus pulih ditandai Pulih",
  susunTeksWa(ringkasan({ pulih: [{ idPrisma: "P3", dari: "Siaga", ke: "Normal", nilaiMm: 12 }] })).split("\n")[0],
  "*[Pulih] Bendungan Uji — siklus 2026-09-15 08:30:00*"
);

// ── Fan-out ─────────────────────────────────────────────────────────────────

bersihkanEnv();

// Dibungkus fungsi, bukan await di tingkat atas: tsx menyalurkan berkas ini
// lewat keluaran cjs, dan di situ top-level await ditolak saat transform.
async function fanOut() {
  // Tanpa satu pun kanal disetel, ini bukan "diam yang wajar": evaluasi sudah
  // memutuskan ada yang perlu dikabarkan, dan tidak ada yang menerimanya.
  const h = await kirimPeringatan("ccp", naikSatu);
  cek("tanpa kanal: tidak dianggap terkirim", h.ok, false);
  cek("tanpa kanal: galat menyebutkan sebabnya", h.galat, "tidak ada kanal peringatan yang disetel");
  // Kanal yang memang tidak dipasang tidak diadukan satu per satu — kalau ikut
  // dicatat, pemasangan satu kanal akan mengeluh di setiap baris log_peringatan.
  cek("kanal yang mati ditandai", h.kanal.map((k) => [k.nama, "mati" in k.hasil && k.hasil.mati]), [
    ["telegram", true],
    ["email", true],
    ["whatsapp", true],
  ]);
}

fanOut().then(() => {
  console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
  process.exit(gagal === 0 ? 0 : 1);
});
