import { NextRequest, NextResponse } from "next/server";
import { publishMqtt } from "@/lib/mqtt";
import { getLoggerForCommand } from "@/lib/sites";

/**
 * POST /api/mqtt
 * Publish perintah MQTT ke perangkat RTS.
 * Setara dengan Adr::go_target(), auto_search(), config_adr() di CI3.
 *
 * Body: {
 *   command: "go_target" | "auto_search" | "set_config" | "update_prisma"
 *   -- Tujuan perintah, opsional (tanpa keduanya: logger ADR pertama):
 *   id_logger?: string  — logger tujuan, atau
 *   site?: string       — loggernya diambil dari master data site
 *   payload?: object    (untuk custom payload)
 *   -- Jika command = "go_target"
 *   slot_id?: number
 *   -- Jika command = "set_config"
 *   job_name?, prisma_cons?, ts_high?, coor_x?, coor_y?, coor_z?,
 *   step_record?, retries?, cycle_time?
 *   -- Jika command = "update_prisma"
 *   slot_id?, nama_prisma?, target_height?
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { command } = body;

    if (!command) {
      return NextResponse.json(
        { success: false, error: "Field 'command' wajib diisi" },
        { status: 400 }
      );
    }

    // Urutan penentuan tujuan: `id_logger` eksplisit → dari `site` → fallback
    // lama "logger ADR pertama". Fallback terakhir dipertahankan supaya pemanggil
    // yang belum mengirim keduanya berperilaku sama seperti sebelum refactor.
    //
    // Fallback itu memakai LIMIT 1 tanpa ORDER BY, jadi tidak deterministik
    // begitu ada lebih dari satu unit ADR/RTS. Payload berbentuk
    // { set_<id_logger>: … } dan endpoint ini mengirim perintah yang
    // menggerakkan alat — kirim `id_logger` atau `site` agar tidak salah sasaran.
    let id_logger: string | null = body.id_logger ?? null;
    if (!id_logger) {
      id_logger = await getLoggerForCommand(body.site ? String(body.site) : null);
    }
    if (!id_logger) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Tujuan perintah tidak jelas — kirim `id_logger`, atau `site` yang " +
            "loggernya sudah terdaftar.",
        },
        { status: 400 }
      );
    }

    const topic = process.env.MQTT_TOPIC || "ADR_Tambang_Kaltara";
    let mqttPayload: Record<string, unknown> = {};

    switch (command) {
      case "go_target": {
        // Setara Adr::go_target() — mengarahkan RTS ke target tertentu
        const { slot_id } = body;
        if (!slot_id) {
          return NextResponse.json(
            { success: false, error: "slot_id wajib diisi untuk go_target" },
            { status: 400 }
          );
        }
        mqttPayload = {
          [`set_${id_logger}`]: {
            command: "set_rts",
            turning_target: slot_id,
          },
        };
        break;
      }

      case "auto_search": {
        // Setara Adr::auto_search() — RTS auto mencari target
        mqttPayload = {
          [`set_${id_logger}`]: {
            command: "set_rts",
            auto_search: true,
          },
        };
        break;
      }

      case "set_config": {
        // Setara Adr::config_adr() — kirim konfigurasi RTS lengkap
        const {
          job_name, prisma_cons, ts_high,
          coor_x, coor_y, coor_z,
          step_record, retries, cycle_time,
        } = body;

        mqttPayload = {
          [`set_${id_logger}`]: {
            command: "set_rts",
            jobName: job_name,
            prismConst: prisma_cons,
            tsHigh: ts_high,
            locCoor: [coor_x, coor_y, coor_z],
            stepRecord: parseInt(String(step_record)),
            retries: parseInt(String(retries)),
            cycleTime: parseInt(String(cycle_time)),
          },
        };
        break;
      }

      case "update_prisma": {
        // Setara Adr::update_prisma() — update data target prisma tertentu
        const { slot_id, nama_prisma, target_height } = body;
        if (!slot_id) {
          return NextResponse.json(
            { success: false, error: "slot_id wajib diisi untuk update_prisma" },
            { status: 400 }
          );
        }
        mqttPayload = {
          [`set_${id_logger}`]: {
            command: "set_rts",
            recordTarget: {
              slot: parseInt(String(slot_id)),
              name: nama_prisma,
              targetHigh: target_height ?? 0,
            },
          },
        };
        break;
      }

      case "custom": {
        // Kirim payload custom langsung
        if (!body.payload) {
          return NextResponse.json(
            { success: false, error: "payload wajib diisi untuk command custom" },
            { status: 400 }
          );
        }
        mqttPayload = body.payload;
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: `Command '${command}' tidak dikenali` },
          { status: 400 }
        );
    }

    const sent = await publishMqtt(topic, mqttPayload);

    return NextResponse.json({
      success: true,
      mqtt_sent: sent,
      command,
      id_logger,
      payload: mqttPayload,
    });
  } catch (error) {
    console.error("[POST /api/mqtt]", error);
    return NextResponse.json(
      { success: false, error: "Failed to publish MQTT command" },
      { status: 500 }
    );
  }
}
