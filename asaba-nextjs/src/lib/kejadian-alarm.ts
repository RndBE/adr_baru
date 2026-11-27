/**
 * Kejadian alarm dan perintah sirene EWS — sisi basis data.
 *
 * Aturannya di aturan-kejadian.ts (murni, teruji). Berkas ini hanya membaca dan
 * menulis tabel `kejadian_alarm` dan `status_ews`, dan menerbitkan perintah
 * level ke logger EWS. Dipakai oleh evaluasi-siklus.ts di akhir siklus dan
 * oleh API konfirmasi/verifikasi.
 */
import { Prisma, type KejadianAlarm } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { waktuDateLokal } from "@/components/monitoring/format";
import { type StatusLabel, asStatusLabel } from "@/lib/ambang";
import {
  type HasilEws,
  type KejadianRingkas,
  bergeserSesudahKonfirmasi,
  catatanAlarmUlang,
  langkahKejadian,
  naikSesudahKonfirmasi,
  tambahCatatan,
  tingkatTercakup,
  uraiPosisiDikonfirmasi,
} from "@/lib/aturan-kejadian";
import {
  barisCatatanBungkam,
  barisCatatanBunyiLagi,
  perluBungkamMalam,
  teksBungkamMalam,
  tingkatTersenyap,
} from "@/lib/aturan-senyap-malam";
import { getSite } from "@/lib/sites";
import { type BarisRts, pergeseranMm } from "@/lib/pergeseran";
import { geserTerkonfirmasi } from "@/lib/aturan-konfirmasi-sesi";
import type { rotateEN } from "@/lib/coordinates";
import { type EwsTerkirim, perluKirimEws, tingkatUntukEws } from "@/lib/ews";
import { sendEwsLevel } from "@/lib/mqtt";

