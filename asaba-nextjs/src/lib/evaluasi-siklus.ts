/**
 * Evaluasi pergeseran pada AKHIR satu siklus, bukan pada tiap payload.
 *
 * Satu siklus AutoTracking menembak seluruh prisma site sekali putar. Menilai
 * tiap payload begitu tiba berarti sepuluh pemeriksaan terpisah untuk satu
 * putaran yang sama, dan — kalau beberapa melewati ambang — sepuluh pesan yang
 * dari sisi penerima tidak bisa dibedakan dari sepuluh kejadian. Menunggu
 * siklusnya tuntas memberi satu potret yang konsisten: satu nilai per prisma,
 * satu cap waktu, satu pesan.
 *
 * Dipanggil dari datamasuk-adr.ts, di dalam after() supaya tidak menunda respons
 * ke logger, lewat dua jalan:
 *
 *   1. evaluasiBilaSesiLengkap() pada tiap payload tembakan — begitu SETIAP
 *      prisma terdaftar sudah punya bacaan di sesi ini. Sejak 23 Nov 2026,
 *      supaya sirene, WhatsApp, dan dasbor tidak menunggu RTS pulang ke posisi
 *      awal dan laporan menit berikutnya (±45 detik di uji kantor).
 *   2. Tepi turun sensor16 (1 → 0) — cadangan untuk sesi yang tidak pernah
 *      lengkap, mis. satu prisma gagal ditembak.
 *
 * Satu sesi dinilai SEKALI. Jalan yang datang belakangan dilewati oleh
 * sudahDinilai() dan kunci sedangDinilai.
 *
 * ── Aturan yang tidak boleh dilanggar ───────────────────────────────────────
 *
 * Fungsi ini TIDAK BOLEH melempar. Ia berjalan di jalur ingestion; peringatan
 * yang gagal tidak boleh ikut menjatuhkan penerimaan data pengukuran. Seluruh
 * badannya dibungkus try/catch, termasuk untuk keadaan yang wajar terjadi hari
 * ini: tabel `status_prisma` dan `log_peringatan` dibuat oleh migrasi 011 yang
 * belum dijalankan, jadi setiap kueri ke sana akan gagal sampai itu dilakukan.
 */
import { prisma } from "@/lib/prisma";
import { parseWaktuToIso, waktuDateLokal, waktuMsLokal } from "@/components/monitoring/format";
import { nfloat } from "@/lib/coordinates";
import { type BarisRts, pergeseranMm } from "@/lib/pergeseran";
import { acuanBerlaku, type AcuanBerlaku } from "@/lib/acuan-prisma";
import { ambangDenganToleransi, toleransiMm } from "@/lib/akurasi-rts";
import { getSite } from "@/lib/sites";
import { type AmbangSite, type StatusLabel, indeksStatus } from "@/lib/ambang";
import { tingkatSite } from "@/lib/ews";
import { catatKejadian, sinkronEws } from "@/lib/kejadian-alarm";
import { prismaPuncak } from "@/lib/aturan-kejadian";
import { batasTakWajarMm, keadaanAwal, nilaiPeredam, type KeadaanPrisma } from "@/lib/peredam";
import { pemicuKonfirmasi, sesiSebelumnyaPerlu } from "@/lib/aturan-konfirmasi-sesi";
import {
  kirimPeringatan,
  type BarisPerubahan,
  type BarisPrisma,
  type RingkasanSiklus,
} from "@/lib/kirim-peringatan";

/** Berapa siklus beruntun gagal ditembak sebelum dilaporkan sebagai prisma hilang. */
export const BATAS_GAGAL_BERUNTUN = 3;


/**
 * Acuan R0 yang DITANDAI operator. Null bila tidak ada.
 *
 * Sengaja tidak memakai cariAcuanR0(): fungsi itu jatuh ke sesi TERTUA kalau
 * tidak ada yang bertanda, dan komentarnya sendiri menyebut "sesi tertua ikut
 * menentukan hasil walau tidak pernah ditandai apa pun". Untuk angka di layar
 * itu bisa diterima. Untuk dasar keselamatan tidak: peringatan yang dihitung
 * terhadap sesi yang tidak pernah sengaja dipilih siapa pun tidak bisa
 * dipertanggungjawabkan ke penerimanya.
 */
