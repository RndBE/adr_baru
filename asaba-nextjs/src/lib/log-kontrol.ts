/**
 * Sesi running (`log_kontrol`) — pembuatannya dan aturan acuan R0.
 *
 * Aturan R0 dulu ditulis ulang di /api/deformasi dan di guard penghapusan sesi.
 * Begitu salah satunya berubah, guard berhenti menunjuk sesi yang sama dengan
 * yang benar-benar dipakai menghitung, dan acuan sungguhan bisa terhapus tanpa
 * penolakan apa pun.
 *
 * Pembuatan sesi ada di sini karena alasan yang sama: sejak /api/datamasuk/adr
 * ikut membuka sesi untuk siklus yang dimulai sendiri oleh logger, ada DUA
 * tempat yang menulis baris `log_kontrol`. Bentuk `id_log` dan daftar kolomnya
 * harus sama persis di keduanya, kalau tidak riwayat berisi dua jenis baris
 * yang berperilaku beda.
 */
import { prisma } from "@/lib/prisma";
import { waktuMsWib } from "@/components/monitoring/format";
import {
  bolehAdopsiSesi,
  pilihSiteSesi,
  type AsalSesi,
} from "@/lib/sesi-kontrol";

/**
 * Sesi yang jadi acuan deformasi untuk satu site.
 *
 * Dua langkah, dan langkah keduanya yang gampang terlupa: kalau tidak ada sesi
 * bertanda `r0 = 1`, yang dipakai adalah sesi TERTUA site itu. Artinya sesi
 * tertua ikut menentukan hasil walau tidak pernah ditandai apa pun.
 */
export async function cariAcuanR0(site: string): Promise<string | null> {
  const bertanda = await prisma.logKontrol.findFirst({ where: { site, r0: 1 } });
  if (bertanda) return bertanda.id_log;

  const tertua = await prisma.logKontrol.findFirst({
    where: { site },
    orderBy: { datetime: "asc" },
  });
  return tertua?.id_log ?? null;
}

/**
 * `id_log` dari jam dinding sesi, dijamin belum terpakai.
 *
 * Bentuknya tetap HHMMSS supaya sama dengan seluruh baris yang sudah ada. Yang
 * baru cuma pemeriksaan tabrakannya: `id_log` adalah PRIMARY KEY, tapi isinya
 * hanya jam TANPA tanggal, jadi dua sesi pada detik yang sama di hari berbeda
 * bertabrakan dan insert-nya ditolak.
 *
 * Selama sesi hanya lahir dari tombol Mulai, peluangnya kecil. Dengan jadwal
 * AutoTracking peluangnya jadi besar: `trackEvery` menjalankan siklus pada
 * menit yang berulang tiap hari, dan siklus yang dimulai jam 06:00:00 hari ini
 * bertemu id milik siklus 06:00:00 kemarin. Karena itu tabrakan diberi akhiran,
 * bukan dibiarkan jadi galat 500 yang membuang seluruh payload logger.
 *
 * Akhirannya aman untuk kolom varchar(20) dan untuk pembaca id_log mana pun:
 * tidak ada satu pun kode yang mengurai id ini sebagai angka, dan sesi contoh
 * bawaan basis data sendiri sudah memakai bentuk non-numerik (`PPU00001`).
 */
export async function idLogUnik(waktuDb: string): Promise<string> {
  const jam = (waktuDb.split(" ")[1] ?? "").replace(/\D/g, "");
  const dasar = (jam || "000000").padEnd(6, "0").slice(0, 6);

  for (let i = 0; i < 50; i++) {
    const kandidat = i === 0 ? dasar : `${dasar}-${i + 1}`;
    const ada = await prisma.$queryRaw<Array<{ id_log: string }>>`
      SELECT id_log FROM log_kontrol WHERE id_log = ${kandidat} LIMIT 1
    `;
    if (ada.length === 0) return kandidat;
  }

  // 50 sesi pada detik yang sama berarti ada yang salah jauh di hulu; id acak
  // tetap lebih baik daripada payload yang hilang.
  return `${dasar}-${Math.random().toString(36).slice(2, 8)}`;
}

export type SesiKontrol = {
  idLog: string;
  site: string | null;
  /** true = baris `log_kontrol` baru saja dibuat panggilan ini. */
  baru: boolean;
  asal: AsalSesi;
};

/** Sesi terakhir logger ini, apa adanya — tanpa membuat apa pun. */
export async function sesiTerakhirLogger(
  idLogger: string
): Promise<{ idLog: string; site: string | null; datetime: string | Date | null } | null> {
  const baris = await prisma.$queryRaw<
    Array<{ id_log: string; site: string | null; datetime: string | Date | null }>
  >`
    SELECT id_log, site, datetime
    FROM log_kontrol
    WHERE id_logger = ${idLogger}
    ORDER BY datetime DESC
    LIMIT 1
  `;
  const b = baris[0];
  return b ? { idLog: b.id_log, site: b.site, datetime: b.datetime } : null;
}

