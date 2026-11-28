import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSite, invalidateSiteCache } from "@/lib/sites";
import { cariAcuanR0 } from "@/lib/log-kontrol";
import { bacaSudut, sudutKosong } from "@/lib/koreksi-azimut";
import {
  AMBANG_CEK_BS_MILI,
  cekOrientasiBs,
  lingkaran,
  nolSetDariBs,
  rataNolSet,
  selisihSudut,
  validasiNolSet,
  validasiTinggiAlat,
  type CekBs,
} from "@/lib/orientasi-bs";
import { bacaSejak, hitungUlangKoordinat } from "@/lib/hitung-ulang-koordinat";

/** Jumlah sesi terbaru yang ditampilkan di riwayat cek BS. */
const RIWAYAT_CEK = 12;

/**
 * Koordinat survei backsight dan nol set horizontal RTS satu site.
 *
 *   GET  ?site=…   koordinat BS, bacaan BS di sesi acuan, nol set hasil
 *                  hitungan vs yang sedang dipakai
 *   PUT            simpan koordinat survei BS  { site, koordinat: [{id_prisma, E, N, H}] }
 *   POST           nol set + tinggi alat       { site, nolSet, tinggiAlat, sejak, terapkan }
 *                  sejak: waktu pemasangan alat ("YYYY-MM-DDTHH:mm"); hanya sesi
 *                  sejak waktu ini yang dihitung ulang. Kosong = semua sesi.
 *                  terapkan=false: pratinjau hitung ulang, tidak menulis apa pun
 *                  terapkan=true : simpan ke t_site lalu hitung ulang R0 + riwayat
 *
 * Nol set dihitung SEKALI dari sesi acuan (R0), bukan tiap siklus — alasannya
 * di src/lib/orientasi-bs.ts. Sesudah nol set/tinggi alat berubah, riwayat
 * WAJIB ikut dihitung ulang (src/lib/hitung-ulang-koordinat.ts); kalau tidak,
 * setiap prisma tampak melompat terhadap R0 dan EWS berbunyi palsu. Karena itu
 * keduanya hanya bisa diubah lewat POST ini, yang mengerjakan keduanya.
 */

type BarisBs = {
  id_prisma: string;
  nama_prisma: string;
  koor_e: number | null;
  koor_n: number | null;
  koor_h: number | null;
};

type Bacaan = { ha: number; va: number; sd: number; n: number };

/** Rata-rata bacaan per slot. HA dirata-rata terhadap bacaan pertama supaya tidak pecah di 0/400. */
function rataBacaan(
  rows: Array<{ sensor1: string; sensor5: string; sensor6: string; sensor7: string }>,
  penuh: number
): Map<string, Bacaan> {
  const kelompok = new Map<string, Array<{ ha: number; va: number; sd: number }>>();
  for (const r of rows) {
    if (sudutKosong(r.sensor5) || sudutKosong(r.sensor6)) continue;
    const sd = Number(String(r.sensor7).replace(",", "."));
    if (!Number.isFinite(sd) || sd <= 0) continue;
    const ha = bacaSudut(r.sensor5) as number;
    const va = bacaSudut(r.sensor6) as number;
    if (!kelompok.has(r.sensor1)) kelompok.set(r.sensor1, []);
    kelompok.get(r.sensor1)!.push({ ha, va, sd });
  }
  const hasil = new Map<string, Bacaan>();
  for (const [slot, xs] of kelompok) {
    const acuan = xs[0].ha;
    const dHa = xs.reduce((a, x) => a + selisihSudut(x.ha, acuan, penuh), 0) / xs.length;
    hasil.set(slot, {
      ha: (((acuan + dHa) % penuh) + penuh) % penuh,
      va: xs.reduce((a, x) => a + x.va, 0) / xs.length,
      sd: xs.reduce((a, x) => a + x.sd, 0) / xs.length,
      n: xs.length,
    });
  }
  return hasil;
}

