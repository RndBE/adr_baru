import { NextRequest, NextResponse } from "next/server";
import { prosesDataMasukAdr } from "@/lib/datamasuk-adr";
import { kunciApiCocok } from "@/lib/kunci-api";
import { beaconKePayloadAdr } from "@/lib/payload-beacon";

/**
 * POST /api/datamasuk/adr-json
 *
 * Pintu masuk data ADR dalam format Beacon, untuk logger yang didaftarkan di
 * be-stesy.cloud. Alurnya sama seperti logger lain di sana:
 *
 *   logger → MQTT Logger_<id> → bridge → be-stesy.cloud /api/v1/device/push
 *          → Integration "Demo ADR" → POST /api/datamasuk/adr-json
 *
 * Integration meneruskan payload apa adanya ({"sensorN": {"nama","nilai",
 * "satuan"}, "hari", "jam"}); src/lib/payload-beacon.ts mengubahnya ke bentuk
 * datar, lalu pemrosesannya sama persis dengan `/api/datamasuk/adr`
 * (src/lib/datamasuk-adr.ts).
 *
 * Wajib header `X-API-Key` yang sama dengan env `DATAMASUK_ADR_JSON_KEY`
 * (di Integration be-stesy.cloud: Auth = API Key, header X-API-Key). Rute
 * `/api/datamasuk` memang terbuka di proxy.ts karena logger tidak membawa
 * cookie, jadi kunci ini satu-satunya penjaga pintu ini. Env kosong → semua
 * kiriman ditolak 503, bukan dibiarkan terbuka.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const kunciServer = process.env.DATAMASUK_ADR_JSON_KEY?.trim();
  if (!kunciServer) {
    console.error("[datamasuk/adr-json] DATAMASUK_ADR_JSON_KEY belum disetel; kiriman ditolak.");
    return NextResponse.json(
      { success: false, error: "Endpoint belum dikonfigurasi." },
      { status: 503 }
    );
  }

  if (!kunciApiCocok(request.headers.get("x-api-key"), kunciServer)) {
    const dari = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "?";
    console.warn(`[datamasuk/adr-json] X-API-Key tidak valid dari ${dari}`);
    return NextResponse.json(
      { success: false, error: "X-API-Key tidak valid." },
      { status: 401 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Badan request bukan JSON yang sah." },
      { status: 400 }
    );
  }

  const hasil = beaconKePayloadAdr(json);
  if (!hasil.ok) {
    console.warn(`[datamasuk/adr-json] payload ditolak (${hasil.status}): ${hasil.galat}`);
    return NextResponse.json(
      { success: false, error: hasil.galat },
      { status: hasil.status }
    );
  }

  return prosesDataMasukAdr(hasil.payload, "adr-json");
}
