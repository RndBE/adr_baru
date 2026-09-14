import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifikasiKodeAkses } from "@/lib/kode-akses";
import { cariAcuanR0 } from "@/lib/log-kontrol";

/**
 * PATCH /api/log-kontrol/[id_log]
 *
 * Tunjuk sesi ini sebagai acuan R0 site-nya.
 *
 * Body: { kode_akses: string }
 *
 * Sampai sekarang `log_kontrol.r0` tidak punya penulis sama sekali — bukan di
 * aplikasi ini, bukan juga di CI3 yang cuma menampilkan badge "R0". Tandanya
 * disetel tangan lewat SQL. Akibatnya dua hal menggantung: dialog R0 di Hasil
 * Pengukuran menyatakan penggantian "belum tersedia", dan penolakan hapus sesi
 * di bawah menyuruh operator "tunjuk sesi lain sebagai R0 dulu" — saran yang
 * tidak bisa dijalankan.
 *
 * Dijaga kode akses, sama seperti perintah yang menggerakkan perangkat.
 * Alasannya bukan karena ini menyentuh hardware, melainkan karena akibatnya
 * selebar itu: SELURUH angka pergeseran site berubah sekaligus, dan sejak
 * jalur peringatan ada, ambang yang memutuskan orang dibangunkan tengah malam
 * ikut dihitung ulang terhadap acuan yang baru.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id_log: string }> }
) {
  try {
    const { id_log } = await params;
    const body = await req.json().catch(() => ({}));

    // Verifikasi kode akses SEBELUM apa pun disentuh, dan tanpa syarat — pola
    // yang sama dengan /api/kontrol/start, termasuk pemeriksaan masa berlakunya.
    const hasilAkses = await verifikasiKodeAkses(String(body?.kode_akses ?? ""));
    if (!hasilAkses.valid) {
      return NextResponse.json(
        { success: false, error: hasilAkses.alasan },
        { status: hasilAkses.alasan === "Kode akses wajib diisi" ? 400 : 403 }
      );
    }

    const log = await prisma.logKontrol.findUnique({ where: { id_log } });
    if (!log) {
      return NextResponse.json(
        { success: false, error: `Sesi "${id_log}" tidak ditemukan` },
        { status: 404 }
      );
    }

    // Tanpa site, penandaan tidak bisa di-scope: `UPDATE ... WHERE site IS NULL`
    // akan menyapu setiap sesi yang site-nya belum diketahui, di logger mana pun.
    // Sesi seperti ini lahir dari siklus yang dimulai alat sendiri saat site-nya
    // tidak bisa ditebak — lihat pilihSiteSesi().
    if (!log.site) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Sesi "${id_log}" tidak punya site, jadi tidak bisa jadi acuan. Sesi tanpa site ` +
            `muncul saat siklus dimulai sendiri oleh alat dan site-nya tidak bisa disimpulkan.`,
        },
        { status: 409 }
      );
    }

    // Acuan yang tidak punya bacaan bukan acuan. Tanpa penjagaan ini setiap
    // prisma menghasilkan pergeseran null, dan jalur peringatan membacanya
    // sebagai "gagal ditembak" — tiga siklus kemudian SELURUH prisma site
    // dilaporkan hilang sekaligus.
    const adaBacaan = await prisma.$queryRaw<Array<{ ada: number }>>`
      SELECT 1 AS ada FROM rts WHERE id_kontrol = ${id_log} LIMIT 1
    `;
    if (adaBacaan.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Sesi "${id_log}" belum punya satu pun baris pengukuran, jadi tidak bisa jadi acuan. ` +
            `Setiap pergeseran dihitung terhadapnya — tanpa koordinat, hasilnya kosong semua.`,
        },
        { status: 409 }
      );
    }

    if (Number(log.r0) === 1) {
      return NextResponse.json({
        success: true,
        data: { id_log, site: log.site, berubah: false },
      });
    }

    // Satu transaksi. Dua baris r0 = 1 di satu site membuat cariAcuanR0() dan
    // acuanR0Bertanda() sama-sama memakai findFirst tanpa urutan — acuannya jadi
    // tak tentu, dan angka deformasi bisa berubah antar permintaan tanpa ada
    // yang mengubah apa pun.
    await prisma.$transaction([
      prisma.$executeRaw`UPDATE log_kontrol SET r0 = 0 WHERE site = ${log.site}`,
      prisma.$executeRaw`UPDATE log_kontrol SET r0 = 1 WHERE id_log = ${id_log}`,
    ]);

    // Keadaan peringatan site ini dihitung terhadap acuan LAMA: `tingkat` yang
    // sudah diakui, hitungan konfirmasi tiga siklus, dan jeda 30 menitnya. Dasar
    // hitungannya baru saja berganti, jadi menyimpannya berarti membandingkan
    // nilai acuan-baru dengan tingkat acuan-lama. Dihapus supaya siklus
    // berikutnya membangunnya kembali dari Normal — prisma yang memang gawat
    // akan naik lagi lewat konfirmasi tiga siklus, dan yang tidak, tidak.
    //
    // `log_peringatan` sengaja TIDAK disentuh: itu catatan apa yang pernah
    // dikirim, dan itu tetap benar apa pun acuannya sekarang.
    //
    // Di luar transaksi dan ditelan galatnya: tabel ini dibuat migrasi 011 yang
    // belum tentu sudah dijalankan, dan kalau belum ada, memang tidak ada
    // keadaan basi yang perlu dibuang.
    try {
      const dibuang = await prisma.statusPrisma.deleteMany({ where: { site: log.site } });
      console.log(`[r0] ${log.site}: acuan -> ${id_log}, ${dibuang.count} keadaan prisma direset`);
    } catch (e) {
      console.warn(
        `[r0] ${log.site}: keadaan peringatan tidak direset (diabaikan):`,
        e instanceof Error ? e.message : e
      );
    }

    return NextResponse.json({
      success: true,
      data: { id_log, site: log.site, berubah: true },
    });
  } catch (error) {
    console.error("[PATCH /api/log-kontrol/[id_log]]", error);
    return NextResponse.json(
      { success: false, error: "Gagal menetapkan acuan R0" },
      { status: 500 }
    );
  }
}

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