async function bacaBs(site: string) {
  return prisma.$queryRaw<BarisBs[]>`
    SELECT id_prisma, nama_prisma, koor_e, koor_n, koor_h
      FROM t_prisma WHERE site = ${site} AND jenis = 'bs' ORDER BY id
  `;
}

export async function GET(request: NextRequest) {
  try {
    const site = new URL(request.url).searchParams.get("site");
    if (!site) return NextResponse.json({ success: false, error: "site wajib diisi" }, { status: 400 });

    const cfg = await getSite(site);
    if (cfg.tidakDikenal) {
      return NextResponse.json({ success: false, error: `Site "${site}" tidak terdaftar` }, { status: 404 });
    }
    const faktor = cfg.koreksiAzimut?.faktorDerajat ?? 0.9;
    const penuh = lingkaran(faktor);
    const bs = await bacaBs(site);
    const slot = bs.map((b) => b.id_prisma);

    // Sesi acuan: R0. Bila R0 tidak memuat tembakan BS sah, sesi terbaru yang memuatnya.
    let sesi: { id_log: string; waktu: Date | null; r0: boolean } | null = null;
    let bacaan = new Map<string, Bacaan>();
    if (slot.length > 0) {
      const ambil = (idLog: string) =>
        prisma.$queryRawUnsafe<Array<{ sensor1: string; sensor5: string; sensor6: string; sensor7: string }>>(
          `SELECT sensor1, sensor5, sensor6, sensor7 FROM rts
            WHERE id_kontrol = ? AND sensor1 IN (${slot.map(() => "?").join(",")})`,
          idLog,
          ...slot
        );
      const idR0 = await cariAcuanR0(site);
      if (idR0) {
        bacaan = rataBacaan(await ambil(idR0), penuh);
        if (bacaan.size > 0) {
          const log = await prisma.logKontrol.findUnique({ where: { id_log: idR0 } });
          sesi = { id_log: idR0, waktu: log?.datetime ?? null, r0: log?.r0 === 1 };
        }
      }
      if (bacaan.size === 0) {
        const terbaru = await prisma.$queryRawUnsafe<Array<{ id_log: string; datetime: Date }>>(
          `SELECT l.id_log, l.datetime FROM log_kontrol l
            WHERE l.site = ? AND EXISTS (
              SELECT 1 FROM rts r WHERE r.id_kontrol = l.id_log
                AND r.sensor1 IN (${slot.map(() => "?").join(",")}) AND r.sensor7 + 0 > 0)
            ORDER BY l.datetime DESC LIMIT 1`,
          site,
          ...slot
        );
        if (terbaru[0]) {
          bacaan = rataBacaan(await ambil(terbaru[0].id_log), penuh);
          sesi = { id_log: terbaru[0].id_log, waktu: terbaru[0].datetime, r0: false };
        }
      }
    }

    const stasiun = cfg.rts ? { E: cfg.rts.E, N: cfg.rts.N, H: cfg.rts.Z } : null;
    const daftar = bs.map((b) => {
      const koor =
        b.koor_e !== null && b.koor_n !== null
          ? { E: Number(b.koor_e), N: Number(b.koor_n), H: b.koor_h === null ? null : Number(b.koor_h) }
          : null;
      const baca = bacaan.get(b.id_prisma) ?? null;
      const hitung =
        stasiun && koor && baca
          ? nolSetDariBs(stasiun, { E: koor.E, N: koor.N, H: koor.H ?? NaN }, baca, faktor)
          : null;
      return {
        id_prisma: b.id_prisma,
        nama: b.nama_prisma,
        koor,
        bacaan: baca,
        hasil: hitung && {
          ...hitung,
          hiMinHt: Number.isFinite(hitung.hiMinHt) ? hitung.hiMinHt : null,
        },
      };
    });
    const zs = daftar.flatMap((d) => (d.hasil ? [d.hasil.z] : []));
    const rata = rataNolSet(zs, faktor);
    const nolSetSekarang = cfg.koreksiAzimut ? cfg.koreksiAzimut.orientasiDeg / faktor : null;

    // Cek orientasi tiap siklus sejak sesi acuan: HA BS vs HA BS di acuan.
    const riwayatCek: Array<{ id_log: string; waktu: string; cek: CekBs }> = [];
    if (sesi && bacaan.size > 0) {
      const sesiCek = await prisma.$queryRaw<Array<{ id_log: string; waktu: string }>>`
        SELECT id_log, DATE_FORMAT(datetime, '%Y-%m-%d %H:%i') AS waktu FROM log_kontrol
         WHERE site = ${site} AND datetime >= (SELECT datetime FROM log_kontrol WHERE id_log = ${sesi.id_log})
         ORDER BY datetime DESC LIMIT ${RIWAYAT_CEK}
      `;
      if (sesiCek.length > 0) {
        const rows = await prisma.$queryRawUnsafe<
          Array<{ id_kontrol: string; sensor1: string; sensor5: string; sensor6: string; sensor7: string }>
        >(
          `SELECT id_kontrol, sensor1, sensor5, sensor6, sensor7 FROM rts
            WHERE id_kontrol IN (${sesiCek.map(() => "?").join(",")})
              AND sensor1 IN (${slot.map(() => "?").join(",")})`,
          ...sesiCek.map((s) => s.id_log),
          ...slot
        );
        const acuanHa = new Map([...bacaan].map(([id, b]) => [id, b.ha]));
        for (const s of sesiCek) {
          const baca = rataBacaan(rows.filter((r) => r.id_kontrol === s.id_log), penuh);
          if (baca.size === 0) continue;
          const haSesi = new Map([...baca].map(([id, b]) => [id, b.ha]));
          riwayatCek.push({ id_log: s.id_log, waktu: s.waktu, cek: cekOrientasiBs(acuanHa, haSesi, faktor) });
        }
      }
    }

    const [baris] = await prisma.$queryRaw<Array<{ sejak: string | null }>>`
      SELECT DATE_FORMAT(pemasangan_sejak, '%Y-%m-%dT%H:%i') AS sejak FROM t_site WHERE slug = ${site}
    `;

    return NextResponse.json({
      success: true,
      data: {
        stasiun,
        tinggiAlat: cfg.koreksiAzimut?.tinggiAlat ?? 0,
        faktor,
        satuan: faktor === 0.9 ? "gon" : faktor === 1 ? "derajat" : "satuan alat",
        lingkaran: penuh,
        koreksiAktif: !!cfg.koreksiAzimut,
        nolSetSekarang,
        pemasanganSejak: baris?.sejak ?? null,
        sesi,
        bs: daftar,
        riwayatCek,
        ambangCekMili: AMBANG_CEK_BS_MILI,
        hasil: rata && {
          ...rata,
          jumlahBs: zs.length,
          // Dibungkus ke ±½ lingkaran: dipakai menilai cocok/tidak.
          selisihSekarangMili:
            nolSetSekarang === null ? null : selisihSudut(rata.z, nolSetSekarang, penuh) * 1000,
          // Apa adanya (hitungan − dipakai): yang ditampilkan ke operator, supaya
          // "terbalik ~200 gon" terbaca −200,43, bukan +199,57.
          selisihSekarang: nolSetSekarang === null ? null : rata.z - nolSetSekarang,
        },
      },
    });
  } catch (error) {
    console.error("[GET /api/prism-config/orientasi-bs]", error);
    return NextResponse.json({ success: false, error: "Gagal membaca orientasi BS" }, { status: 500 });
  }
}

