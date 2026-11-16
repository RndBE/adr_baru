/**
 * Kejadian alarm dan perintah sirene EWS — sisi basis data.
 *
 * Aturannya di aturan-kejadian.ts (murni, teruji). Berkas ini hanya membaca dan
 * menulis tabel `kejadian_alarm` dan `status_ews`, dan menerbitkan perintah
 * level ke logger EWS. Dipakai oleh evaluasi-siklus.ts di akhir siklus dan
 * oleh API konfirmasi/verifikasi.
 */
import type { KejadianAlarm } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { waktuDateLokal } from "@/components/monitoring/format";
import { type StatusLabel, asStatusLabel } from "@/lib/ambang";
import { type HasilEws, type KejadianRingkas, langkahKejadian } from "@/lib/aturan-kejadian";
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
      dikonfirmasi = asStatusLabel((await kejadianAktif(site))?.tingkat_dikonfirmasi);
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
    const senyap = tujuan !== tingkat ? ` (${tingkat} disenyapkan konfirmasi)` : "";
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
