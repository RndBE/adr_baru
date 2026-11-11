import { NextRequest, NextResponse } from "next/server";
import { type PayloadMap, prosesDataMasukAdr, responsGagalAdr } from "@/lib/datamasuk-adr";

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

async function parsePayload(request: NextRequest): Promise<PayloadMap> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const json = (await request.json()) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(json).map(([key, value]) => [key, toStringValue(value)])
    );
  }

  const form = await request.formData();
  return Object.fromEntries(
    Array.from(form.entries()).map(([key, value]) => [key, toStringValue(value)])
  );
}

/**
 * POST /api/datamasuk/adr
 * Port of CI3 Datamasuk::add_adr().
 *
 * Accepts either JSON or form-urlencoded/form-data payloads using the
 * legacy field names: id_alat, tanggal, jam, sensor1..sensor25, sn.
 *
 * Pemrosesannya di src/lib/datamasuk-adr.ts, dipakai bersama route
 * `adr-json` (format Beacon dari Integration be-stesy.cloud).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let payload: PayloadMap;
  try {
    payload = await parsePayload(request);
  } catch (error) {
    return responsGagalAdr("adr", error);
  }
  return prosesDataMasukAdr(payload, "adr");
}
