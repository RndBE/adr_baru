import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/notifikasi
 * Setara CI3 Kontrol::notif_aplikasi() / notif_aplikasi_selesai()
 * Body: { type: "start" | "selesai", topic?: string, title?: string, body?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const reqBody = await request.json();
    const { type = "start", topic, title, body: bodyMsg } = reqBody;

    const fcmUrl = process.env.FCM_URL || "https://fcm.googleapis.com/fcm/send";
    const fcmKey = process.env.FCM_SERVER_KEY || "";

    if (!fcmKey) {
      return NextResponse.json({ success: false, error: "FCM_SERVER_KEY not configured in .env" }, { status: 500 });
    }

    let payload: Record<string, unknown>;

    if (type === "selesai") {
      payload = {
        to: topic || "/topics/kontrol_pintu",
        notification: {
          title: title || "Kontrol Selesai",
          body: bodyMsg || "Kontrol dapat digunakan kembali",
        },
      };
    } else {
      payload = {
        to: topic || "/topics/kontrol_pintu",
        notification: {
          title: title || "Kontrol Sedang Digunakan",
          body: bodyMsg || "Sedang beroperasi",
        },
      };
    }

    const res = await fetch(fcmUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${fcmKey}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await res.text();

    return NextResponse.json({ success: true, fcm_response: result });
  } catch (error) {
    console.error("[POST /api/notifikasi]", error);
    return NextResponse.json({ success: false, error: "Failed to send notification" }, { status: 500 });
  }
}
