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
 * Dipanggil dari /api/datamasuk/adr saat tepi turun sensor16 (1 → 0), di dalam
 * after() supaya tidak menunda respons ke logger.
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
import { nfloat, rotateEN } from "@/lib/coordinates";
import { getSite } from "@/lib/sites";
import { type AmbangSite, type StatusLabel, indeksStatus } from "@/lib/ambang";
import { keadaanAwal, nilaiPeredam, type KeadaanPrisma } from "@/lib/peredam";
import {
  kirimTelegram,
  susunTeks,
  type BarisPerubahan,
  type RingkasanSiklus,
} from "@/lib/kirim-peringatan";

/** Berapa siklus beruntun gagal ditembak sebelum dilaporkan sebagai prisma hilang. */
export const BATAS_GAGAL_BERUNTUN = 3;

type BarisRts = { sensor1: string; sensor8: string; sensor9: string; sensor10: string };

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

/** Baris rts satu sesi, dipetakan per id_prisma. */
async function barisSesi(idKontrol: string, ambilTerakhir: boolean) {
  const rows = await prisma.$queryRaw<BarisRts[]>`
    SELECT sensor1, sensor8, sensor9, sensor10
    FROM rts WHERE id_kontrol = ${idKontrol} ORDER BY id ASC
  `;
  const peta = new Map<string, BarisRts>();
  for (const r of rows) {
    const id = String(r.sensor1 ?? "").trim();
    if (!id) continue;
    // Acuan: bacaan PERTAMA sesi itu, sama dengan /api/deformasi.
    // Siklus berjalan: bacaan TERAKHIR, karena percobaan ulang menimpa yang
    // gagal — deformasi memakai LIMIT 1 tanpa ORDER BY di sini, jadi pilihannya
    // sebenarnya tak tentu; mengambil yang terakhir setidaknya menentu.
    if (ambilTerakhir || !peta.has(id)) peta.set(id, r);
  }
  return peta;
}

/**
 * Pergeseran linier 2D terhadap acuan, dalam mm. Null bila salah satu bacaan
 * tidak sah.
 *
 * Penjagaan nol bukan kehati-hatian berlebih. Di temp_prisma, status_get = 1
 * dengan N1/E1/Z1 semuanya nol berarti "Failed / Not Found" — prisma dibidik
 * tapi tidak ketemu. Tanpa penjagaan ini, satu prisma berkabut menghasilkan
 * jarak sebesar koordinat UTM penuh (ratusan kilometer dalam mm) dan langsung
 * jadi "Awas" palsu. /api/deformasi menjaga hal yang sama lewat `valid1`.
 */