async function acuanR0Bertanda(site: string) {
  return prisma.logKontrol.findFirst({
    where: { site, r0: 1 },
    select: { id_log: true, datetime: true },
  });
}

/** Baris rts beserta rts.id-nya (dipakai aturan "bergeser lagi"). */
type BarisTembakan = BarisRts & { id: number };

/** Baris rts satu sesi, dipetakan per id_prisma. */
async function barisSesi(idKontrol: string, ambilTerakhir: boolean) {
  const rows = await prisma.$queryRaw<BarisTembakan[]>`
    SELECT id, sensor1, sensor7, sensor8, sensor9, sensor10
    FROM rts WHERE id_kontrol = ${idKontrol} ORDER BY id ASC
  `;
  const peta = new Map<string, BarisTembakan>();
  for (const r of rows) {
    const id = String(r.sensor1 ?? "").trim();
    if (!id) continue;
    // Acuan: bacaan PERTAMA sesi itu, sama dengan /api/deformasi.
    // Siklus berjalan: bacaan TERAKHIR, karena percobaan ulang menimpa yang
    // gagal — deformasi memakai LIMIT 1 tanpa ORDER BY di sini, jadi pilihannya
    // sebenarnya tak tentu; mengambil yang terakhir setidaknya menentu.
    if (ambilTerakhir || !peta.has(id)) peta.set(id, { ...r, id: Number(r.id) });
  }
  return peta;
}

/**
 * Baris yang membawa hasil tembakan: koordinatnya tidak nol semua. Syarat yang
 * sama dengan `sah` di pergeseranMm() — N/E/Z nol berarti prisma dibidik tapi
 * tidak ketemu.
 */
function terukur(b: BarisRts | undefined): boolean {
  if (!b) return false;
  return nfloat(b.sensor8) !== 0 || nfloat(b.sensor9) !== 0 || nfloat(b.sensor10) !== 0;
}

/**
 * Sesi ini sudah dinilai: setiap prisma terdaftar mencatatnya sebagai siklus
 * terakhir. evaluasiSiklus() menulis `siklus_terakhir` untuk SETIAP prisma
 * terdaftar, terbaca maupun tidak, jadi tanda ini tidak butuh kolom baru.
 *
 * Menilai sesi yang sama dua kali bukan tanpa akibat: prisma yang tidak terbaca
 * dihitung gagal dua kali, dan laporan "prisma hilang" datang lebih cepat dari
 * BATAS_GAGAL_BERUNTUN. Mengganti R0 menghapus status_prisma site itu, jadi
 * sesi sesudahnya selalu dinilai lagi dari awal.
 */
function sudahDinilai(
  idLog: string,
  prismaSite: ReadonlyArray<{ id_prisma: string }>,
  keadaan: ReadonlyArray<{ id_prisma: string; siklus_terakhir: string | null }>
): boolean {
  const terakhir = new Map(keadaan.map((k) => [k.id_prisma, k.siklus_terakhir]));
  return prismaSite.length > 0 && prismaSite.every((p) => terakhir.get(p.id_prisma) === idLog);
}

/**
 * Sesi yang sedang dinilai di proses ini. Tembakan terakhir dan laporan menit
 * yang mengulang tembakan itu bisa tiba berselang kurang dari sedetik; tanpa
 * kunci ini keduanya lolos sudahDinilai() sebelum salah satunya sempat menulis
 * status_prisma.
 */
const sedangDinilai = new Set<string>();

/**
 * Sesi tambahan yang dibaca di luar N−1: sesi yang tidak menembak prisma itu
 * (sesi terhenti, gagal bidik) dilewati per prisma, jadi perlu cadangan.
 */
const CADANGAN_SESI_LALU = 10;

/**
 * Sesi-sesi SEBELUM sesi ini, terbaru dulu — bahan tembakanLalu().
 *
 * Hanya sesi SESUDAH acuan R0 yang punya tembakan; sesi R0 sendiri tidak
 * (pergeserannya nol menurut definisi). Tanpa batas umur: pergeseran diukur
 * kumulatif dari R0, jadi dua tembakan yang berjauhan tetap sah saling memastikan.
 * Diurutkan menurut `log_kontrol.datetime`, sama dengan urutan siklus di layar.
 *
 * `acuan` = acuan per prisma yang berlaku untuk sesi itu. Bacaan prisma yang
 * acuannya berganti sesudah sesi itu tidak bisa dibandingkan dan tidak dipakai.
 */
