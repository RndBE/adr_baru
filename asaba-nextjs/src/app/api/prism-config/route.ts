import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishMqtt, topikPerintah } from "@/lib/mqtt";
import { getLoggerForSite } from "@/lib/sites";

/**
 * Tiga parameter yang selalu dibuat untuk setiap prisma baru.
 * Sengaja disamakan persis dengan PARAM_STANDAR di
 * prisma/backfill-prisma-site.ts — prisma hasil "Set" dan hasil backfill harus
 * tidak bisa dibedakan, kalau tidak halaman Analisa memperlakukannya berbeda.
 */
const PARAM_STANDAR = [
  { nama: "Northing_Y", kolom: "sensor8", icon: "northing" },
  { nama: "Easting_X", kolom: "sensor9", icon: "easting" },
  { nama: "Elevation", kolom: "sensor10", icon: "elevation_z" },
];


/**
 * GET /api/prism-config?site=xxx
 * Daftar 50 slot prisma (dinamis dari t_prisma + temp_prisma).
 * Setara dengan Adr::daftar_prisma() di CI3.
 *
 * Query params:
 * - site: WAJIB. Slot "P1" di site berbeda adalah target fisik yang berbeda,
 *   jadi daftar slot hanya bermakna dalam konteks satu site. Mode "per logger"
 *   dihapus karena satu logger bisa melayani beberapa site, sehingga hasilnya
 *   mencampur target dari site yang berlainan.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const site = searchParams.get("site");

    if (!site) {
      return NextResponse.json(
        { success: false, error: "Parameter site wajib diisi" },
        { status: 400 }
      );
    }

    const id_logger = await getLoggerForSite(site);
    if (!id_logger) {
      return NextResponse.json(
        { success: false, error: `Logger untuk site "${site}" tidak ditemukan` },
        { status: 404 }
      );
    }

    const registeredPrisma = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        p.id, p.id_prisma, p.id_logger, p.nama_prisma, p.status_controller,
        p.target_height, p.HA, p.VA, p.SlopDis, p.site,
        tp.waktu, tp.N1, tp.E1, tp.Z1, tp.N0, tp.E0, tp.Z0, tp.status_get
      FROM t_prisma p
      LEFT JOIN temp_prisma tp
        ON tp.id_prisma = p.id_prisma AND tp.site = p.site
      WHERE p.site = ${site}
      ORDER BY p.id ASC
    `;

    // Buat 50 slot (P1..P50)
    const registeredMap = new Map<string, Record<string, unknown>>();
    for (const pr of registeredPrisma as Array<Record<string, unknown>>) {
      registeredMap.set(pr.id_prisma as string, pr);
    }

    const slot = Array.from({ length: 50 }, (_, i) => {
      const id_prisma = `P${i + 1}`;
      if (registeredMap.has(id_prisma)) {
        return { ...registeredMap.get(id_prisma), slot: i + 1, registered: true };
      }
      return {
        slot: i + 1,
        id: i + 1,
        id_prisma,
        id_logger,
        nama_prisma: "Not Set",
        status_controller: "sensor9",
        target_height: "",
        HA: "Not Set",
        VA: "Not Set",
        SlopDis: "Not Set",
        registered: false,
      };
    });

    return NextResponse.json({
      success: true,
      data: slot,
      id_logger,
    });
  } catch (error) {
    console.error("[GET /api/prism-config]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch prism config" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/prism-config
 * Insert prisma baru ke t_prisma, temp_prisma, parameter_prisma + kirim MQTT.
 * Setara dengan Adr::input_prisma() di CI3.
 * 
 * Body: { slot_id, nama_prisma, target_height, site }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slot_id, nama_prisma, target_height, site } = body;

    if (!slot_id || !nama_prisma) {
      return NextResponse.json(
        { success: false, error: "slot_id dan nama_prisma wajib diisi" },
        { status: 400 }
      );
    }

    // Site wajib: slot "P1" di site berbeda adalah target fisik yang berbeda,
    // jadi mendaftarkan slot tanpa site berisiko menimpa milik site lain.
    if (!site) {
      return NextResponse.json(
        { success: false, error: "site wajib diisi" },
        { status: 400 }
      );
    }

    // Logger diturunkan dari SITE, tanpa fallback ke "logger ADR pertama":
    // payload MQTT berbentuk { set_<id_logger>: … }, jadi menebak logger berarti
    // perintah bisa nyasar ke perangkat site lain. Lebih baik gagal terang.
    const id_logger = await getLoggerForSite(site);
    if (!id_logger) {
      return NextResponse.json(
        { success: false, error: `Logger untuk site "${site}" tidak ditemukan` },
        { status: 404 }
      );
    }

    const id_prisma = `P${slot_id}`;

    // Cek apakah slot ini sudah dipakai DI SITE INI
    const existing = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM t_prisma WHERE id_prisma = ${id_prisma} AND site = ${site} LIMIT 1
    `;
    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: `Prisma ${id_prisma} sudah terdaftar di site ini. Gunakan PUT untuk update.` },
        { status: 409 }
      );
    }

    // Ketiga tabel ditulis dalam SATU transaksi.
    //
    // Sebelumnya tiap INSERT berdiri sendiri dan dijalankan berurutan. Ketika
    // yang terakhir gagal, dua yang pertama sudah terlanjur commit: slot muncul
    // sebagai "registered" di daftar (karena barisnya ada di t_prisma) padahal
    // parameter grafiknya tidak pernah terbentuk, dan MQTT tidak pernah dikirim
    // karena request-nya berakhir 500. Prisma setengah jadi seperti itu hanya
    // bisa dibereskan lewat SQL manual.
    await prisma.$transaction(async (tx) => {
      // 1. INSERT ke t_prisma
      //
      // `id` sengaja TIDAK disebut: kolomnya AUTO_INCREMENT, jadi MySQL yang
      // menentukan nilainya. Kode lama menghitung sendiri lewat
      // `SELECT MAX(id)+1` — dua request Set yang berbarengan membaca angka yang
      // sama lalu bertabrakan di primary key, dan hasil hitungannya juga
      // meleset begitu ada baris yang pernah dihapus.
      await tx.$executeRaw`
        INSERT INTO t_prisma (id_logger, id_prisma, nama_prisma, status_controller, target_height, site)
        VALUES (${id_logger}, ${id_prisma}, ${nama_prisma}, 'sensor9', ${target_height ?? 0}, ${site})
      `;

      // 2. INSERT ke temp_prisma
      await tx.$executeRaw`
        INSERT INTO temp_prisma (id_prisma, waktu, N1, E1, Z1, N0, E0, Z0, status_get, site)
        VALUES (${id_prisma}, '-', '0', '0', '0', '0', '0', '0', '1', ${site})
      `;

      // 3. INSERT parameter_prisma (Northing, Easting, Elevation)
      //
      // `satuan` WAJIB disebut: kolomnya `varchar(150) NOT NULL` tanpa default,
      // jadi dengan sql_mode STRICT_TRANS_TABLES (bawaan MySQL 8.4) INSERT yang
      // menghilangkannya ditolak `ERROR 1364: Field 'satuan' doesn't have a
      // default value` — dan itu membuat SELURUH tombol "Set" gagal. Nilai ''
      // menyamai baris yang sudah ada dan yang ditulis
      // prisma/backfill-prisma-site.ts.
      for (const par of PARAM_STANDAR) {
        await tx.$executeRaw`
          INSERT INTO parameter_prisma (id_prisma, nama_parameter, kolom_sensor, satuan, analisa, tipe_graf, icon_sensor, site)
          VALUES (${id_prisma}, ${par.nama}, ${par.kolom}, '', 1, 'spline', ${par.icon}, ${site})
        `;
      }
    });

    // 4. Kirim recordTarget ke logger via MQTT
    //    Sengaja DI LUAR transaksi: perintah ke perangkat tidak bisa di-rollback,
    //    jadi jangan dikirim sebelum barisnya benar-benar commit.
    const topic = topikPerintah(id_logger);
    const mqttPayload = {
      [`set_${id_logger}`]: {
        command: "set_rts",
        recordTarget: {
          slot: parseInt(String(slot_id)),
          name: nama_prisma,
          targetHigh: String(target_height ?? "0"),
          HA: "0",
          VA: "0",
        },
      },
    };
    const mqttSent = await publishMqtt(topic, mqttPayload);

    return NextResponse.json({
      success: true,
      message: "Prisma berhasil diset, menunggu respon perangkat...",
      mqtt_sent: mqttSent,
    });
  } catch (error) {
    console.error("[POST /api/prism-config]", error);
    return NextResponse.json(
      { success: false, error: "Failed to insert prisma" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/prism-config
 * Setara dengan Adr::update_prisma() + prism_set() di CI3.
 * 1. Update t_prisma (nama + target_height)
 * 2. Subscribe MQTT (koneksi terpisah) untuk tunggu response logger
 * 3. Kirim recordTarget via publishMqtt
 * 4. Logger balas dengan HA/VA → simpan ke t_prisma
 *
 * Body: { slot_id, nama_prisma?, target_height?, site }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { slot_id, nama_prisma, target_height, site } = body;

    if (!slot_id) {
      return NextResponse.json(
        { success: false, error: "slot_id wajib diisi" },
        { status: 400 }
      );
    }

    if (!site) {
      return NextResponse.json(
        { success: false, error: "site wajib diisi" },
        { status: 400 }
      );
    }

    // Logger diturunkan dari SITE, tanpa fallback ke "logger ADR pertama":
    // payload MQTT berbentuk { set_<id_logger>: … }, jadi menebak logger berarti
    // perintah bisa nyasar ke perangkat site lain. Lebih baik gagal terang.
    const id_logger = await getLoggerForSite(site);
    if (!id_logger) {
      return NextResponse.json(
        { success: false, error: `Logger untuk site "${site}" tidak ditemukan` },
        { status: 404 }
      );
    }

    const id_prisma = `P${slot_id}`;

    // Update t_prisma (nama_prisma + target_height saja).
    // Nilai dikirim sebagai parameter, bukan disisipkan ke string SQL — nama
    // prisma berasal dari input pengguna dan bisa memuat kutip tunggal.
    const updates: string[] = [];
    const nilai: unknown[] = [];
    if (nama_prisma !== undefined) { updates.push("nama_prisma = ?"); nilai.push(nama_prisma); }
    if (target_height !== undefined) { updates.push("target_height = ?"); nilai.push(target_height); }

    if (updates.length > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE t_prisma SET ${updates.join(", ")} WHERE id_prisma = ? AND site = ?`,
        ...nilai,
        id_prisma,
        site
      );
    }

    const topic = topikPerintah(id_logger);
    const mqttPayload = {
      [`set_${id_logger}`]: {
        command: "set_rts",
        recordTarget: {
          slot: parseInt(String(slot_id)),
          name: nama_prisma ?? id_prisma,
          targetHigh: String(target_height ?? "0"),
        },
      },
    };

    // Fire-and-forget: kirim recordTarget, browser MQTT akan tangkap response
    const mqttSent = await publishMqtt(topic, mqttPayload);
    console.log("[PUT prism-config] recordTarget sent, waiting for browser MQTT to catch response");

    return NextResponse.json({
      success: true,
      message: "Prisma berhasil diperbarui",
      mqtt_sent: mqttSent,
    });
  } catch (error) {
    console.error("[PUT /api/prism-config]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update prisma" },
      { status: 500 }
    );
  }
}


/**
 * DELETE /api/prism-config
 * Hapus prisma dari t_prisma, temp_prisma, parameter_prisma.
 * 
 * Body: { slot_id, site }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { slot_id, site } = body;

    if (!slot_id) {
      return NextResponse.json(
        { success: false, error: "slot_id wajib diisi" },
        { status: 400 }
      );
    }

    // Tanpa site, penghapusan ini akan menghapus slot yang sama di SEMUA site.
    if (!site) {
      return NextResponse.json(
        { success: false, error: "site wajib diisi" },
        { status: 400 }
      );
    }

    const id_prisma = `P${slot_id}`;

    await prisma.$executeRaw`DELETE FROM parameter_prisma WHERE id_prisma = ${id_prisma} AND site = ${site}`;
    await prisma.$executeRaw`DELETE FROM temp_prisma WHERE id_prisma = ${id_prisma} AND site = ${site}`;
    await prisma.$executeRaw`DELETE FROM t_prisma WHERE id_prisma = ${id_prisma} AND site = ${site}`;

    return NextResponse.json({ success: true, message: "Prisma berhasil dihapus" });
  } catch (error) {
    console.error("[DELETE /api/prism-config]", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete prisma" },
      { status: 500 }
    );
  }
}
