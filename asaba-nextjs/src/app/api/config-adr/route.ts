import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRtsConfig } from "@/lib/mqtt";
import { validasiRetries, validasiCycleTime, bacaAutoSearch } from "@/lib/protokol-rts";

/**
 * GET /api/config-adr?site=xxx
 * Konfigurasi RTS untuk satu site.
 *
 * Sebelumnya endpoint ini mengambil `ORDER BY id ASC LIMIT 1` — selalu baris
 * yang sama apa pun site yang dipilih. Karena satu unit RTS bisa dipakai di
 * beberapa site, job name dan titik origin harus dibedakan per site.
 *
 * PUT /api/config-adr
 * Update konfigurasi + kirim ke logger via MQTT. Body wajib memuat `site`.
 */
export async function GET(request: NextRequest) {
  try {
    const site = request.nextUrl.searchParams.get("site");
    if (!site) {
      return NextResponse.json(
        { success: false, error: "Parameter site wajib diisi" },
        { status: 400 }
      );
    }

    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM config_adr WHERE site = ${site} LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: `Konfigurasi untuk site "${site}" belum ada` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("[GET /api/config-adr]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch config ADR" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      site,
      job_name,
      prisma_cons,
      ts_high,
      coor_x,
      coor_y,
      coor_z,
      step_record,
      retries,
      cycle_time,
    } = body;
    // Nilai yang tidak dikenal jatuh ke bawaan firmware (true), bukan ditolak:
    // ia setelan bool, dan menggagalkan seluruh penyimpanan karena satu kolom
    // pilihan yang salah bentuk tidak sebanding.
    const auto_search = bacaAutoSearch(body.auto_search) ?? true;

    // Kunci baris berdasarkan site, bukan id — id bisa saja dikirim dari
    // tampilan site lain yang belum ter-refresh.
    if (!site) {
      return NextResponse.json(
        { success: false, error: "site wajib diisi" },
        { status: 400 }
      );
    }

    // Rentang divalidasi DI SINI, sebelum menyentuh database maupun MQTT.
    //
    // Firmware tidak akan mengeluh: nilai di luar rentang tersimpan tanpa
    // penolakan, lalu diam-diam diganti bawaan saat alat menyala berikutnya
    // (Bagian D protokol). Jadi setelan yang salah terlihat berhasil sampai
    // berhari-hari kemudian, saat ternyata tidak pernah berlaku.
    //
    // cycleTime bersatuan MILIDETIK lewat MQTT — menu serial/Bluetooth memakai
    // detik untuk setelan yang sama, jadi angka identik memberi hasil 1000×
    // berbeda tergantung jalurnya.
    const salah = [validasiRetries(retries), validasiCycleTime(cycle_time)].filter(
      (p): p is string => p !== null
    );
    if (salah.length) {
      return NextResponse.json({ success: false, error: salah.join(". ") }, { status: 400 });
    }

    const existing = await prisma.$queryRaw<Array<{ id: number; id_logger: number }>>`
      SELECT id, id_logger FROM config_adr WHERE site = ${site} LIMIT 1
    `;

    let loggerId: string;

    if (existing.length === 0) {
      // Barisnya DIBUAT di sini, bukan ditolak.
      //
      // Sebelumnya endpoint ini hanya bisa UPDATE dan membalas 404 "belum ada".
      // Tidak ada satu pun bagian aplikasi yang pernah INSERT ke config_adr —
      // semua baris yang ada lahir dari migrasi. Akibatnya site yang baru dibuat
      // lewat Master Data tidak pernah bisa dikonfigurasi sama sekali: RTS
      // Config gagal dibuka DAN gagal disimpan, dan perintahnya tidak punya
      // logger tujuan.
      //
      // Loggernya diambil dari t_site.id_logger, satu-satunya tempat relasi
      // site↔logger dinyatakan. Tanpa itu barisnya tidak bisa dibuat, karena
      // config_adr.id_logger menentukan ke perangkat mana setelan ini dikirim.
      const siteBaru = await prisma.site.findUnique({
        where: { slug: site },
        select: { id_logger: true },
      });
      if (!siteBaru) {
        return NextResponse.json(
          { success: false, error: `Site "${site}" tidak terdaftar` },
          { status: 404 }
        );
      }
      if (!siteBaru.id_logger) {
        return NextResponse.json(
          {
            success: false,
            error:
              `Site "${site}" belum punya logger. Pilih loggernya dulu di ` +
              `Master Data → Site, karena setelan ini harus dikirim ke perangkat tertentu.`,
          },
          { status: 409 }
        );
      }

      await prisma.$executeRaw`
        INSERT INTO config_adr
          (id_logger, job_name, prisma_cons, ts_high, coor_x, coor_y, coor_z,
           step_record, retries, cycle_time, site, auto_search)
        VALUES
          (${parseInt(siteBaru.id_logger, 10)}, ${job_name}, ${parseFloat(prisma_cons)},
           ${parseFloat(ts_high)}, ${parseFloat(coor_x)}, ${parseFloat(coor_y)},
           ${parseFloat(coor_z)}, ${parseInt(step_record)}, ${parseInt(retries)},
           ${parseInt(cycle_time)}, ${site}, ${auto_search ? 1 : 0})
      `;
      loggerId = siteBaru.id_logger;
    } else {
      await prisma.$executeRaw`
        UPDATE config_adr
        SET
          job_name     = ${job_name},
          prisma_cons  = ${parseFloat(prisma_cons)},
          ts_high      = ${parseFloat(ts_high)},
          coor_x       = ${parseFloat(coor_x)},
          coor_y       = ${parseFloat(coor_y)},
          coor_z       = ${parseFloat(coor_z)},
          step_record  = ${parseInt(step_record)},
          retries      = ${parseInt(retries)},
          cycle_time   = ${parseInt(cycle_time)},
          auto_search  = ${auto_search ? 1 : 0}
        WHERE site = ${site}
      `;
      loggerId = String(existing[0].id_logger);
    }

    // Origin RTS juga tersimpan di t_site (dipakai menghitung deformasi).
    // Kalau keduanya dibiarkan berbeda, perangkat memakai titik acuan yang lain
    // dari aplikasi dan selisihnya muncul sebagai "pergeseran" palsu — jadi
    // perbedaannya dilaporkan, bukan didiamkan.
    const siteRow = await prisma.site.findUnique({ where: { slug: site } });
    const selisihMm =
      siteRow?.rts_n != null && siteRow?.rts_e != null && siteRow?.rts_z != null
        ? {
            N: Math.round((parseFloat(coor_x) - siteRow.rts_n) * 1000),
            E: Math.round((parseFloat(coor_y) - siteRow.rts_e) * 1000),
            Z: Math.round((parseFloat(coor_z) - siteRow.rts_z) * 1000),
          }
        : null;
    const originBeda =
      selisihMm !== null &&
      (selisihMm.N !== 0 || selisihMm.E !== 0 || selisihMm.Z !== 0);

    // Logger diturunkan dari baris config site ini, bukan "logger ADR pertama".

    const mqttSent = await sendRtsConfig(loggerId, {
      jobName: job_name || "",
      prismConst: String(prisma_cons ?? "0"),
      tsHigh: String(ts_high ?? "0"),
      locCoor: [String(coor_x ?? "0"), String(coor_y ?? "0"), String(coor_z ?? "0")],
      stepRecord: parseInt(step_record) || 5,
      // Tanpa fallback `|| n`: keduanya sudah lolos validasi rentang di atas,
      // dan nilai cadangan yang lama (`|| 15` untuk cycleTime) justru DI LUAR
      // rentang sah 1000–600000 ms — kalau sampai terpakai, ia diam-diam
      // diganti bawaan oleh firmware persis seperti masalah yang diperbaiki.
      retries: parseInt(retries),
      cycleTime: parseInt(cycle_time),
      autoSearch: auto_search,
    });

    return NextResponse.json({
      success: true,
      mqtt_sent: mqttSent,
      site,
      id_logger: loggerId,
      peringatan: originBeda
        ? [
            `Titik origin yang dikirim ke RTS berbeda dari koordinat referensi site ` +
              `di Master Data (selisih N ${selisihMm!.N} mm, E ${selisihMm!.E} mm, ` +
              `Z ${selisihMm!.Z} mm). Perangkat dan perhitungan deformasi akan memakai ` +
              `acuan yang berbeda — samakan salah satunya.`,
          ]
        : [],
    });
  } catch (error) {
    console.error("[PUT /api/config-adr]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update config ADR" },
      { status: 500 }
    );
  }
}