async function sesiSebelumnya(site: string, idLog: string, idR0: string, perlu: number) {
  if (perlu <= 0) return [];
  const n = perlu + CADANGAN_SESI_LALU;
  const sesi = await prisma.$queryRaw<Array<{ id_log: string }>>`
    SELECT l.id_log
    FROM log_kontrol l
    JOIN log_kontrol k ON k.id_log = ${idLog}
    JOIN log_kontrol r ON r.id_log = ${idR0}
    WHERE l.site = ${site}
      AND l.id_log <> ${idLog}
      AND l.id_log <> ${idR0}
      AND l.datetime < k.datetime
      AND l.datetime > r.datetime
      AND EXISTS (SELECT 1 FROM rts t WHERE t.id_kontrol = l.id_log)
    ORDER BY l.datetime DESC
    LIMIT ${n}
  `;
  return Promise.all(
    sesi.map(async (s) => {
      const [peta, acuan] = await Promise.all([barisSesi(s.id_log, true), acuanBerlaku(site, s.id_log)]);
      return { idLog: s.id_log, peta, acuan };
    })
  );
}

export { pergeseranMm };

function keadaanDariBaris(r: {
  tingkat: string;
  tingkat_calon: string | null;
  hitung_calon: number;
  kirim_terakhir: Date | null;
}): KeadaanPrisma {
  return {
    tingkat: (r.tingkat as StatusLabel) ?? "Normal",
    tingkatCalon: (r.tingkat_calon as StatusLabel) ?? null,
    hitungCalon: Number(r.hitung_calon ?? 0),
    // waktuMsLokal, bukan getTime(): kolomnya berisi jam dinding WIB, dan Prisma
    // mengembalikannya sebagai Date yang medan UTC-nya jam itu apa adanya.
    // getTime() akan membacanya sebagai UTC — tujuh jam meleset dari sisi tulis.
    kirimTerakhirMs: waktuMsLokal(r.kirim_terakhir),
  };
}

