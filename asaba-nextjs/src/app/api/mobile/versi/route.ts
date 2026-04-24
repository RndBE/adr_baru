import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/mobile/versi?platform=android|ios
 * Setara CI3 Api::notif_versi() / notif_versi_ios()
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform") || "android";

  if (platform === "ios") {
    return NextResponse.json({
      versi: "1.3.2",
      link: "",
      status: true,
      pesan: "Sistem Menyala",
    });
  }

  return NextResponse.json({
    versi: "1.1.1",
    link: "",
    status: true,
    pesan: "Sistem Menyala",
  });
}
