/**
 * Acuan baru per prisma sesudah arah bidiknya diperbarui — sisi basis data.
 * Aturan dan alasannya di aturan-acuan.ts; tabelnya dibuat migrasi 025.
 *
 * Dipakai evaluasi-siklus.ts dan /api/deformasi (acuanBerlaku) dan langkah
 * "simpan" Perbarui arah bidik (tetapkanAcuanPrisma).
 */
import { prisma } from "@/lib/prisma";
import { nfloat } from "@/lib/coordinates";
import { type BarisRts, pergeseranMm } from "@/lib/pergeseran";
import { getSite } from "@/lib/sites";
import { type StatusLabel, asStatusLabel, indeksStatus, statusPergeseran } from "@/lib/ambang";
import { ambangDenganToleransi, toleransiMm } from "@/lib/akurasi-rts";
import { tingkatSite } from "@/lib/ews";
import { prismaPuncak } from "@/lib/aturan-kejadian";
import { type AcuanBaru, acuanTerbaru, catatanAcuanBaru, teksAcuanBaru } from "@/lib/aturan-acuan";
import { catatKejadian, sekarangDb, sinkronEws, teksWaktuDb } from "@/lib/kejadian-alarm";
import { kirimKabar } from "@/lib/kirim-peringatan";

export interface AcuanBerlaku {
  id: number;
  idPrisma: string;
  /** rts.id tembakan acuan. */
  idRts: number;
  /** Sesi tembakan acuan. */
  idLog: string;
  /** Waktu tembakan acuan, "YYYY-MM-DD HH:mm:ss". */
  waktuTembakan: string;
  baris: BarisRts;
}

type BarisTembakan = {
  id: number;
  id_kontrol: string;
  waktu: string;
  sensor1: string;
  sensor7: string;
  sensor8: string;
  sensor9: string;
  sensor10: string;
};

function keBarisRts(b: BarisTembakan): BarisRts {
  return { sensor1: b.sensor1, sensor7: b.sensor7, sensor8: b.sensor8, sensor9: b.sensor9, sensor10: b.sensor10 };
}

function terukur(b: BarisRts): boolean {
  return nfloat(b.sensor8) !== 0 || nfloat(b.sensor9) !== 0 || nfloat(b.sensor10) !== 0;
}

/**
 * Acuan baru yang berlaku untuk sesi `idLog`: terbaru per prisma di antara
 * yang sesi tembakannya dimulai SEBELUM sesi itu. Prisma yang tidak ada di
 * peta dihitung terhadap R0.
 *
 * Kosong (dan dicatat) bila kuerinya gagal, mis. migrasi 025 belum
 * dijalankan — perhitungan kembali ke R0, seperti sebelum fitur ini ada.
 */
export async function acuanBerlaku(site: string, idLog: string): Promise<Map<string, AcuanBerlaku>> {
  try {
    const baris = await prisma.$queryRaw<Array<BarisTembakan & { id_acuan: number; id_prisma: string }>>`
      SELECT a.id AS id_acuan, a.id_prisma, r.id, r.id_kontrol,
             DATE_FORMAT(r.waktu, '%Y-%m-%d %H:%i:%s') AS waktu,
             r.sensor1, r.sensor7, r.sensor8, r.sensor9, r.sensor10
      FROM acuan_prisma a
      JOIN rts r ON r.id = a.id_rts
      JOIN log_kontrol la ON la.id_log = a.id_log
      JOIN log_kontrol s ON s.id_log = ${idLog}
      WHERE a.site = ${site} AND la.datetime < s.datetime
    `;
    return acuanTerbaru(
      baris.map((b) => ({
        id: Number(b.id_acuan),
        idPrisma: b.id_prisma,
        idRts: Number(b.id),
        idLog: b.id_kontrol,
        waktuTembakan: b.waktu,
        baris: keBarisRts(b),
      }))
    );
  } catch (e) {
    console.error(`[acuan-prisma] ${site}: acuan baru tidak terbaca, dihitung terhadap R0:`, e instanceof Error ? e.message : e);
    return new Map();
  }
}

/** Tembakan pertama prisma di sesi R0 bertanda — acuan bawaannya. */
async function tembakanR0(site: string, idPrisma: string): Promise<BarisRts | undefined> {
  const r0 = await prisma.logKontrol.findFirst({ where: { site, r0: 1 }, select: { id_log: true } });
  if (!r0) return undefined;
  const baris = await prisma.$queryRaw<BarisRts[]>`
    SELECT sensor1, sensor7, sensor8, sensor9, sensor10
    FROM rts WHERE id_kontrol = ${r0.id_log} AND sensor1 = ${idPrisma}
    ORDER BY id ASC LIMIT 1
  `;
  return baris[0];
}

export interface HasilAcuanBaru extends AcuanBaru {
  /** log_peringatan.id baris perubahan tingkatnya, bila tingkatnya berubah. */
  idLogPeringatan: number | null;
  teks: string;
}