export async function evaluasiSiklus(opsi: {
  site: string | null;
  idLog: string;
  waktuDb: string;
}): Promise<void> {
  const { site, idLog, waktuDb } = opsi;
  const tag = "[peringatan]";
  const kunci = `${site}|${idLog}`;
  let pegangKunci = false;

  try {
    if (!site || !idLog) return;
    if (sedangDinilai.has(kunci)) {
      console.log(`${tag} ${site}: siklus ${idLog} sedang dinilai — dilewati`);
      return;
    }
    sedangDinilai.add(kunci);
    pegangKunci = true;

    const cfg = await getSite(site);

    // ── Gerbang kesahihan ────────────────────────────────────────────────────
    //
    // Ketiganya sudah dikenali buildPeringatan() di /api/deformasi, tapi di sana
    // hanya memunculkan teks di layar. Untuk pesan yang dikirim ke orang
    // ketiganya harus jadi gerbang keras: mengirim "Awas" yang dihitung dari
    // koordinat contoh lebih buruk daripada tidak mengirim apa pun, karena
    // penerimanya tidak punya cara membedakannya dari yang sungguhan.
    if (cfg.tidakDikenal) {
      console.log(`${tag} ${site}: belum terdaftar di t_site — dilewati`);
      return;
    }
    // Kalibrasi BUKAN gerbang. Sempat iya, dan itu keliru: `rts_e/n/z` dan
    // `map_lat/lng` tidak pernah masuk pergeseranMm() — yang dihitung selisih
    // dua baris `rts` terhadap sesi acuan R0. Site yang center petanya belum
    // diisi tetap menghasilkan angka yang sah, dan menahan peringatannya berarti
    // diam justru untuk pergeseran sungguhan. Di produksi gerbang ini menahan
    // SELURUH peringatan, karena site di sana memang belum diisi center petanya.
    if (cfg.dataDummy) {
      console.log(`${tag} ${site}: memakai DATA CONTOH — dilewati`);
      // Site yang peringatannya dimatikan tidak boleh meninggalkan sirene
      // berbunyi dari tingkat sebelum tanda Data contoh dipasang.
      await tutupKejadian(site, idLog, waktuDb);
      await sinkronEws(site, cfg.idLoggerEws, "Normal");
      return;
    }

    const r0 = await acuanR0Bertanda(site);
    if (!r0) {
      console.log(`${tag} ${site}: tidak ada sesi bertanda r0=1 — dilewati`);
      return;
    }
    if (r0.id_log === idLog) {
      // Siklus ini SENDIRI yang jadi acuan: pergeserannya nol menurut definisi.
      console.log(`${tag} ${site}: siklus ${idLog} adalah acuan R0 — dilewati`);
      return;
    }

    const [acuanR0, acuanPrisma, sekarang, lampau, prismaSite, keadaanLama] = await Promise.all([
      barisSesi(r0.id_log, false),
      // Prisma yang arah bidiknya diperbarui diukur terhadap acuan barunya.
      acuanBerlaku(site, idLog),
      barisSesi(idLog, true),
      // Konfirmasi N sesi: tembakan sesi-sesi sebelumnya ikut menentukan (aturan-konfirmasi-sesi.ts).
      sesiSebelumnya(site, idLog, r0.id_log, sesiSebelumnyaPerlu(cfg.konfirmasiSesi)),
      prisma.$queryRaw<Array<{ id_prisma: string }>>`
        SELECT id_prisma FROM t_prisma WHERE site = ${site} ORDER BY id_prisma
      `,
      prisma.statusPrisma.findMany({ where: { site } }),
    ]);

    if (prismaSite.length === 0) {
      console.log(`${tag} ${site}: tidak ada prisma terdaftar — dilewati`);
      // Semua prisma dihapus: tidak ada lagi yang bisa membenarkan sirene.
      await tutupKejadian(site, idLog, waktuDb);
      await sinkronEws(site, cfg.idLoggerEws, "Normal");
      return;
    }

    if (sudahDinilai(idLog, prismaSite, keadaanLama)) {
      console.log(`${tag} ${site}: siklus ${idLog} sudah dinilai — dilewati`);
      return;
    }

    const perluLalu = sesiSebelumnyaPerlu(cfg.konfirmasiSesi);
    /**
     * N−1 tembakan SAH terakhir prisma ini sebelum sesi ini, terbaru dulu.
     * Sesi yang tidak menembak prisma ini (atau tembakannya gagal/tak wajar)
     * dilewati; berhenti di sesi yang acuannya lain dari sekarang, karena
     * bacaan sebelum acuan baru tidak bisa dibandingkan.
     */
    const tembakanLalu = (idPrisma: string): Array<{ mm: number; baris: BarisTembakan }> => {
      const idAcuan = acuanPrisma.get(idPrisma)?.id ?? null;
      const hasil: Array<{ mm: number; baris: BarisTembakan }> = [];
      for (const s of lampau) {
        if (hasil.length >= perluLalu) break;
        if ((s.acuan.get(idPrisma)?.id ?? null) !== idAcuan) break;
        const b = s.peta.get(idPrisma);
        const mm = bacaanSah(b, idPrisma);
        if (b && mm !== null) hasil.push({ mm, baris: b });
      }
      return hasil;
    };

    /** Acuan prisma ini di siklus ini: acuan baru bila ada (aturan-acuan.ts), selain itu R0. */
    const acuanUntuk = (idPrisma: string): BarisRts | undefined =>
      acuanPrisma.get(idPrisma)?.baris ?? acuanR0.get(idPrisma);

    const ambang: AmbangSite = cfg.thresholds;
    const batasTakWajar = batasTakWajarMm(ambang);
    /** Pergeseran satu bacaan, atau null bila gagal ditembak ATAU tak wajar. */
    const bacaanSah = (b: BarisRts | undefined, idPrisma: string): number | null => {
      const mm = pergeseranMm(b, acuanUntuk(idPrisma), cfg.rotation);
      return mm !== null && mm <= batasTakWajar ? mm : null;
    };
    // waktuMsLokal memancang ke +07:00, jadi hasilnya tidak ikut zona proses —
    // Node di server tidak menyetel TZ, cuma mewarisi zona sistem. Sama dengan
    // yang dipakai sesiUntukSiklus() untuk menghitung umur sesi.
    const sekarangMs = waktuMsLokal(waktuDb) ?? Date.now();

    const petaKeadaan = new Map(keadaanLama.map((k) => [k.id_prisma, k]));

    const naik: BarisPerubahan[] = [];
    const pulih: BarisPerubahan[] = [];
    const hilang: Array<{ idPrisma: string; siklus: number }> = [];
    // Keadaan SETIAP prisma terdaftar, terbaca maupun tidak. `hilang` tetap
    // eskalasi yang dilaporkan sekali; daftar ini potret siklusnya. Sebelum ada
    // daftar ini pesan hanya menghitung — "4 prisma lain tidak berubah tingkat" —
    // yang menyatakan sesuatu tidak terjadi tanpa memberi tahu prisma mana,
    // sedang di tingkat apa, dan bergeser berapa.
    const semua: BarisPrisma[] = [];
    // Ambang Waspada tiap prisma (plus toleransi alat) untuk aturan "bergeser lagi
    // sesudah konfirmasi"; hanya prisma yang terbaca siklus ini.
    const batasGeser = new Map<string, number>();
    const dicatat: Array<{ idPrisma: string; dari: StatusLabel; ke: StatusLabel; nilaiMm: number; kirim: boolean }> = [];

    for (const { id_prisma: idPrisma } of prismaSite) {
      const baris = petaKeadaan.get(idPrisma);
      const lama = baris ? keadaanDariBaris(baris) : keadaanAwal();
      const mentah = pergeseranMm(sekarang.get(idPrisma), acuanUntuk(idPrisma), cfg.rotation);
      const mmSekarang = mentah !== null && mentah <= batasTakWajar ? mentah : null;
      if (mentah !== null && mmSekarang === null) {
        console.log(
          `${tag} ${site} ${idPrisma}: bacaan ${(mentah / 1000).toFixed(1)} m melebihi batas wajar ` +
            `${(batasTakWajar / 1000).toFixed(1)} m — diperlakukan sebagai tidak terbaca`
        );
      }

      // ── Bacaan tidak sah: gagal ditembak, tak wajar, atau acuannya belum ada ─
      //
      // Tingkatnya TIDAK diubah dan calon TIDAK dimajukan — prisma yang tidak
      // terbaca berarti keadaannya tidak diketahui, bukan aman.
      if (mmSekarang === null) {
        semua.push({ idPrisma, tingkat: lama.tingkat, nilaiMm: null });
        const beruntun = Number(baris?.gagal_beruntun ?? 0) + 1;
        if (beruntun === BATAS_GAGAL_BERUNTUN) {
          hilang.push({ idPrisma, siklus: beruntun });
        }
        await prisma.statusPrisma.upsert({
          where: { site_id_prisma: { site, id_prisma: idPrisma } },
          create: {
            site, id_prisma: idPrisma,
            tingkat: lama.tingkat, tingkat_calon: lama.tingkatCalon, hitung_calon: lama.hitungCalon,
            nilai_mm: null, siklus_terakhir: idLog, gagal_beruntun: beruntun,
          },
          update: { nilai_mm: null, siklus_terakhir: idLog, gagal_beruntun: beruntun },
        });
        continue;
      }

      // ── Nilai pemicu ──────────────────────────────────────────────────────
      //
      // Terkecil dari tembakan ini dan N−1 tembakan sah sebelumnya prisma ini
      // (konfirmasi_sesi site, bawaan 2): tingkat naik hanya bila semuanya
      // melewati ambang. Belum ada N−1 tembakan sah sebelumnya = kenaikan
      // ditahan (bolehNaik false). Nilai inilah yang disimpan, dikirim, dan
      // dibunyikan dasbor.
      const lalu = tembakanLalu(idPrisma);
      // Kurang dari N−1 tembakan sah = sisanya null: kenaikan ditahan.
      const sebelumnya = Array.from({ length: perluLalu }, (_, i) => lalu[i]?.mm ?? null);
      const pemicu = pemicuKonfirmasi(mmSekarang, sebelumnya, cfg.konfirmasiSesi);
      const mm = pemicu.nilaiMm;

      // ── Toleransi akurasi RTS ─────────────────────────────────────────────
      //
      // Ambang prisma ini = ambang site + toleransi dari akurasi alat dan jarak
      // prisma ke alat (lihat akurasi-rts.ts). Jarak dari tembakan ini; bila
      // kosong, dari tembakan acuannya — jaraknya nyaris tidak berubah.
      const jarakM =
        nfloat(sekarang.get(idPrisma)?.sensor7) || nfloat(acuanUntuk(idPrisma)?.sensor7);
      const toleransi = toleransiMm(jarakM, cfg.akurasiRts);
      const ambangPrisma = ambangDenganToleransi(ambang, toleransi);
      batasGeser.set(idPrisma, ambangPrisma.geser.normalMax);

      const hasil = nilaiPeredam({
        keadaan: lama,
        nilaiMm: mm,
        ambang: ambangPrisma,
        sekarangMs,
        bolehNaik: pemicu.bolehNaik,
      });
      // Tingkat yang DIAKUI, bukan yang barusan terukur — sama dengan yang
      // dipakai memutuskan pesan, supaya daftar dan judulnya tidak bercerita beda.
      semua.push({ idPrisma, tingkat: hasil.keadaan.tingkat, nilaiMm: mm });

      await prisma.statusPrisma.upsert({
        where: { site_id_prisma: { site, id_prisma: idPrisma } },
        create: {
          site, id_prisma: idPrisma,
          tingkat: hasil.keadaan.tingkat,
          tingkat_calon: hasil.keadaan.tingkatCalon,
          hitung_calon: hasil.keadaan.hitungCalon,
          nilai_mm: mm,
          siklus_terakhir: idLog,
          kirim_terakhir: hasil.keadaan.kirimTerakhirMs ? waktuDateLokal(hasil.keadaan.kirimTerakhirMs) : null,
          gagal_beruntun: 0,
        },
        update: {
          tingkat: hasil.keadaan.tingkat,
          tingkat_calon: hasil.keadaan.tingkatCalon,
          hitung_calon: hasil.keadaan.hitungCalon,
          nilai_mm: mm,
          siklus_terakhir: idLog,
          kirim_terakhir: hasil.keadaan.kirimTerakhirMs ? waktuDateLokal(hasil.keadaan.kirimTerakhirMs) : null,
          gagal_beruntun: 0,
        },
      });

      if (!hasil.diakui) continue;

      const { dari, ke } = hasil.diakui;
      dicatat.push({ idPrisma, dari, ke, nilaiMm: mm, kirim: hasil.kirim });

      if (hasil.kirim) {
        const b: BarisPerubahan = { idPrisma, dari, ke, nilaiMm: mm };
        if (ke === "Normal" && indeksStatus(dari) > indeksStatus(ke)) pulih.push(b);
        else naik.push(b);
      }
    }

    // ── Perintah level ke logger EWS (sirene/lampu) ───────────────────────────
    //
    // Diletakkan SEBELUM kembalian "tidak ada yang perlu dikabarkan": peredam
    // bisa mendiamkan PESAN (jeda kirim) padahal tingkat yang diakui sudah
    // berubah, dan sirene harus mengikuti tingkat yang diakui, bukan mengikuti
    // pesan. Dibandingkan dengan level yang terakhir TERKIRIM ke perangkat
    // (status_ews), jadi sirene tidak dibunyikan ulang tiap siklus, tapi juga
    // tidak nyangkut saat R0 diganti, prisma dihapus, atau terbitnya gagal.
    // `semua` hanya memuat prisma yang masih terdaftar.
    //
    // Kejadian dicatat LEBIH DULU: senyap dari konfirmasi operator dibaca dari
    // kejadian aktif, dan kejadian yang baru pulih harus sudah tertutup sebelum
    // perintah Aman dihitung.
    const tingkatNow = tingkatSite(semua.map((p) => p.tingkat));
    const puncak = prismaPuncak(semua);
    await catatKejadianAman({
      site,
      tingkat: tingkatNow,
      puncak: puncak && puncak.tingkat !== "Normal" ? { idPrisma: puncak.idPrisma, nilaiMm: puncak.nilaiMm } : null,
      idLog,
      waktuMs: sekarangMs,
      // Prisma yang naik sesudah konfirmasi membatalkan senyapnya, jadi
      // sinkronEws di bawah langsung menyalakan sirene lagi.
      prisma: semua.map((p) => ({
        idPrisma: p.idPrisma,
        tingkat: p.tingkat,
        // Hanya bacaan yang sah dan wajar (sama dengan yang menentukan tingkat).
        bacaan: bacaanSah(sekarang.get(p.idPrisma), p.idPrisma) !== null ? sekarang.get(p.idPrisma) : undefined,
        // N−1 tembakan sah sebelumnya (terbaru dulu, undefined = tidak ada),
        // supaya "bergeser lagi" juga harus terlihat di N tembakan.
        bacaanLalu: (() => {
          const lalu = tembakanLalu(p.idPrisma);
          return Array.from({ length: perluLalu }, (_, i) => lalu[i]?.baris);
        })(),
        batasMm: batasGeser.get(p.idPrisma),
      })),
      rotasi: cfg.rotation,
    });
    await sinkronEws(site, cfg.idLoggerEws, tingkatNow);

    if (naik.length === 0 && pulih.length === 0 && hilang.length === 0) {
      if (dicatat.length > 0) {
        await simpanRiwayat(site, idLog, sekarangMs, dicatat, false, "didiamkan peredam");
      }
      return;
    }

    const ringkasan: RingkasanSiklus = {
      namaSite: cfg.nama,
      waktu: waktuDb,
      naik, pulih, hilang, semua,
      acuanR0: r0.id_log,
      // parseWaktuToIso, bukan new Date().toISOString(): nilainya jam dinding
      // WIB, dan $queryRaw bisa mengembalikannya sebagai Date ATAU string.
      waktuAcuanR0: parseWaktuToIso(r0.datetime)?.slice(0, 10) ?? null,
      acuanPrisma: prismaSite
        .map((p) => acuanPrisma.get(p.id_prisma))
        .filter((a): a is AcuanBerlaku => a !== undefined)
        .map((a) => ({ idPrisma: a.idPrisma, waktuTembakan: a.waktuTembakan })),
    };

    const hasilKirim = await kirimPeringatan(site, ringkasan);
    // galat dicatat APA ADANYA, tidak dikosongkan saat ok. Dengan dua kanal,
    // "terkirim" dan "semua jalur sehat" bukan lagi hal yang sama: peringatan
    // yang berangkat lewat email sementara Telegram-nya tumbang tetap terkirim,
    // dan satu-satunya tempat kegagalan itu terlihat adalah kolom ini.
    await simpanRiwayat(site, idLog, sekarangMs, dicatat, hasilKirim.ok, hasilKirim.galat);

    console.log(
      `${tag} ${site} siklus ${idLog}: ${naik.length} naik, ${pulih.length} pulih, ` +
        `${hilang.length} hilang, ` +
        `${semua.filter((p) => p.nilaiMm === null).length} tak terbaca, ` +
        `kirim=${hasilKirim.ok ? "ok" : "gagal"}` +
        `${hasilKirim.galat ? ` (${hasilKirim.galat})` : ""}`
    );
  } catch (e) {
    // Sengaja ditelan. Lihat catatan di kepala berkas: jalur ingestion tidak
    // boleh jatuh karena peringatan. Sampai migrasi 011 dijalankan, jalur ini
    // memang selalu berakhir di sini.
    console.error(`${tag} gagal (diabaikan):`, e instanceof Error ? e.message : e);
  } finally {
    if (pegangKunci) sedangDinilai.delete(kunci);
  }
}

