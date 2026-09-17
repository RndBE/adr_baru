import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cariAcuanR0 } from "@/lib/log-kontrol";
import { nfloat, rotateEN } from "@/lib/coordinates";
import { getSite } from "@/lib/sites";
import {
  bacaInterval,
  FORMAT_STEMPEL,
  resolusiInterval,
  type IntervalGabungan,
} from "@/lib/interval-gabungan";

/**
 * GET /api/analisa-gabungan
 *
 * Riwayat pergeseran BEBERAPA prisma satu site pada satu rentang waktu, untuk
 * halaman Analisa Gabungan.
 *
 * Bedanya dengan dua rute yang sudah ada, dan alasan rute ini perlu ada:
 *
 *   /api/deformasi terikat pada SATU sesi (`id_log`) dan riwayat hariannya
 *   hanya sepanjang tanggal sesi itu. Rentang bebas tidak bisa dimintanya.
 *
 *   /api/analisa melayani rentang bebas, tapi satu prisma satu kolom sensor per
 *   permintaan, dan mengembalikan koordinat UTM MENTAH — pemanggilnya harus
 *   menggabung tiga sumbu sendiri lalu memutar bingkainya (lihat
 *   components/monitoring/prism-history.ts). Untuk sepuluh prisma itu tiga
 *   puluh permintaan, dan tiga puluh kesempatan hasilnya tidak sinkron.
 *
 * Di sini pergeseran dihitung di server dengan aturan yang sama persis dengan
 * /api/deformasi — acuan R0 dari cariAcuanR0(), koreksi rotasi site, dan bacaan
 * gagal tembak disaring — lalu dikembalikan sudah dalam MILIMETER relatif R0.
 *
 * Query params:
 * - site   : slug site (wajib)
 * - dari   : "YYYY-MM-DD HH:MM:SS" jam dinding WIB (wajib)
 * - sampai : idem (wajib)
 * - prisma : daftar id_prisma dipisah koma (opsional; bawaan seluruh prisma site)
 * - interval: auto | mentah | jam | hari (opsional; bawaan auto)
 */

/** Batas baris yang ditarik sekali jalan. */
const BATAS_BARIS = 20000;
/** Rentang lebih panjang dari ini ditolak, bukan dipotong diam-diam. */
const MAKS_HARI = 366;

