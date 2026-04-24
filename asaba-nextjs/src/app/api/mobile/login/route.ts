import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * GET /api/mobile/login?username=xxx&password=xxx
 * Setara CI3 Api::login_app2()
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username") || "";
    const password = searchParams.get("password") || "";

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "username dan password wajib diisi" },
        { status: 400 }
      );
    }

    const hashedPassword = crypto.createHash("md5").update(password).digest("hex");

    const users = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM user WHERE username = ${username} AND password = ${hashedPassword} LIMIT 1
    `;

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Username atau password salah",
      });
    }

    const user = users[0];
    return NextResponse.json({
      success: true,
      data: {
        id_user: user.id_user,
        username: user.username,
        nama: user.nama,
        level: user.level,
      },
    });
  } catch (error) {
    console.error("[GET /api/mobile/login]", error);
    return NextResponse.json(
      { success: false, error: "Login failed" },
      { status: 500 }
    );
  }
}