/**
 * Nilai sesi begitu SETIAP prisma terdaftar sudah punya bacaan di sesi ini,
 * tanpa menunggu tepi turun sensor16. Dipanggil pada tiap payload tembakan.
 *
 * Tepi turun sensor16 baru datang setelah RTS pulang ke posisi awal dan logger
 * mengirim laporan menit berikutnya. Di uji kantor 23 Nov 2026 (sesi 103124)
 * tembakan terakhir, P2, masuk 10:32:15 dan sensor16 = 0 baru 10:33:00. Selama
 * itu sirene, WhatsApp, dan dasbor diam padahal datanya sudah lengkap.
 *
 * "Punya bacaan" = baris terakhir prisma itu di sesi ini berkoordinat tidak
 * nol, baris yang sama yang akan dinilai evaluasiSiklus(). Sesi yang salah satu
 * prismanya gagal ditembak tidak pernah lengkap di sini dan tetap dinilai pada
 * tepi turun sensor16, seperti sebelumnya.
 *
 * Tidak boleh melempar, dengan alasan yang sama seperti evaluasiSiklus().
 */
export async function evaluasiBilaSesiLengkap(opsi: {
  site: string | null;
  idLog: string;
  waktuDb: string;
}): Promise<void> {
  const { site, idLog } = opsi;
  if (!site || !idLog) return;

  try {
    const [prismaSite, sekarang, keadaan] = await Promise.all([
      prisma.$queryRaw<Array<{ id_prisma: string }>>`
        SELECT id_prisma FROM t_prisma WHERE site = ${site}
      `,
      barisSesi(idLog, true),
      prisma.statusPrisma.findMany({ where: { site }, select: { id_prisma: true, siklus_terakhir: true } }),
    ]);
    if (prismaSite.length === 0) return;
    if (!prismaSite.every((p) => terukur(sekarang.get(p.id_prisma)))) return;
    // Laporan menit sesudah tembakan terakhir mengulang tembakan itu; sesinya
    // sudah dinilai dan tidak perlu disentuh lagi.
    if (sudahDinilai(idLog, prismaSite, keadaan)) return;
  } catch (e) {
    console.error(
      `[peringatan] ${site}: cek sesi lengkap ${idLog} gagal (diabaikan):`,
      e instanceof Error ? e.message : e
    );
    return;
  }

  console.log(`[peringatan] ${site}: siklus ${idLog} lengkap — dinilai tanpa menunggu akhir sesi`);
  await evaluasiSiklus(opsi);
}

