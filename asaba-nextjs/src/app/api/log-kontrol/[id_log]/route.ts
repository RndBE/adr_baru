import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cariAcuanR0 } from "@/lib/log-kontrol";

/**
 * DELETE /api/log-kontrol/[id_log]
 *
 * Hapus satu sesi running beserta baris pengukurannya.
 *
 * Baris `rts` ikut dihapus, bukan ditinggal. `rts.id_kontrol` menunjuk ke
 * `log_kontrol.id_log`, tapi Analisa TIDAK menyaring lewat kolom itu — ia
 * mencari `sensor1` dalam rentang tanggal. Jadi baris yatim tetap muncul di
 * grafik padahal sesinya sudah hilang dari riwayat, dan angkanya tidak bisa
 * ditelusuri lagi ke sesi mana pun.
 *
 * Sesi acuan deformasi DITOLAK, meniru cara /api/sites menolak site yang masih
 * punya pengukuran. Alasannya sama: kehilangannya tidak memunculkan galat, cuma
 * diam-diam menggeser semua angka.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id_log: string }> }
) {
  try {
    const { id_log } = await params;

    const log = await prisma.logKontrol.findUnique({ where: { id_log } });
    if (!log) {
      return NextResponse.json(
        { success: false, error: `Sesi "${id_log}" tidak ditemukan` },
        { status: 404 }
      );
    }

    // Acuan deformasi ditentukan /api/deformasi dengan dua langkah: cari r0 = 1
    // dulu, kalau tidak ada pakai sesi TERTUA site itu. Keduanya harus dijaga —
    // menghapus sesi tertua saat tidak ada r0 memindahkan acuan ke sesi
    // berikutnya, dan setiap pergeseran di halaman Hasil Pengukuran berubah
    // tanpa ada yang menandainya.
    if (log.site) {
      if ((await cariAcuanR0(log.site)) === id_log) {
        return NextResponse.json(
          {
            success: false,
            error:
              `Sesi ini acuan (R0) perhitungan deformasi site "${log.site}", jadi tidak bisa dihapus. ` +
              `Semua pergeseran dihitung relatif terhadapnya — menghapusnya membuat acuan pindah ` +
              `ke sesi lain dan seluruh angka deformasi site ini berubah tanpa pemberitahuan. ` +
              `Tunjuk sesi lain sebagai R0 dulu kalau memang perlu dihapus.`,
          },
          { status: 409 }
        );
      }
    }

    // Satu transaksi: baris `rts` yang kehilangan induknya tidak bisa ditelusuri
    // balik ke sesi mana pun, jadi separuh jalan lebih buruk daripada gagal.
    const [terhapusRts] = await prisma.$transaction([
      prisma.$executeRaw`DELETE FROM rts WHERE id_kontrol = ${id_log}`,
      prisma.$executeRaw`DELETE FROM log_kontrol WHERE id_log = ${id_log}`,
    ]);

    return NextResponse.json({
      success: true,
      data: { id_log, site: log.site, baris_rts_terhapus: terhapusRts },
    });
  } catch (error) {
    console.error("[DELETE /api/log-kontrol/[id_log]]", error);
    return NextResponse.json(
      { success: false, error: "Gagal menghapus sesi running" },
      { status: 500 }
    );
  }
}