/**
 * Tetapkan tembakan bersudut HA/VA ini sebagai acuan baru prisma, lalu setel
 * ulang statusnya, kejadian, dan sirene site. Dipanggil sesudah t_prisma.HA/VA
 * disimpan pada Perbarui arah bidik.
 *
 * Tembakannya dicari dari sudutnya — sudut yang barusan ditulis ke slot itu
 * diambil arah-bidik/route.ts dari tembakan sah terakhir prisma ini. Null bila
 * tidak ketemu (arah bidiknya tetap tersimpan; statusnya saja yang tidak
 * berubah).
 *
 * Pesan WhatsApp-nya TIDAK dikirim di sini: pemanggil memakai
 * kabarkanAcuanBaru() di after(), supaya dialog tidak menunggu WhatsApp.
 */
export async function tetapkanAcuanPrisma(o: {
  site: string;
  idPrisma: string;
  HA: string;
  VA: string;
  oleh: string;
  idKejadian: number | null;
}): Promise<HasilAcuanBaru | null> {
  const { site, idPrisma } = o;
  const tag = `[acuan-prisma] ${site} ${idPrisma}`;

  const calon = await prisma.$queryRaw<BarisTembakan[]>`
    SELECT r.id, r.id_kontrol, DATE_FORMAT(r.waktu, '%Y-%m-%d %H:%i:%s') AS waktu,
           r.sensor1, r.sensor7, r.sensor8, r.sensor9, r.sensor10
    FROM rts r JOIN log_kontrol l ON l.id_log = r.id_kontrol
    WHERE l.site = ${site} AND r.sensor1 = ${idPrisma} AND r.sensor16 = 1
      AND TRIM(r.sensor5) = ${o.HA} AND TRIM(r.sensor6) = ${o.VA}
    ORDER BY r.id DESC
    LIMIT 20
  `;
  const tembakan = calon.find((b) => terukur(keBarisRts(b)));
  if (!tembakan) {
    console.warn(`${tag}: tidak ada tembakan sah bersudut ${o.HA}/${o.VA} — acuan tidak diganti`);
    return null;
  }
  const barisTembakan = keBarisRts(tembakan);
  const cfg = await getSite(site);

  // Yang diterima: pergeseran tembakan itu terhadap acuan yang berlaku di
  // sesinya (acuan baru sebelumnya, atau R0).
  const acuanLama =
    (await acuanBerlaku(site, tembakan.id_kontrol)).get(idPrisma)?.baris ?? (await tembakanR0(site, idPrisma));
  const geserDiterimaMm = pergeseranMm(barisTembakan, acuanLama, cfg.rotation);

  const ditetapkan = sekarangDb();
  await prisma.acuanPrisma.create({
    data: {
      site,
      id_prisma: idPrisma,
      id_rts: Number(tembakan.id),
      id_log: tembakan.id_kontrol,
      geser_diterima_mm: geserDiterimaMm,
      id_kejadian: o.idKejadian,
      ditetapkan,
      oleh: o.oleh,
    },
  });

  // ── Status prisma sekarang terhadap acuan baru ─────────────────────────────
  //
  // Biasanya tembakan acuan itulah bacaan terakhir prisma ini (pergeseran 0).
  // Bila sesudahnya sudah ada sesi yang dinilai, bacaan sesi itu yang dipakai.
  const sp = await prisma.statusPrisma.findUnique({ where: { site_id_prisma: { site, id_prisma: idPrisma } } });
  let idLogNilai = tembakan.id_kontrol;
  let nilaiMm = 0;
  if (sp?.siklus_terakhir && sp.siklus_terakhir !== tembakan.id_kontrol) {
    const lebihBaru = await prisma.$queryRaw<BarisRts[]>`
      SELECT r.sensor1, r.sensor7, r.sensor8, r.sensor9, r.sensor10
      FROM rts r
      JOIN log_kontrol s ON s.id_log = r.id_kontrol
      JOIN log_kontrol t ON t.id_log = ${tembakan.id_kontrol}
      WHERE r.id_kontrol = ${sp.siklus_terakhir} AND r.sensor1 = ${idPrisma} AND s.datetime > t.datetime
      ORDER BY r.id DESC LIMIT 1
    `;
    const mm = pergeseranMm(lebihBaru[0], barisTembakan, cfg.rotation);
    if (mm !== null) {
      nilaiMm = mm;
      idLogNilai = sp.siklus_terakhir;
    }
  }
  const ambangPrisma = ambangDenganToleransi(
    cfg.thresholds,
    toleransiMm(nfloat(barisTembakan.sensor7), cfg.akurasiRts)
  );
  const dari: StatusLabel = asStatusLabel(sp?.tingkat) ?? "Normal";
  const ke = statusPergeseran(nilaiMm, ambangPrisma);

  await prisma.statusPrisma.upsert({
    where: { site_id_prisma: { site, id_prisma: idPrisma } },
    create: {
      site, id_prisma: idPrisma,
      tingkat: ke, tingkat_calon: null, hitung_calon: 0,
      nilai_mm: nilaiMm, siklus_terakhir: tembakan.id_kontrol, gagal_beruntun: 0,
    },
    update: { tingkat: ke, tingkat_calon: null, hitung_calon: 0, nilai_mm: nilaiMm },
  });

  let idLogPeringatan: number | null = null;
  if (dari !== ke) {
    const log = await prisma.logPeringatan.create({
      data: {
        site, id_prisma: idPrisma, id_log: idLogNilai, dari, ke, nilai_mm: nilaiMm,
        waktu: ditetapkan, terkirim: false, galat: "acuan baru: arah bidik diperbarui",
      },
    });
    idLogPeringatan = log.id;
  }

  // ── Kejadian dan sirene site ───────────────────────────────────────────────
  //
  // Prisma yang masih terdaftar saja, seperti evaluasiSiklus. Turun ke Normal
  // semua = kejadian ditutup dan sirene Aman.
  const [terdaftar, semuaStatus] = await Promise.all([
    prisma.$queryRaw<Array<{ id_prisma: string }>>`SELECT id_prisma FROM t_prisma WHERE site = ${site}`,
    prisma.statusPrisma.findMany({ where: { site } }),
  ]);
  const ada = new Set(terdaftar.map((p) => p.id_prisma));
  const semua = semuaStatus
    .filter((s) => ada.has(s.id_prisma))
    .map((s) => ({ idPrisma: s.id_prisma, tingkat: asStatusLabel(s.tingkat) ?? "Normal", nilaiMm: s.nilai_mm }));
  const tingkat = tingkatSite(semua.map((p) => p.tingkat));
  const puncak = prismaPuncak(semua);
  await catatKejadian({
    site,
    tingkat,
    puncak: puncak && puncak.tingkat !== "Normal" ? { idPrisma: puncak.idPrisma, nilaiMm: puncak.nilaiMm } : null,
    idLog: idLogNilai,
    waktuMs: Date.now(),
    prisma: semua,
  });
  await sinkronEws(site, cfg.idLoggerEws, tingkat);

  const isi: AcuanBaru = {
    namaSite: cfg.nama,
    idPrisma,
    oleh: o.oleh,
    waktu: teksWaktuDb(ditetapkan) ?? "",
    waktuTembakan: tembakan.waktu,
    geserDiterimaMm,
    dari,
    ke,
    nilaiMm,
    tingkatSite: tingkat,
    masihAlarm: semua
      .filter((p) => p.tingkat !== "Normal")
      .sort((a, b) => indeksStatus(b.tingkat) - indeksStatus(a.tingkat)),
  };

  if (o.idKejadian) {
    const k = await prisma.kejadianAlarm.findUnique({ where: { id: o.idKejadian }, select: { catatan: true } });
    if (k) {
      await prisma.kejadianAlarm.update({
        where: { id: o.idKejadian },
        data: { catatan: catatanAcuanBaru(k.catatan, isi) },
      });
    }
  }

  console.log(
    `${tag}: acuan baru rts #${tembakan.id} (sesi ${tembakan.id_kontrol}, ${tembakan.waktu}), ` +
      `diterima ${geserDiterimaMm === null ? "—" : geserDiterimaMm.toFixed(1)} mm; ${dari} -> ${ke} ` +
      `(${nilaiMm.toFixed(1)} mm); site ${tingkat}; oleh ${o.oleh}`
  );
  return { ...isi, idLogPeringatan, teks: teksAcuanBaru(isi) };
}