/** Date jam dinding dari Prisma → "YYYY-MM-DD HH:mm:ss". Medan UTC-nya SUDAH jam dinding. */
export function teksWaktuDb(d: Date | null): string | null {
  if (!d || isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/** Jam dinding WIB sekarang, untuk kolom DateTime. */
export function sekarangDb(): Date {
  return waktuDateLokal(Date.now());
}

export function keRingkas(k: KejadianAlarm, namaSite: string, adaEws?: boolean): KejadianRingkas {
  return {
    id: k.id,
    site: k.site,
    namaSite,
    mulai: teksWaktuDb(k.mulai) ?? "",
    tingkatPuncak: asStatusLabel(k.tingkat_puncak) ?? "Normal",
    tingkatTerakhir: asStatusLabel(k.tingkat_terakhir) ?? "Normal",
    prismaPuncak: k.prisma_puncak,
    nilaiPuncakMm: k.nilai_puncak_mm,
    pulih: teksWaktuDb(k.pulih),
    dikonfirmasi: teksWaktuDb(k.dikonfirmasi),
    dikonfirmasiOleh: k.dikonfirmasi_oleh,
    tingkatDikonfirmasi: asStatusLabel(k.tingkat_dikonfirmasi),
    diverifikasi: teksWaktuDb(k.diverifikasi),
    diverifikasiOleh: k.diverifikasi_oleh,
    hasil: k.hasil === "benar" || k.hasil === "palsu" ? k.hasil : null,
    penyebab: k.penyebab,
    catatan: k.catatan,
    dibungkam: teksWaktuDb(k.dibungkam),
    tingkatDibungkam: asStatusLabel(k.tingkat_dibungkam),
    adaEws,
  };
}

/**
 * Kejadian sebagai KejadianRingkas, lengkap dengan nama site.
 * `hanyaSiteAktif` membuang site yang dinonaktifkan di Master Data.
 */
export async function ringkasKejadian(
  baris: KejadianAlarm[],
  hanyaSiteAktif = false
): Promise<KejadianRingkas[]> {
  if (baris.length === 0) return [];
  const site = await prisma.site.findMany({
    where: { slug: { in: [...new Set(baris.map((b) => b.site))] } },
    select: { slug: true, nama: true, aktif: true, id_logger_ews: true },
  });
  const peta = new Map(site.map((s) => [s.slug, s]));
  return baris
    .filter((b) => !hanyaSiteAktif || peta.get(b.site)?.aktif)
    .map((b) => {
      const s = peta.get(b.site);
      return keRingkas(b, s?.nama ?? b.site, s ? Boolean(s.id_logger_ews) : undefined);
    });
}

/** Kejadian aktif site ini (belum pulih), yang terbaru bila entah kenapa lebih dari satu. */
export async function kejadianAktif(site: string): Promise<KejadianAlarm | null> {
  return prisma.kejadianAlarm.findFirst({
    where: { site, pulih: null },
    orderBy: { id: "desc" },
  });
}

/**
 * Buka, perbarui, atau tutup kejadian site ini setelah satu siklus dinilai.
 * Melempar bila basis data gagal — pemanggil (evaluasi-siklus) menelannya.
 */
export async function catatKejadian(opsi: {
  site: string;
  tingkat: StatusLabel;
  puncak: { idPrisma: string; nilaiMm: number | null } | null;
  idLog: string;
  waktuMs: number;
  /** Tingkat setiap prisma terdaftar di siklus ini, untuk naikSesudahKonfirmasi(). */
  prisma?: ReadonlyArray<{
    idPrisma: string;
    tingkat: StatusLabel;
    /** Tembakan prisma ini di siklus ini, untuk bergeserSesudahKonfirmasi(). */
    bacaan?: BarisRts;
    /**
     * Tembakan prisma ini di N−1 sesi sebelumnya (terbaru dulu; undefined = tidak
     * ada), untuk aturan konfirmasi beberapa sesi. Tidak diisi = satu sesi cukup.
     */
    bacaanLalu?: ReadonlyArray<(BarisRts & { id: number }) | undefined>;
    /** Ambang Waspada prisma ini plus toleransi alat, mm. */
    batasMm?: number;
  }>;
  /** Rotasi site, sama dengan yang dipakai menghitung pergeseran. */
  rotasi?: Parameters<typeof rotateEN>[2] | null;
}): Promise<void> {
  const { site, tingkat, puncak, idLog, waktuMs } = opsi;
  const aktif = await kejadianAktif(site);
  const langkah = langkahKejadian(
    aktif
      ? { tingkatPuncak: asStatusLabel(aktif.tingkat_puncak) ?? "Normal", nilaiPuncakMm: aktif.nilai_puncak_mm }
      : null,
    tingkat,
    puncak?.nilaiMm ?? null
  );
  const waktu = waktuDateLokal(waktuMs);

  switch (langkah.jenis) {
    case "diam":
      return;
    case "buka":
      await prisma.kejadianAlarm.create({
        data: {
          site,
          id_log_mulai: idLog,
          mulai: waktu,
          tingkat_puncak: tingkat,
          tingkat_terakhir: tingkat,
          prisma_puncak: puncak?.idPrisma ?? null,
          nilai_puncak_mm: puncak?.nilaiMm ?? null,
          berbunyi_sejak: waktu,
        },
      });
      console.log(`[peringatan][kejadian] ${site}: dibuka, ${tingkat} (siklus ${idLog})`);
      return;
    case "perbarui":
      await prisma.kejadianAlarm.update({
        where: { id: aktif!.id },
        data: {
          tingkat_terakhir: tingkat,
          ...(langkah.gantiPuncak
            ? {
                tingkat_puncak: tingkat,
                prisma_puncak: puncak?.idPrisma ?? null,
                nilai_puncak_mm: puncak?.nilaiMm ?? null,
              }
            : {}),
        },
      });
      await bunyikanLagiBilaMemburuk(aktif!, opsi.prisma ?? [], opsi.rotasi ?? null, waktu, idLog);
      return;
    case "pulih":
      await prisma.kejadianAlarm.update({
        where: { id: aktif!.id },
        data: { tingkat_terakhir: "Normal", pulih: waktu },
      });
      console.log(`[peringatan][kejadian] ${site}: pulih (siklus ${idLog})`);
      return;
  }
}

/**
 * Konfirmasi hanya mencakup yang sudah terjadi saat tombolnya ditekan. Prisma
 * yang sekarang melewati tingkat tertinggi yang dicapainya sampai saat itu
 * (lihat naikSesudahKonfirmasi) membatalkan konfirmasi DAN verifikasi
 * kejadiannya: sirene (sinkronEws, dipanggil sesudah ini), suara, banner, dan
 * modal menyala lagi, dan prisma itu harus dicek ke lapangan. Siapa dan kapan
 * mengonfirmasi/memverifikasi sebelumnya dicatat di `catatan`.
 *
 * Bersyarat pada `dikonfirmasi` yang barusan dibaca: konfirmasi ulang yang
 * masuk di antaranya tidak ikut terhapus.
 */
type PrismaSiklus = ReadonlyArray<{
  idPrisma: string;
  tingkat: StatusLabel;
  bacaan?: BarisRts;
  bacaanLalu?: ReadonlyArray<(BarisRts & { id: number }) | undefined>;
  batasMm?: number;
}>;

/**
 * Yang memburuk sejak `batas` (jam konfirmasi atau jam bunyi dibungkam):
 * prisma yang naik melewati tingkat tertinggi yang dicapainya sampai saat itu,
 * dan prisma yang bergeser lagi dari posisinya saat itu (`posisiTeks`).
 */
async function memburukSejak(
  aktif: KejadianAlarm,
  batas: Date,
  posisiTeks: string | null,
  prismaSiklus: PrismaSiklus,
  rotasi: Parameters<typeof rotateEN>[2] | null
) {
  const [riwayat, acuan] = await Promise.all([
    prisma.logPeringatan.findMany({
      where: { site: aktif.site, waktu: { gte: aktif.mulai, lte: batas } },
      select: { id_prisma: true, ke: true, waktu: true },
    }),
    // Prisma yang diberi acuan baru selama kejadian ini: riwayatnya sebelum
    // itu tidak lagi mencakup apa pun (lihat tingkatTercakup).
    prisma.acuanPrisma
      .findMany({ where: { site: aktif.site, ditetapkan: { gte: aktif.mulai } }, select: { id_prisma: true, ditetapkan: true } })
      .catch(() => []),
  ]);
  const sejak = new Map<string, number>();
  for (const a of acuan) {
    // getTime() di kedua sisi: kolomnya sama-sama jam dinding, jadi selisihnya benar.
    sejak.set(a.id_prisma, Math.max(sejak.get(a.id_prisma) ?? 0, a.ditetapkan.getTime()));
  }
  const naik = naikSesudahKonfirmasi(
    prismaSiklus,
    tingkatTercakup(
      riwayat.map((r) => ({ idPrisma: r.id_prisma, ke: asStatusLabel(r.ke) ?? "Normal", waktuMs: r.waktu.getTime() })),
      sejak
    )
  );
  const bergeser = await bergeserLagi(posisiTeks, prismaSiklus, rotasi);
  return { naik, bergeser };
}

/**
 * Bunyi kejadian ini menyala lagi bila keadaannya memburuk sejak bunyinya
 * didiamkan — oleh konfirmasi, atau oleh senyap jam malam bila belum
 * dikonfirmasi (aturan-senyap-malam.ts). sinkronEws, dipanggil sesudah ini,
 * lalu menyalakan sirene; peramban menyusul lewat /api/alarm-ambang.
 */
async function bunyikanLagiBilaMemburuk(
  aktif: KejadianAlarm,
  prismaSiklus: PrismaSiklus,
  rotasi: Parameters<typeof rotateEN>[2] | null,
  waktu: Date,
  idLog: string
): Promise<void> {
  if (prismaSiklus.length === 0) return;
  if (aktif.dikonfirmasi) {
    await batalkanKonfirmasiBilaNaik(aktif, prismaSiklus, rotasi, waktu, idLog);
    return;
  }
  if (!aktif.dibungkam) return;
  const { naik, bergeser } = await memburukSejak(aktif, aktif.dibungkam, aktif.posisi_dibungkam, prismaSiklus, rotasi);
  if (naik.length === 0 && bergeser.length === 0) return;
  const ubah = await prisma.kejadianAlarm.updateMany({
    where: { id: aktif.id, pulih: null, dikonfirmasi: null, dibungkam: aktif.dibungkam },
    data: {
      dibungkam: null,
      tingkat_dibungkam: null,
      posisi_dibungkam: null,
      berbunyi_sejak: waktu,
      catatan: tambahCatatan(aktif.catatan, barisCatatanBunyiLagi(teksWaktuDb(waktu) ?? "", naik, bergeser)),
    },
  });
  if (ubah.count > 0) {
    console.log(
      `[peringatan][kejadian] ${aktif.site} #${aktif.id}: memburuk sesudah bunyi dimatikan otomatis — bunyi menyala lagi (siklus ${idLog})`
    );
  }
}

/**
 * Konfirmasi hanya mencakup yang sudah terjadi saat tombolnya ditekan; lihat
 * catatan di atas memburukSejak().
 */
async function batalkanKonfirmasiBilaNaik(
  aktif: KejadianAlarm,
  prismaSiklus: PrismaSiklus,
  rotasi: Parameters<typeof rotateEN>[2] | null,
  waktu: Date,
  idLog: string
): Promise<void> {
  if (!aktif.dikonfirmasi) return;
  const { naik, bergeser } = await memburukSejak(
    aktif,
    aktif.dikonfirmasi,
    aktif.posisi_dikonfirmasi,
    prismaSiklus,
    rotasi
  );
  if (naik.length === 0 && bergeser.length === 0) return;

  const catatan = catatanAlarmUlang({
    catatan: aktif.catatan,
    waktu: teksWaktuDb(waktu) ?? "",
    naik,
    bergeser,
    dikonfirmasi: {
      oleh: aktif.dikonfirmasi_oleh,
      waktu: teksWaktuDb(aktif.dikonfirmasi),
      tingkat: asStatusLabel(aktif.tingkat_dikonfirmasi),
    },
    diverifikasi: aktif.diverifikasi
      ? {
          hasil: aktif.hasil === "benar" || aktif.hasil === "palsu" ? aktif.hasil : null,
          oleh: aktif.diverifikasi_oleh,
          waktu: teksWaktuDb(aktif.diverifikasi),
        }
      : null,
  });
  const ubah = await prisma.kejadianAlarm.updateMany({
    where: { id: aktif.id, pulih: null, dikonfirmasi: aktif.dikonfirmasi },
    data: {
      dikonfirmasi: null,
      dikonfirmasi_oleh: null,
      tingkat_dikonfirmasi: null,
      posisi_dikonfirmasi: null,
      diverifikasi: null,
      diverifikasi_oleh: null,
      hasil: null,
      penyebab: null,
      // Berbunyi lagi dari awal: hitungan senyap jam malam juga mulai lagi.
      berbunyi_sejak: waktu,
      dibungkam: null,
      tingkat_dibungkam: null,
      posisi_dibungkam: null,
      catatan,
    },
  });
  if (ubah.count > 0) {
    console.log(
      `[peringatan][kejadian] ${aktif.site} #${aktif.id}: ` +
        [
          ...naik.map((p) => `${p.idPrisma} naik ke ${p.tingkat}`),
          ...bergeser.map((p) => `${p.idPrisma} bergeser lagi ${Math.round(p.geserMm ?? 0)} mm`),
        ].join(", ") +
        ` sesudah konfirmasi — alarm menyala lagi, konfirmasi dan verifikasi diulang (siklus ${idLog})`
    );
  }
}

/**
 * Prisma yang bergeser lagi sejak konfirmasi: jarak tembakan siklus ini dari
 * tembakan yang tersimpan saat konfirmasi (posisi_dikonfirmasi) mencapai batas.
 * Kosong bila kejadiannya dikonfirmasi sebelum kolomnya ada.
 *
 * Dengan konfirmasi N sesi (aturan-konfirmasi-sesi.ts) jaraknya terkecil dari
 * sesi ini dan N−1 sebelumnya; tembakan yang lebih tua dari posisi tersimpan
 * tidak dihitung, jadi yang menentukan hanya sesi-sesi SESUDAH konfirmasi.
 */
async function bergeserLagi(
  posisiTeks: string | null,
  prismaSiklus: ReadonlyArray<{
    idPrisma: string;
    bacaan?: BarisRts;
    bacaanLalu?: ReadonlyArray<(BarisRts & { id: number }) | undefined>;
    batasMm?: number;
  }>,
  rotasi: Parameters<typeof rotateEN>[2] | null
): Promise<Array<{ idPrisma: string; geserMm: number | null; batasMm: number }>> {
  const posisi = uraiPosisiDikonfirmasi(posisiTeks);
  const ids = Object.values(posisi);
  if (ids.length === 0) return [];
  const baris = await prisma.$queryRaw<Array<{ id: number } & BarisRts>>`
    SELECT id, sensor1, sensor7, sensor8, sensor9, sensor10 FROM rts WHERE id IN (${Prisma.join(ids)})
  `;
  const peta = new Map(baris.map((b) => [Number(b.id), b]));
  const hitung = prismaSiklus.flatMap((p) => {
    const idPosisi = posisi[p.idPrisma];
    const acuan = peta.get(idPosisi);
    if (!acuan || !p.bacaan || p.batasMm === undefined) return [];
    const lalu = p.bacaanLalu ?? [];
    const geserMm = geserTerkonfirmasi(
      pergeseranMm(p.bacaan, acuan, rotasi),
      lalu.map((b) => (b && b.id >= idPosisi ? pergeseranMm(b, acuan, rotasi) : null)),
      lalu.length + 1
    );
    return [{ idPrisma: p.idPrisma, geserMm, batasMm: p.batasMm }];
  });
  return bergeserSesudahKonfirmasi(hitung);
}

/**
 * Matikan bunyi kejadian yang berbunyi pada jam malam terlalu lama tanpa
 * konfirmasi (perluBungkamMalam). Dipanggil cron tiap menit lewat
 * POST /api/jadwal-running/senyap-malam. Kejadiannya tetap belum dikonfirmasi;
 * yang berubah hanya sirene (level 0 lewat sinkronEws) dan suara peramban.
 *
 * Mengembalikan kejadian yang barusan dibungkam beserta teks kabarnya; pemanggil
 * yang mengirim kabar. Galat satu kejadian tidak menghentikan yang lain.
 */
export async function jalankanSenyapMalam(
  sekarang: Date = sekarangDb()
): Promise<Array<{ id: number; site: string; ews: HasilEws; teks: string }>> {
  const hasil: Array<{ id: number; site: string; ews: HasilEws; teks: string }> = [];
  const calon = await prisma.kejadianAlarm.findMany({
    where: { pulih: null, dikonfirmasi: null, dibungkam: null, NOT: { tingkat_terakhir: "Normal" } },
  });
  for (const k of calon) {
    try {
      const cfg = await getSite(k.site);
      const tingkat = asStatusLabel(k.tingkat_terakhir) ?? "Normal";
      const perlu = perluBungkamMalam(
        {
          aktif: true,
          tingkatTerakhir: tingkat,
          dikonfirmasi: false,
          dibungkam: false,
          // getTime() di kedua sisi: keduanya jam dinding, selisihnya benar.
          berbunyiSejakMs: (k.berbunyi_sejak ?? k.mulai).getTime(),
        },
        cfg.senyapMalam,
        sekarang.getTime()
      );
      if (!perlu) continue;

      const waktu = teksWaktuDb(sekarang) ?? "";
      const ubah = await prisma.kejadianAlarm.updateMany({
        where: { id: k.id, pulih: null, dikonfirmasi: null, dibungkam: null, tingkat_terakhir: k.tingkat_terakhir },
        data: {
          dibungkam: sekarang,
          tingkat_dibungkam: tingkat,
          // Bergeser lagi dari posisi ini membunyikannya lagi.
          posisi_dibungkam: await posisiPrismaSekarang(k.site).catch(() => null),
          catatan: tambahCatatan(k.catatan, barisCatatanBungkam(waktu, cfg.senyapMalam.menit)),
        },
      });
      if (ubah.count === 0) continue;

      const ews = await sinkronEws(k.site, cfg.idLoggerEws, tingkat);
      console.log(`[peringatan][senyap-malam] ${k.site} #${k.id}: ${tingkat} dibungkam, ews=${ews}`);
      hasil.push({
        id: k.id,
        site: k.site,
        ews,
        teks: teksBungkamMalam({
          namaSite: cfg.nama,
          tingkat,
          mulai: teksWaktuDb(k.mulai) ?? "",
          waktu,
          menit: cfg.senyapMalam.menit,
          ews,
        }),
      });
    } catch (e) {
      console.error(`[peringatan][senyap-malam] #${k.id} ${k.site}: gagal (diabaikan):`, e instanceof Error ? e.message : e);
    }
  }
  return hasil;
}

/**
 * Tembakan sah terakhir tiap prisma site ini sebagai {"P1": rts.id, ...}, untuk
 * posisi_dikonfirmasi. Tembakan gagal (koordinat nol) dilewati.
 */
export async function posisiPrismaSekarang(site: string): Promise<string | null> {
  const baris = await prisma.$queryRaw<Array<{ id: number; sensor1: string }>>`
    SELECT r.id, r.sensor1
    FROM rts r JOIN log_kontrol l ON l.id_log = r.id_kontrol
    WHERE l.site = ${site} AND r.sensor16 = 1 AND r.sensor1 LIKE 'P%'
      AND (r.sensor8 NOT IN ('0', '') OR r.sensor9 NOT IN ('0', '') OR r.sensor10 NOT IN ('0', ''))
    ORDER BY r.id DESC
    LIMIT 3000
  `;
  const hasil: Record<string, number> = {};
  for (const b of baris) if (!(b.sensor1 in hasil)) hasil[b.sensor1] = Number(b.id);
  return Object.keys(hasil).length > 0 ? JSON.stringify(hasil) : null;
}

/**
 * Samakan perangkat EWS dengan `tingkat` site, memperhitungkan senyap dari
 * konfirmasi operator. Mengirim hanya bila berbeda dari yang terakhir terkirim.
 *
 * TIDAK PERNAH melempar — kegagalan sirene tidak boleh menggugurkan pesan
 * peringatan atau balasan API konfirmasi. status_ews ditulis HANYA setelah
 * terbit berhasil, sehingga terbit yang gagal diulang di siklus berikutnya.
 */
export async function sinkronEws(
  site: string,
  idLoggerEws: string | null,
  tingkat: StatusLabel
): Promise<HasilEws> {
  const tag = "[peringatan][ews]";
  if (!idLoggerEws) {
    // Bukan galat: site tanpa EWS memang wajar. Dicatat hanya saat ada bahaya,
    // supaya operator yang heran kenapa sirene diam bisa menemukan alasannya
    // tanpa log ini terisi tiap siklus.
    if (tingkat !== "Normal") {
      console.log(`${tag} ${site}: ${tingkat}, logger EWS belum diisi — dilewati`);
    }
    return "tanpa-ews";
  }
  // Dibaca terpisah: kalau tabel kejadian bermasalah, sirene tetap mengikuti
  // tingkat site apa adanya — lebih baik berbunyi tanpa senyap daripada diam.
  let dikonfirmasi: StatusLabel | null = null;
  if (tingkat !== "Normal") {
    try {
      // Konfirmasi, atau bila belum dikonfirmasi, senyap jam malam.
      const k = await kejadianAktif(site);
      dikonfirmasi = k
        ? tingkatTersenyap({
            tingkatDikonfirmasi: asStatusLabel(k.tingkat_dikonfirmasi),
            tingkatDibungkam: asStatusLabel(k.tingkat_dibungkam),
          })
        : null;
    } catch (e) {
      console.error(`${tag} ${site}: baca kejadian gagal, senyap diabaikan:`, e instanceof Error ? e.message : e);
    }
  }
  const tujuan = tingkatUntukEws(tingkat, dikonfirmasi);

  try {
    const baris = await prisma.statusEws.findUnique({ where: { site } });
    const terakhir: EwsTerkirim | null = baris
      ? { idLoggerEws: baris.id_logger_ews, tingkat: asStatusLabel(baris.tingkat) ?? "Normal" }
      : null;
    if (!perluKirimEws(terakhir, idLoggerEws, tujuan)) return "sudah";

    const ok = await sendEwsLevel(idLoggerEws, tujuan);
    const dari = terakhir ? `${terakhir.tingkat}@${terakhir.idLoggerEws}` : "belum pernah";
    const senyap = tujuan !== tingkat ? ` (${tingkat} disenyapkan konfirmasi atau senyap otomatis)` : "";
    console.log(
      `${tag} ${site}: ${dari} → ${tujuan}${senyap} ke sub_${idLoggerEws} ` +
        (ok ? "terkirim" : "GAGAL terbit — diulang di siklus berikutnya")
    );
    if (!ok) return "gagal";

    const dikirim = sekarangDb();
    await prisma.statusEws.upsert({
      where: { site },
      create: { site, id_logger_ews: idLoggerEws, tingkat: tujuan, dikirim },
      update: { id_logger_ews: idLoggerEws, tingkat: tujuan, dikirim },
    });
    return "terkirim";
  } catch (e) {
    console.error(`${tag} ${site}: gagal (diabaikan):`, e instanceof Error ? e.message : e);
    return "gagal";
  }
}
