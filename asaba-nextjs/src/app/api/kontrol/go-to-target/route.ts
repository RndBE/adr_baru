import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishMqtt, topikPerintah } from "@/lib/mqtt";
import { getLoggerForCommand } from "@/lib/sites";

/**
 * POST /api/kontrol/go-to-target
 * Kirim perintah turning_target ke logger via MQTT.
 *
 * Body: { slot_id: number, site?: string }
 *
 * Payload MQTT:
 * {"set_XXXXX": {"command":"set_rts","turning_target":<nomor slot 1-50>}}
 *
 * `turning_target` adalah NOMOR SLOT, bukan primary key t_prisma. Instrumen
 * hanya mengenal slot 1–50 yang diisi lewat recordTarget:
 *
 *   {"recordTarget":{"slot":1,"name":"P1", …}}   ← disimpan di slot 1
 *   {"turning_target":1}                          ← putar ke slot 1
 *
 * Id database tidak pernah dikirim ke perangkat dan tidak berarti apa-apa
 * baginya.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slot_id, site } = body;

    if (!slot_id) {
      return NextResponse.json(
        { success: false, error: "slot_id wajib diisi" },
        { status: 400 }
      );
    }

    // Nomor slot divalidasi SEBELUM menyentuh database: instrumen hanya punya
    // slot 1–50, jadi nilai di luar itu tidak akan pernah sah berapa pun isi
    // tabelnya. Kalau diperiksa belakangan, slot 51 keburu kena 404 "tidak
    // ditemukan" yang menyesatkan — seolah tinggal didaftarkan.
    const nomorSlot = Number(slot_id);
    if (!Number.isInteger(nomorSlot) || nomorSlot < 1 || nomorSlot > 50) {
      return NextResponse.json(
        { success: false, error: "slot_id harus bilangan bulat 1–50" },
        { status: 400 }
      );
    }

    const id_prisma = `P${slot_id}`;

    // `site` OPSIONAL — tanpa itu perilakunya sama seperti sebelum refactor.
    const id_logger = await getLoggerForCommand(site);
    if (!id_logger) {
      return NextResponse.json(
        {
          success: false,
          error: site
            ? `Logger untuk site "${site}" tidak ditemukan`
            : "ADR logger not found",
        },
        { status: 404 }
      );
    }

    // Target dicari per site bila site diketahui. Tanpa site, dipakai penyaringan
    // lama (per logger) — dan itu AMBIGU: satu unit RTS bisa melayani beberapa
    // site, sehingga slot "P1" cocok ke lebih dari satu baris t_prisma yang
    // menunjuk target fisik berbeda (di data ini ccp/"A" dan viewpoint/"TS_1",
    // berjarak ~1,5 km), lalu LIMIT 1 memilih salah satu tanpa urutan pasti.
    // Kirim `site` untuk memastikan teleskop diputar ke target yang benar.
    // Query ini SEMATA-MATA penjaga keberadaan: memastikan slotnya memang
    // terdaftar untuk site itu sebelum menyuruh teleskop berputar. Nilai `id`
    // yang dikembalikannya TIDAK dipakai sebagai target.
    const prismaRows = site
      ? await prisma.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM t_prisma WHERE id_prisma = ${id_prisma} AND site = ${site} LIMIT 1
        `
      : await prisma.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM t_prisma WHERE id_prisma = ${id_prisma} AND id_logger = ${id_logger} LIMIT 1
        `;
    if (!prismaRows?.length) {
      return NextResponse.json(
        { success: false, error: `Prisma ${id_prisma} tidak ditemukan` },
        { status: 404 }
      );
    }

    // Nomor slot, bukan id database.
    //
    // Kode lama mengirim `t_prisma.id` — primary key yang tidak pernah diketahui
    // instrumen. Kebetulan lolos di site ccp karena di sana P1 dan P2 memang
    // ber-id 1 dan 2, tapi P3 sudah ber-id 35, dan di viewpoint P1 ber-id 42.
    // Jadi teleskop diputar ke slot yang salah — atau ke slot kosong — untuk
    // hampir semua target di luar dua slot pertama site ccp.
    //
    // Kirim MQTT
    const topicTarget = topikPerintah(id_logger);
    const payload = {
      [`set_${id_logger}`]: {
        command: "set_rts",
        // Dikirim sebagai ANGKA, bukan string. Protokolnya (Bagian C.1)
        // mendefinisikan turning_target bertipe int; keringanan "nilai kunci
        // tidak diperiksa" hanya berlaku untuk perintah aksi yang nilainya
        // memang diabaikan, sedangkan di sini nilainya adalah targetnya.
        turning_target: nomorSlot,
      },
    };
    const mqttSent = await publishMqtt(topicTarget, payload);

    return NextResponse.json({
      success: true,
      data: { turning_target: nomorSlot, mqtt_sent: mqttSent },
    });
  } catch (error) {
    console.error("[POST /api/kontrol/go-to-target]", error);
    return NextResponse.json(
      { success: false, error: "Failed to send go-to-target" },
      { status: 500 }
    );
  }
}
