import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * POST /api/mobile/webhook
 * Setara CI3 Api::receive()
 */
export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return NextResponse.json({ status: false, message: "Invalid JSON" }, { status: 400 });
    }

    const logDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, "webhook.log"), `[${new Date().toISOString()}] ${raw}\n`);

    return NextResponse.json({ status: true, message: "Webhook received", received: data });
  } catch (error) {
    console.error("[POST /api/mobile/webhook]", error);
    return NextResponse.json({ status: false, message: "Failed" }, { status: 500 });
  }
}