const WAKTU = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const site = searchParams.get("site");
    const dari = searchParams.get("dari");
    const sampai = searchParams.get("sampai");
    const pilihan = (searchParams.get("prisma") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const intervalPilihan = bacaInterval(searchParams.get("interval"));
    if (intervalPilihan === null) {
      // Ditolak, bukan dijatuhkan ke "auto". Halaman yang salah eja
      // parameternya akan menerima rata-rata per jam sambil menampilkan tombol
      // "Data mentah" dalam keadaan aktif — salah yang tidak terlihat.
      return NextResponse.json(
        { success: false, error: "interval harus auto, mentah, jam, atau hari" },
        { status: 400 }
      );
    }

    if (!site || !dari || !sampai) {
      return NextResponse.json(
        { success: false, error: "Parameter site, dari, dan sampai wajib diisi" },
        { status: 400 }
      );
    }
    // Bentuknya dikunci, bukan diserahkan ke MySQL. Stempel yang tidak dikenali
    // akan diam-diam jadi rentang kosong, dan grafik kosong itu terbaca sebagai
    // "tidak ada pergeseran" — padahal artinya "pertanyaannya tidak terkirim".
    if (!WAKTU.test(dari) || !WAKTU.test(sampai)) {
      return NextResponse.json(
        { success: false, error: "dari/sampai harus berbentuk YYYY-MM-DD HH:MM:SS" },
        { status: 400 }
      );
    }
    if (dari >= sampai) {
      return NextResponse.json(
        { success: false, error: "dari harus lebih awal dari sampai" },
        { status: 400 }
      );
    }
    const rentangHari =
      (Date.parse(`${sampai.replace(" ", "T")}Z`) - Date.parse(`${dari.replace(" ", "T")}Z`)) /
      86400000;
    if (rentangHari > MAKS_HARI) {
      return NextResponse.json(
        { success: false, error: `Rentang maksimal ${MAKS_HARI} hari` },
        { status: 400 }
      );
    }

    const siteConfig = await getSite(site);

    // Prisma milik SITE ini. id_prisma cuma nomor slot yang dipakai ulang antar
    // site, jadi penyaringnya harus site + slot — bukan slot saja.
    const prismaSite = await prisma.$queryRaw<
      Array<{ id_prisma: string; nama_prisma: string; id_logger: number | null }>
    >`
      SELECT id_prisma, nama_prisma, id_logger
      FROM t_prisma WHERE site = ${site} ORDER BY id_prisma
    `;
    const dipilih = pilihan.length
      ? prismaSite.filter((p) => pilihan.includes(p.id_prisma))
      : prismaSite;

    // Mode yang berlaku ikut dikirim pada jawaban kosong juga: halaman
    // memakainya untuk memberi label sumbu waktu, dan "mentah" yang dikarang
    // di sini akan tampil sebagai pilihan aktif yang tidak pernah diminta.
    const rapat = resolusiInterval(intervalPilihan, rentangHari);

    if (dipilih.length === 0) {
      return NextResponse.json({
        success: true,
        data: kosong(site, siteConfig, dari, sampai, null, intervalPilihan, rapat),
      });
    }

    const idR0 = await cariAcuanR0(site);
    if (!idR0) {
      // Tanpa acuan tidak ada yang bisa disebut "pergeseran". Dikembalikan
      // sebagai keadaan yang dijelaskan, bukan galat — halaman perlu tahu
      // bedanya "belum ada acuan" dan "permintaannya gagal".
      return NextResponse.json({
        success: true,
        data: kosong(site, siteConfig, dari, sampai, null, intervalPilihan, rapat),
      });
    }
    const [logR0] = await prisma.$queryRaw<Array<{ datetime: Date | null }>>`
      SELECT datetime FROM log_kontrol WHERE id_log = ${idR0} LIMIT 1
    `;

    const slot = dipilih.map(() => "?").join(",");
    const idSlot = dipilih.map((p) => p.id_prisma);

    // ── Acuan R0 tiap prisma ──
    // Satu kueri untuk semua, bukan satu per prisma: pada sesi acuan yang sama
    // itu perjalanan bolak-balik yang sia-sia.
    const barisR0 = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT sensor1, sensor8, sensor9, sensor10
       FROM rts WHERE id_kontrol = ? AND sensor1 IN (${slot})
       ORDER BY waktu ASC`,
      idR0,
      ...idSlot
    );

    type Acuan = { N: number; E: number; Z: number };
    const acuan = new Map<string, Acuan>();
    for (const b of barisR0) {
      const id = String(b.sensor1);
      if (acuan.has(id)) continue; // yang paling awal, sama dengan /api/deformasi
      // sensor8 = EASTING, sensor9 = NORTHING — kebalikan dari PROTOKOL_MQTT_ADR
      // bagian F, tapi sesuai isi tabelnya. Lihat catatan panjang di
      // /api/deformasi dan di CLAUDE.md: Easting UTM selalu 160.000-834.000,
      // jadi sensor9 yang bernilai ~9.748.000 tidak mungkin Easting.
      //
      // Besaran pergeseran tidak terpengaruh — hypot simetris — tapi SELURUH
      // keluaran arah halaman ini terpengaruh: bearing resultan, beda arah tiap
      // prisma, dan denah vektornya. Tertukar berarti kompasnya tercermin pada
      // diagonal timur laut, dan operator diberi tahu arah gerak yang salah.
      let E = nfloat(b.sensor8);
      let N = nfloat(b.sensor9);
      const Z = nfloat(b.sensor10);
      // Acuan yang seluruh sumbunya nol bukan acuan — prisma itu tidak pernah
      // benar-benar terbidik pada sesi R0, dan memakainya akan menghasilkan
      // pergeseran sebesar koordinat UTM penuh.
      if (N === 0 && E === 0 && Z === 0) continue;
      if (siteConfig.rotation) {
        const [rE, rN] = rotateEN(E, N, siteConfig.rotation);
        E = rE;
        N = rN;
      }
      acuan.set(id, { N, E, Z });
    }

    // ── Pembacaan pada rentang ──
    // Bacaan gagal tembak ("000,00,00" → nol di MySQL) disaring di SQL, bukan
    // setelah dirata-rata: pada mode per jam, nol yang ikut dibagi menghasilkan
    // pecahan tepat sebesar jumlah bacaan sahnya. Aturan yang sama dengan
    // valid1 di /api/deformasi dan SAH di /api/analisa.
    const SAH = "AND NOT (sensor8+0 = 0 AND sensor9+0 = 0 AND sensor10+0 = 0)";
    const kondisiLogger = siteConfig.idLogger ? "AND code_logger = ?" : "";
    const argLogger = siteConfig.idLogger ? [siteConfig.idLogger] : [];

    // Satu bentuk kueri untuk ketiga mode; yang berbeda hanya seberapa kasar
    // stempelnya dibulatkan sebelum GROUP BY. Mode "mentah" pun ikut
    // dikelompokkan — pada ketelitian detik penuh, jadi pembacaan yang berbeda
    // tetap berdiri sendiri. Yang runtuh cuma baris kembar pada detik yang
    // SAMA untuk prisma yang sama, dan itu memang ada: 17 September 2026 P7
    // menulis 731 baris sementara prisma lain 279. Kembaran itu bukan sekadar
    // sampah; seriGabungan() menutup satu kelompok begitu sebuah prisma muncul
    // dua kali, jadi tiap running P7 terpecah jadi tiga baris grafik yang
    // semuanya "tidak lengkap".
    //
    // Stempelnya diformat di SQL, tidak dikembalikan sebagai DATETIME. Kolom
    // DATETIME diserahkan Prisma sebagai objek Date, dan String(Date)
    // merendernya menurut zona waktu SERVER — jam dindingnya jadi bergantung
    // pada mesin yang menjalankan.
    //
    // FORMAT_STEMPEL diinterpolasi ke SQL, bukan diikat sebagai parameter:
    // DATE_FORMAT butuh literal. Aman karena kuncinya sudah disempitkan
    // bacaInterval() jadi salah satu dari tiga nilai tetap — tidak ada teks
    // dari permintaan yang sampai ke sini.
    const barisRentang = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT sensor1,
              DATE_FORMAT(waktu, '${FORMAT_STEMPEL[rapat]}') AS t,
              AVG(CAST(sensor8 AS DECIMAL(20,6))) AS e,
              AVG(CAST(sensor9 AS DECIMAL(20,6))) AS n,
              AVG(CAST(sensor10 AS DECIMAL(20,6))) AS z
       FROM rts
       WHERE sensor1 IN (${slot}) AND waktu >= ? AND waktu <= ? ${SAH} ${kondisiLogger}
       GROUP BY sensor1, t
       ORDER BY t ASC
       LIMIT ${BATAS_BARIS}`,
      ...idSlot,
      dari,
      sampai,
      ...argLogger
    );

    const titik = new Map<string, Array<{ t: string; dnMm: number; deMm: number; dzMm: number }>>();
    for (const b of barisRentang) {
      const id = String(b.sensor1);
      const a = acuan.get(id);
      if (!a) continue;
      let N = nfloat(b.n);
      let E = nfloat(b.e);
      const Z = nfloat(b.z);
      if (N === 0 && E === 0 && Z === 0) continue;
      if (siteConfig.rotation) {
        const [rE, rN] = rotateEN(E, N, siteConfig.rotation);
        E = rE;
        N = rN;
      }
      if (!titik.has(id)) titik.set(id, []);
      titik.get(id)!.push({
        t: String(b.t),
        dnMm: (N - a.N) * 1000,
        deMm: (E - a.E) * 1000,
        dzMm: (Z - a.Z) * 1000,
      });
    }

    const tanpaAcuan: string[] = [];
    const tanpaBacaan: string[] = [];
    const hasil = dipilih.map((p) => {
      const adaAcuan = acuan.has(p.id_prisma);
      const t = titik.get(p.id_prisma) ?? [];
      if (!adaAcuan) tanpaAcuan.push(p.nama_prisma || p.id_prisma);
      else if (t.length === 0) tanpaBacaan.push(p.nama_prisma || p.id_prisma);
      return {
        id_prisma: p.id_prisma,
        nama_prisma: p.nama_prisma || p.id_prisma,
        acuan_sah: adaAcuan,
        titik: t,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        ...kosong(site, siteConfig, dari, sampai, logR0?.datetime ?? null),
        r0: { id_log: idR0, waktu: logR0?.datetime ?? null },
        interval: rapat,
        interval_diminta: intervalPilihan,
        terpotong: barisRentang.length >= BATAS_BARIS,
        prisma: hasil,
        dibuang: { tanpa_acuan: tanpaAcuan, tanpa_bacaan: tanpaBacaan },
      },
    });
  } catch (error) {
    console.error("[GET /api/analisa-gabungan]", error);
    return NextResponse.json(
      { success: false, error: "Gagal menghitung analisa gabungan" },
      { status: 500 }
    );
  }
}

function kosong(
  slug: string,
  siteConfig: Awaited<ReturnType<typeof getSite>>,
  dari: string,
  sampai: string,
  waktuR0: Date | null,
  intervalDiminta: IntervalGabungan = "auto",
  rapat: ReturnType<typeof resolusiInterval> = "mentah"
) {
  return {
    site: {
      slug: siteConfig.slug || slug,
      nama: siteConfig.nama,
      badge_color: siteConfig.badgeColor,
      terkalibrasi: siteConfig.terkalibrasi,
      data_dummy: siteConfig.dataDummy,
      tidak_dikenal: siteConfig.tidakDikenal,
    },
    r0: waktuR0 ? { id_log: null, waktu: waktuR0 } : null,
    dari,
    sampai,
    interval: rapat,
    interval_diminta: intervalDiminta,
    terpotong: false,
    prisma: [] as Array<unknown>,
    dibuang: { tanpa_acuan: [] as string[], tanpa_bacaan: [] as string[] },
  };
}
