/**
 * Hitung ulang E/N/Z riwayat tembakan satu site dari HA/VA/SD mentahnya.
 *
 * Dipakai setiap kali parameter rumus koordinat site berubah — nol set
 * (ha_orientasi_deg), koordinat atau tinggi alat. Kalau hanya data baru yang
 * memakai parameter baru, setiap prisma tampak melompat terhadap R0 dan EWS
 * berbunyi palsu. Jadi R0 dan seluruh riwayat sesi site ini ikut disusun
 * ulang dengan parameter yang sama.
 *
 * Aman diulang: yang ditulis hanya turunannya (sensor8/9/10); sudut dan jarak
 * mentah (sensor5/6/7) tidak pernah diubah, jadi menjalankannya dua kali
 * memberi angka yang sama persis.
 *
 * Site sebuah baris ditentukan sesinya (log_kontrol.site), bukan loggernya.
 * Tembakan gagal dan laporan menit dilewati — perbaikiTembakan() menolak SD 0
 * dan sudut kosong. Salinan tanpa sudut meminjam sudut baris saudara (prisma
 * sama, sesi sama), seperti di /api/datamasuk/adr.
 *
 * Asal: scripts/perbaiki-azimut-rts.ts (September 2026), dipindah ke sini
 * supaya bisa dipanggil dari Prism Config saat nol set diterapkan.
 */
import type { PrismaClient } from "@prisma/client";
import { perbaikiTembakan, sudutKosong, tulisKoordinat, type KoreksiAzimut } from "./koreksi-azimut";

type Baris = {
  id: number;
  id_kontrol: string;
  sensor1: string;
  sensor3: string | null;
  sensor5: string;
  sensor6: string;
  sensor7: string;
  sensor8: string;
  sensor9: string;
  sensor10: string;
};

export interface LaporanTabel {
  tabel: "rts" | "temp_rts";
  baris: number;
  berubah: number;
  dilewati: number;
  pinjamSudut: number;
  rataGeserM: number;
  maksGeserM: number;
  contoh: string[];
}

export interface LaporanHitungUlang {
  diterapkan: boolean;
  /** Batas pemasangan yang dipakai ("YYYY-MM-DD HH:MM:SS"), null = semua sesi. */
  sejak: string | null;
  /** Sesi site ini sebelum `sejak` — tidak disentuh. */
  sesiDilewati: number;
  tabel: LaporanTabel[];
  /** Baris temp_prisma yang disegarkan dari tembakan terakhir tiap prisma. */
  tempPrisma: number;
}

/**
 * "2026-11-27T08:00", "2026-11-27 08:00:00" -> "2026-11-27 08:00:00"; kosong -> null;
 * bentuk lain -> undefined (tidak sah). Waktu DB naif (WIB), jadi dibiarkan teks
 * — tidak lewat Date, yang akan menggesernya ke UTC.
 */
export function bacaSejak(v: unknown): string | null | undefined {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const m = String(v).trim().match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return undefined;
  return `${m[1]} ${m[2]}:${m[3]}:${m[4] ?? "00"}`;
}