/** Batas jarak titik survei dari RTS. Lebih dari ini hampir pasti E/N tertukar atau salah zona. */
const MAKS_JARAK_M = 20_000;

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      site?: string;
      koordinat?: Array<{ id_prisma?: string; E?: unknown; N?: unknown; H?: unknown }>;
    };
    const { site, koordinat } = body;
    if (!site || !Array.isArray(koordinat) || koordinat.length === 0) {
      return NextResponse.json({ success: false, error: "site dan koordinat wajib diisi" }, { status: 400 });
    }
    const cfg = await getSite(site);
    const bs = new Set((await bacaBs(site)).map((b) => b.id_prisma));

    const angka = (v: unknown) => (v === null || v === undefined || String(v).trim() === "" ? null : Number(String(v).replace(",", ".")));
    const tulis: Array<{ id: string; E: number | null; N: number | null; H: number | null }> = [];
    for (const k of koordinat) {
      const id = String(k.id_prisma ?? "");
      if (!bs.has(id)) {
        return NextResponse.json({ success: false, error: `${id || "?"} bukan prisma Backsight site ini` }, { status: 400 });
      }
      const E = angka(k.E), N = angka(k.N), H = angka(k.H);
      for (const [nama, v] of [["E", E], ["N", N], ["H", H]] as const) {
        if (v !== null && !Number.isFinite(v)) {
          return NextResponse.json({ success: false, error: `${id}: ${nama} bukan angka` }, { status: 400 });
        }
      }
      if ((E === null) !== (N === null)) {
        return NextResponse.json({ success: false, error: `${id}: isi E dan N sekaligus, atau kosongkan keduanya` }, { status: 400 });
      }
      if (E !== null && N !== null && cfg.rts && Math.hypot(E - cfg.rts.E, N - cfg.rts.N) > MAKS_JARAK_M) {
        return NextResponse.json(
          { success: false, error: `${id}: lebih dari ${MAKS_JARAK_M / 1000} km dari RTS — E dan N tertukar?` },
          { status: 400 }
        );
      }
      tulis.push({ id, E, N, H });
    }

    await prisma.$transaction(
      tulis.map((t) =>
        prisma.$executeRaw`
          UPDATE t_prisma SET koor_e = ${t.E}, koor_n = ${t.N}, koor_h = ${t.H}
           WHERE site = ${site} AND id_prisma = ${t.id} AND jenis = 'bs'
        `
      )
    );
    return NextResponse.json({ success: true, data: { disimpan: tulis.length } });
  } catch (error) {
    console.error("[PUT /api/prism-config/orientasi-bs]", error);
    return NextResponse.json({ success: false, error: "Gagal menyimpan koordinat BS" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      site?: string;
      nolSet?: unknown;
      tinggiAlat?: unknown;
      sejak?: unknown;
      terapkan?: unknown;
    };
    const { site } = body;
    if (!site) return NextResponse.json({ success: false, error: "site wajib diisi" }, { status: 400 });

    const cfg = await getSite(site);
    if (!cfg.koreksiAzimut || !cfg.rts) {
      return NextResponse.json(
        { success: false, error: "Site ini belum memakai koreksi azimut atau belum punya koordinat RTS" },
        { status: 400 }
      );
    }
    const faktor = cfg.koreksiAzimut.faktorDerajat;
    const galat = validasiNolSet(body.nolSet, faktor) ?? validasiTinggiAlat(body.tinggiAlat);
    if (galat) return NextResponse.json({ success: false, error: galat }, { status: 400 });

    // Batas pemasangan: sesi sebelum ini punya nol set sendiri dan tidak diputar.
    const sejak = bacaSejak(body.sejak);
    if (sejak === undefined) {
      return NextResponse.json({ success: false, error: "Waktu pemasangan tidak sah" }, { status: 400 });
    }
    if (sejak !== null) {
      const idR0 = await cariAcuanR0(site);
      const [r0] = idR0
        ? await prisma.$queryRaw<Array<{ waktu: string }>>`
            SELECT DATE_FORMAT(datetime, '%Y-%m-%d %H:%i:%s') AS waktu FROM log_kontrol WHERE id_log = ${idR0}
          `
        : [];
      // R0 yang lebih tua dari pemasangan tidak ikut dihitung ulang, sementara
      // sesi baru diukur terhadapnya — semua prisma tampak melompat.
      if (r0 && r0.waktu < sejak) {
        return NextResponse.json(
          {
            success: false,
            error: `Acuan R0 (${r0.waktu.slice(0, 16)}) lebih tua dari waktu pemasangan. Tandai R0 baru dari sesi sesudah pemasangan dulu.`,
          },
          { status: 400 }
        );
      }
    }

    const nolSet = Number(body.nolSet);
    const tinggiAlat = Number(body.tinggiAlat);
    const orientasiDeg = Math.round(nolSet * faktor * 1e7) / 1e7;
    const k = {
      faktorDerajat: faktor,
      orientasiDeg,
      tinggiAlat,
      stasiunE: cfg.rts.E,
      stasiunN: cfg.rts.N,
      stasiunZ: cfg.rts.Z,
    };
    const terapkan = body.terapkan === true;

    // Jangan di tengah siklus: tembakan sesi berjalan yang sebagian dihitung
    // dengan nol set lama dan sebagian dengan yang baru akan dinilai terhadap
    // R0 yang sudah diputar — semua prisma tampak bergeser jauh dan EWS
    // berbunyi. Di sela siklus, sesi berikutnya baru dinilai saat selesai
    // (beberapa menit), jauh sesudah hitung ulang rampung.
    if (terapkan && cfg.idLogger) {
      const [siklus] = await prisma.$queryRaw<Array<{ sensor16: string | null }>>`
        SELECT sensor16 FROM temp_rts WHERE code_logger = ${cfg.idLogger} LIMIT 1
      `;
      const [akhir] = await prisma.$queryRaw<Array<{ detik: number | bigint | null }>>`
        SELECT TIMESTAMPDIFF(SECOND, MAX(waktu), NOW()) AS detik FROM rts
         WHERE code_logger = ${cfg.idLogger} AND sensor1 NOT IN ('', '0')
           AND waktu >= NOW() - INTERVAL 1 DAY
      `;
      const detik = akhir?.detik === null || akhir?.detik === undefined ? null : Number(akhir.detik);
      if (Number(siklus?.sensor16) === 1 || (detik !== null && detik < 60)) {
        return NextResponse.json(
          {
            success: false,
            error: "Siklus AutoTracking sedang berjalan. Terapkan sesudah siklus selesai, supaya sesi itu tidak dinilai dengan dua nol set berbeda.",
          },
          { status: 409 }
        );
      }
    }

    if (terapkan) {
      await prisma.$executeRaw`
        UPDATE t_site
           SET ha_orientasi_deg = ${orientasiDeg}, tinggi_alat = ${tinggiAlat}, pemasangan_sejak = ${sejak}
         WHERE slug = ${site}
      `;
      // Sebelum menghitung ulang: tembakan yang masuk selama proses ini harus
      // sudah memakai angka baru, bukan cache 60 detik yang lama.
      invalidateSiteCache();
      console.log(
        `[orientasi-bs] ${site}: nol set ${(cfg.koreksiAzimut.orientasiDeg / faktor).toFixed(4)} -> ${nolSet}, ` +
          `tinggi alat ${cfg.koreksiAzimut.tinggiAlat} -> ${tinggiAlat}, sejak ${sejak ?? "semua sesi"}`
      );
    }
    const laporan = await hitungUlangKoordinat(prisma, site, k, terapkan, sejak);
    return NextResponse.json({ success: true, data: { nolSet, orientasiDeg, tinggiAlat, sejak, laporan } });
  } catch (error) {
    console.error("[POST /api/prism-config/orientasi-bs]", error);
    return NextResponse.json({ success: false, error: "Gagal menerapkan nol set" }, { status: 500 });
  }
}