/** Kirim kabar acuan baru, lalu tandai baris riwayatnya terkirim. Tidak pernah melempar. */
export async function kabarkanAcuanBaru(site: string, hasil: HasilAcuanBaru): Promise<string> {
  try {
    const status = await kirimKabar(site, hasil.teks);
    if (hasil.idLogPeringatan !== null) {
      const ok = /=ok\b/.test(status);
      await prisma.logPeringatan.update({
        where: { id: hasil.idLogPeringatan },
        data: { terkirim: ok, galat: ok ? "acuan baru: arah bidik diperbarui" : `acuan baru: ${status}`.slice(0, 255) },
      });
    }
    return status;
  } catch (e) {
    return `gagal: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** Dipakai saat R0 diganti: acuan baru per prisma ikut gugur. Tidak pernah melempar. */
export async function hapusAcuanSite(site: string): Promise<number> {
  try {
    return (await prisma.acuanPrisma.deleteMany({ where: { site } })).count;
  } catch (e) {
    console.warn(`[acuan-prisma] ${site}: acuan baru tidak dihapus (diabaikan):`, e instanceof Error ? e.message : e);
    return 0;
  }
}

/** Sesi ini menyimpan tembakan acuan baru sebuah prisma? Penjaga hapus sesi. */
export async function sesiAcuanPrisma(idLog: string): Promise<string[]> {
  try {
    const baris = await prisma.acuanPrisma.findMany({ where: { id_log: idLog }, select: { id_prisma: true }, distinct: ["id_prisma"] });
    return baris.map((b) => b.id_prisma);
  } catch {
    return [];
  }
}