export async function hitungUlangKoordinat(
  db: PrismaClient,
  site: string,
  k: KoreksiAzimut,
  terapkan: boolean,
  sejak: string | null = null
): Promise<LaporanHitungUlang> {
  const [lewat] = await db.$queryRawUnsafe<Array<{ n: bigint | number }>>(
    `SELECT COUNT(*) AS n FROM log_kontrol WHERE site = ? AND ? IS NOT NULL AND datetime < ?`,
    site,
    sejak,
    sejak
  );
  const laporan: LaporanHitungUlang = {
    diterapkan: terapkan,
    sejak,
    sesiDilewati: Number(lewat?.n ?? 0),
    tabel: [],
    tempPrisma: 0,
  };

  for (const tabel of ["rts", "temp_rts"] as const) {
    // Sesi pemasangan sebelumnya punya nol set sendiri — tidak ikut diputar.
    const baris = await db.$queryRawUnsafe<Baris[]>(
      `SELECT t.id, t.id_kontrol, t.sensor1, t.sensor3, t.sensor5, t.sensor6, t.sensor7,
              t.sensor8, t.sensor9, t.sensor10
         FROM \`${tabel}\` t
         JOIN log_kontrol l ON l.id_log = t.id_kontrol
        WHERE l.site = ? AND (? IS NULL OR l.datetime >= ?)
        ORDER BY t.id`,
      site,
      sejak,
      sejak
    );

    const sudutSaudara = new Map<string, { ha: string; va: string }>();
    for (const b of baris) {
      if (sudutKosong(b.sensor5) || sudutKosong(b.sensor6)) continue;
      const kunci = `${b.id_kontrol}|${b.sensor1}`;
      if (!sudutSaudara.has(kunci)) sudutSaudara.set(kunci, { ha: b.sensor5, va: b.sensor6 });
    }

    const lap: LaporanTabel = {
      tabel,
      baris: baris.length,
      berubah: 0,
      dilewati: 0,
      pinjamSudut: 0,
      rataGeserM: 0,
      maksGeserM: 0,
      contoh: [],
    };
    let totalGeser = 0;
    const tulis: Array<[string, string, string, number]> = [];

    for (const b of baris) {
      const E = Number(b.sensor8);
      const N = Number(b.sensor9);
      const Z = Number(b.sensor10);
      const sendiri = !sudutKosong(b.sensor5) && !sudutKosong(b.sensor6);
      const pinjam = sendiri ? undefined : sudutSaudara.get(`${b.id_kontrol}|${b.sensor1}`);
      const baru = perbaikiTembakan(sendiri ? b.sensor5 : pinjam?.ha, sendiri ? b.sensor6 : pinjam?.va, b.sensor7, k);
      if (!baru) {
        lap.dilewati++;
        continue;
      }
      const geser = Number.isFinite(E) && Number.isFinite(N) ? Math.hypot(baru.E - E, baru.N - N) : Infinity;
      const geserZ = Number.isFinite(Z) ? Math.abs(baru.Z - Z) : Infinity;
      // Baris yang sudah benar tidak ditulis ulang: menjalankannya lagi
      // sesudah semuanya beres harus melaporkan nol perubahan.
      if (geser < 0.0005 && geserZ < 0.0005) {
        lap.dilewati++;
        continue;
      }
      lap.berubah++;
      if (!sendiri) lap.pinjamSudut++;
      if (Number.isFinite(geser)) {
        totalGeser += geser;
        lap.maksGeserM = Math.max(lap.maksGeserM, geser);
      }
      if (lap.contoh.length < 6) {
        lap.contoh.push(
          `${(b.sensor3 || b.sensor1).padEnd(6)} sesi ${b.id_kontrol}  ` +
            `${E.toFixed(1)}, ${N.toFixed(1)}, z${Z.toFixed(1)}  ->  ` +
            `${baru.E.toFixed(1)}, ${baru.N.toFixed(1)}, z${baru.Z.toFixed(1)}`
        );
      }
      tulis.push([tulisKoordinat(baru.E), tulisKoordinat(baru.N), tulisKoordinat(baru.Z), b.id]);
    }
    lap.rataGeserM = lap.berubah > 0 ? totalGeser / lap.berubah : 0;

    if (terapkan && tulis.length > 0) {
      // Satu transaksi per potongan: pembaca tidak pernah melihat sesi yang
      // separuh baris lama, separuh baris baru lebih lama dari satu potongan.
      for (let i = 0; i < tulis.length; i += 500) {
        const potong = tulis.slice(i, i + 500);
        await db.$transaction(
          potong.map(([e, n, z, id]) =>
            db.$executeRawUnsafe(`UPDATE \`${tabel}\` SET sensor8 = ?, sensor9 = ?, sensor10 = ? WHERE id = ?`, e, n, z, id)
          )
        );
      }
    }
    laporan.tabel.push(lap);
  }

  if (terapkan) {
    // temp_prisma = tembakan terakhir tiap prisma. Ditimpa ingest tiap siklus,
    // tapi sampai siklus berikutnya Dashboard dan 3D akan menampilkan posisi
    // lama — jadi disegarkan dari baris rts terakhir yang baru dihitung ulang.
    // Baris terakhir apa adanya, termasuk tembakan gagal (0/0/0): itu yang
    // juga ditulis ingest. Pemetaan kolomnya mengikuti datamasuk-adr.ts
    // (N1 = sensor8, dst.).
    laporan.tempPrisma = await db.$executeRawUnsafe(
      `UPDATE temp_prisma tp
         JOIN (
           SELECT r.sensor1, r.sensor8, r.sensor9, r.sensor10
             FROM rts r
             JOIN (
               SELECT t.sensor1, MAX(t.id) AS id
                 FROM rts t
                 JOIN log_kontrol l ON l.id_log = t.id_kontrol
                WHERE l.site = ? AND (? IS NULL OR l.datetime >= ?)
                GROUP BY t.sensor1
             ) akhir ON akhir.id = r.id
         ) x ON x.sensor1 = tp.id_prisma
          SET tp.N1 = x.sensor8, tp.E1 = x.sensor9, tp.Z1 = x.sensor10
        WHERE tp.site = ?`,
      site,
      sejak,
      sejak,
      site
    );
  }

  return laporan;
}