export function pergeseranMm(
  sekarang: BarisRts | undefined,
  acuan: BarisRts | undefined,
  rotasi: Parameters<typeof rotateEN>[2] | null
): number | null {
  if (!sekarang || !acuan) return null;

  let N1 = nfloat(sekarang.sensor8);
  let E1 = nfloat(sekarang.sensor9);
  const Z1 = nfloat(sekarang.sensor10);
  let N0 = nfloat(acuan.sensor8);
  let E0 = nfloat(acuan.sensor9);
  const Z0 = nfloat(acuan.sensor10);

  const sah1 = N1 !== 0 || E1 !== 0 || Z1 !== 0;
  const sah0 = N0 !== 0 || E0 !== 0 || Z0 !== 0;
  if (!sah1 || !sah0) return null;

  if (rotasi) {
    [E1, N1] = rotateEN(E1, N1, rotasi);
    [E0, N0] = rotateEN(E0, N0, rotasi);
  }

  const dE = E1 - E0;
  const dN = N1 - N0;
  // Koordinat UTM dalam meter; ambang t_site dalam mm.
  return Math.sqrt(dE * dE + dN * dN) * 1000;
}

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

  try {
    if (!site || !idLog) return;

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

    const [acuan, sekarang, prismaSite] = await Promise.all([
      barisSesi(r0.id_log, false),
      barisSesi(idLog, true),
      prisma.$queryRaw<Array<{ id_prisma: string }>>`
        SELECT id_prisma FROM t_prisma WHERE site = ${site} ORDER BY id_prisma
      `,
    ]);

    if (prismaSite.length === 0) {
      console.log(`${tag} ${site}: tidak ada prisma terdaftar — dilewati`);
      return;
    }

    const ambang: AmbangSite = cfg.thresholds;
    // waktuMsLokal memancang ke +07:00, jadi hasilnya tidak ikut zona proses —
    // Node di server tidak menyetel TZ, cuma mewarisi zona sistem. Sama dengan
    // yang dipakai sesiUntukSiklus() untuk menghitung umur sesi.
    const sekarangMs = waktuMsLokal(waktuDb) ?? Date.now();

    const keadaanLama = await prisma.statusPrisma.findMany({ where: { site } });
    const petaKeadaan = new Map(keadaanLama.map((k) => [k.id_prisma, k]));

    const naik: BarisPerubahan[] = [];
    const pulih: BarisPerubahan[] = [];
    const hilang: Array<{ idPrisma: string; siklus: number }> = [];
    const dicatat: Array<{ idPrisma: string; dari: StatusLabel; ke: StatusLabel; nilaiMm: number; kirim: boolean }> = [];
    let tetap = 0;

    for (const { id_prisma: idPrisma } of prismaSite) {
      const baris = petaKeadaan.get(idPrisma);
      const lama = baris ? keadaanDariBaris(baris) : keadaanAwal();
      const mm = pergeseranMm(sekarang.get(idPrisma), acuan.get(idPrisma), cfg.rotation);

      // ── Bacaan tidak sah: gagal ditembak, atau acuannya belum ada ──────────
      //
      // Tingkatnya TIDAK diubah dan calon TIDAK dimajukan — prisma yang tidak
      // terbaca berarti keadaannya tidak diketahui, bukan aman.
      if (mm === null) {
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

      const hasil = nilaiPeredam({ keadaan: lama, nilaiMm: mm, ambang, sekarangMs });

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

      if (!hasil.diakui) { tetap++; continue; }

      const { dari, ke } = hasil.diakui;
      dicatat.push({ idPrisma, dari, ke, nilaiMm: mm, kirim: hasil.kirim });

      if (hasil.kirim) {
        const b: BarisPerubahan = { idPrisma, dari, ke, nilaiMm: mm };
        if (ke === "Normal" && indeksStatus(dari) > indeksStatus(ke)) pulih.push(b);
        else naik.push(b);
      }
    }

    if (naik.length === 0 && pulih.length === 0 && hilang.length === 0) {
      if (dicatat.length > 0) {
        await simpanRiwayat(site, idLog, sekarangMs, dicatat, false, "didiamkan peredam");
      }
      return;
    }

    const ringkasan: RingkasanSiklus = {
      namaSite: cfg.nama,
      waktu: waktuDb,
      naik, pulih, hilang, tetap,
      acuanR0: r0.id_log,
      // parseWaktuToIso, bukan new Date().toISOString(): nilainya jam dinding
      // WIB, dan $queryRaw bisa mengembalikannya sebagai Date ATAU string.
      waktuAcuanR0: parseWaktuToIso(r0.datetime)?.slice(0, 10) ?? null,
    };

    const hasilKirim = await kirimTelegram(site, susunTeks(ringkasan));
    await simpanRiwayat(
      site, idLog, sekarangMs, dicatat,
      hasilKirim.ok,
      hasilKirim.ok ? null : hasilKirim.galat
    );

    console.log(
      `${tag} ${site} siklus ${idLog}: ${naik.length} naik, ${pulih.length} pulih, ` +
        `${hilang.length} hilang, kirim=${hasilKirim.ok ? "ok" : hasilKirim.galat}`
    );
  } catch (e) {
    // Sengaja ditelan. Lihat catatan di kepala berkas: jalur ingestion tidak
    // boleh jatuh karena peringatan. Sampai migrasi 011 dijalankan, jalur ini
    // memang selalu berakhir di sini.
    console.error(`${tag} gagal (diabaikan):`, e instanceof Error ? e.message : e);
  }
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