/**
 * catatKejadian() yang tidak pernah melempar. Kejadian adalah catatan
 * penanganan; kegagalannya (mis. migrasi 024 belum dijalankan) tidak boleh
 * menahan sirene dan pesan peringatan di bawahnya.
 */
async function catatKejadianAman(opsi: Parameters<typeof catatKejadian>[0]): Promise<void> {
  try {
    await catatKejadian(opsi);
  } catch (e) {
    console.error(
      `[peringatan][kejadian] ${opsi.site}: gagal dicatat (diabaikan):`,
      e instanceof Error ? e.message : e
    );
  }
}

/** Site yang tidak lagi dinilai (Data contoh, tanpa prisma): kejadiannya ditutup. */
async function tutupKejadian(site: string, idLog: string, waktuDb: string): Promise<void> {
  await catatKejadianAman({
    site,
    tingkat: "Normal",
    puncak: null,
    idLog,
    waktuMs: waktuMsLokal(waktuDb) ?? Date.now(),
  });
}

async function simpanRiwayat(
  site: string,
  idLog: string,
  sekarangMs: number,
  baris: Array<{ idPrisma: string; dari: StatusLabel; ke: StatusLabel; nilaiMm: number; kirim: boolean }>,
  terkirim: boolean,
  galat: string | null
) {
  if (baris.length === 0) return;
  await prisma.logPeringatan.createMany({
    data: baris.map((b) => ({
      site,
      id_prisma: b.idPrisma,
      id_log: idLog,
      dari: b.dari,
      ke: b.ke,
      nilai_mm: b.nilaiMm,
      // waktuDateLokal supaya kolomnya berisi jam dinding WIB seperti seluruh
      // kolom waktu lain. Date polos dari string tanpa zona diurai lokal lalu
      // ditulis Prisma sebagai UTC — di server berzona WIB, tujuh jam meleset.
      waktu: waktuDateLokal(sekarangMs),
      terkirim: b.kirim ? terkirim : false,
      galat: b.kirim ? galat?.slice(0, 255) ?? null : "tidak dikirim: didiamkan peredam",
    })),
  });
}
