import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishMqtt } from "@/lib/mqtt";
import { getLoggerForCommand } from "@/lib/sites";

/**
 * POST /api/kontrol/go-to-target
 * Kirim perintah turning_target ke logger via MQTT.
 *
 * Body: { slot_id: number, site?: string }
 *
 * Payload MQTT:
 * {"set_XXXXX": {"command":"set_rts","turning_target":"<id dari t_prisma>"}}
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
    const prismaRows = site
      ? await prisma.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM t_prisma WHERE id_prisma = ${id_prisma} AND site = ${site} LIMIT 1
        `
      : await prisma.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM t_prisma WHERE id_prisma = ${id_prisma} AND id_logger = ${id_logger} LIMIT 1
        `;
    const prismaId = prismaRows?.[0]?.id;
    if (prismaId === undefined || prismaId === null) {
      return NextResponse.json(
        { success: false, error: `Prisma ${id_prisma} tidak ditemukan` },
        { status: 404 }
      );
    }

    // Kirim MQTT
    const topicTarget = process.env.MQTT_TOPIC || "ADR_Tambang_Kaltara";
    const payload = {
      [`set_${id_logger}`]: {
        command: "set_rts",
        // Dikirim sebagai ANGKA, bukan string. Protokolnya (Bagian C.1)
        // mendefinisikan turning_target bertipe int; keringanan "nilai kunci
        // tidak diperiksa" hanya berlaku untuk perintah aksi yang nilainya
        // memang diabaikan, sedangkan di sini nilainya adalah targetnya.
        turning_target: Number(prismaId),
      },
    };
    const mqttSent = await publishMqtt(topicTarget, payload);

    return NextResponse.json({
      success: true,
      data: { turning_target: prismaId, mqtt_sent: mqttSent },
    });
  } catch (error) {
    console.error("[POST /api/kontrol/go-to-target]", error);
    return NextResponse.json(
      { success: false, error: "Failed to send go-to-target" },
      { status: 500 }
    );
  }
}