/**
 * Buat baris sesi baru, dan siapkan kartu prisma site-nya.
 *
 * Reset `status_get` ikut di sini, sama seperti yang dilakukan tombol Mulai:
 * tanpa itu panel Hasil prisma menampilkan koordinat sesi SEBELUMNYA dengan
 * label "Berhasil" selama siklus baru berjalan, seolah hasilnya sudah masuk
 * padahal instrumennya baru mulai menyapu.
 *
 * Site null berarti tidak ada yang bisa ditebak dengan aman (lihat
 * `pilihSiteSesi`). Sesinya tetap dibuat — pengukurannya tidak boleh hilang —
 * tapi tidak ada baris prisma yang disentuh, daripada menyentuh milik site yang
 * salah.
 */
export async function buatSesiKontrol(opsi: {
  idLogger: string;
  site: string | null;
  waktuDb: string;
  asal: AsalSesi;
}): Promise<SesiKontrol> {
  const idLog = await idLogUnik(opsi.waktuDb);

  // Semua kolom disebut eksplisit. `prisma` dan `r0` NOT NULL tanpa bawaan di
  // basis data lama, dan di server ber-sql_mode STRICT_TRANS_TABLES insert yang
  // melewatkannya ditolak — itulah yang selama ini membuat tombol Mulai gagal
  // SESUDAH menyetel set_tempkontrol dan sebelum mengirim MQTT.
  await prisma.$executeRaw`
    INSERT INTO log_kontrol (id_log, id_logger, prisma, datetime, r0, site, dipicu)
    VALUES (${idLog}, ${opsi.idLogger}, '', ${opsi.waktuDb}, 0, ${opsi.site}, ${opsi.asal})
  `;

  if (opsi.site) {
    await prisma.$executeRaw`
      UPDATE temp_prisma SET status_get = 0 WHERE site = ${opsi.site}
    `;
  }

  return { idLog, site: opsi.site, baru: true, asal: opsi.asal };
}

/**
 * Sesi yang harus mencatat siklus yang BARU SAJA mulai di instrumen.
 *
 * Dipanggil /api/datamasuk/adr begitu sensor16 naik jadi 1. Dua kemungkinan:
 *
 *   - Operator baru menekan Mulai dan sesinya sudah dibuat, cuma belum berisi
 *     apa-apa → sesi itu yang dipakai (`bolehAdopsiSesi`). Membuat sesi baru di
 *     sini akan meninggalkan sesi kosong yatim sekaligus memecah satu
 *     pengukuran jadi dua baris riwayat.
 *   - Tidak ada sesi yang menunggu → siklusnya dimulai sendiri oleh logger
 *     (jadwal AutoTracking, atau orang di panel instrumen), dan sesinya dibuat
 *     sekarang. Inilah yang selama ini tidak pernah terjadi, sehingga hasilnya
 *     menumpuk di sesi lama yang sudah selesai.
 *
 * Umur sesi dihitung terhadap jam PAYLOAD, bukan jam server: keduanya bisa
 * berselisih, dan yang menentukan "sudah berapa lama sesi ini menunggu" adalah
 * jam yang sama dengan yang dipakai menulis barisnya.
 */
export async function sesiUntukSiklus(opsi: {
  idLogger: string;
  waktuDb: string;
}): Promise<SesiKontrol> {
  const terakhir = await sesiTerakhirLogger(opsi.idLogger);
  const sekarangMs = waktuMsWib(opsi.waktuDb) ?? Date.now();

  if (terakhir) {
    const isi = await prisma.$queryRaw<Array<{ ada: number }>>`
      SELECT 1 AS ada FROM rts WHERE id_kontrol = ${terakhir.idLog} LIMIT 1
    `;
    const umurMs = (() => {
      const ms = waktuMsWib(terakhir.datetime);
      return ms === null ? null : sekarangMs - ms;
    })();

    if (bolehAdopsiSesi({ kosong: isi.length === 0, umurMs })) {
      return { idLog: terakhir.idLog, site: terakhir.site, baru: false, asal: "operator" };
    }
  }

  const siteLogger = await prisma.$queryRaw<Array<{ slug: string }>>`
    SELECT slug FROM t_site WHERE id_logger = ${opsi.idLogger} AND aktif = 1 ORDER BY slug
  `;

  return buatSesiKontrol({
    idLogger: opsi.idLogger,
    site: pilihSiteSesi(
      siteLogger.map((s) => s.slug),
      terakhir?.site ?? null
    ),
    waktuDb: opsi.waktuDb,
    asal: "logger",
  });
}
