import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import crypto from "crypto";

async function verifyPassword(inputPassword: string, storedHash: string) {
  try {
    const bcryptMatch = await compare(inputPassword, storedHash);
    if (bcryptMatch) return true;
  } catch {
    // Not a bcrypt hash, continue with legacy checks.
  }

  const hashedPassword = crypto
    .createHash("md5")
    .update(inputPassword)
    .digest("hex");
  return hashedPassword === storedHash || inputPassword === storedHash;
}

async function authenticate(username: string, password: string) {
  if (!username || !password) {
    return NextResponse.json(
      {
        success: false,
        error: "username dan password wajib diisi",
        message: "username dan password wajib diisi",
      },
      { status: 400 }
    );
  }

  const user = await prisma.user.findFirst({
    where: { username },
  });

  if (!user || !(await verifyPassword(password, user.password))) {
    return NextResponse.json(
      {
        success: false,
        error: "Username atau password salah",
        message: "Username atau password salah",
      },
      { status: 401 }
    );
  }

  const payload = {
    id_user: user.id_user,
    token: crypto.randomBytes(24).toString("hex"),
    username: user.username,
    nama: user.nama,
    level: user.level_user,
  };

  return NextResponse.json({
    success: true,
    ...payload,
    data: payload,
  });
}

/**
 * GET /api/mobile/login?username=xxx&password=xxx
 * Setara CI3 Api::login_app2()
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username") || "";
    const password = searchParams.get("password") || "";

    return authenticate(username, password);
  } catch (error) {
    console.error("[GET /api/mobile/login]", error);
    return NextResponse.json(
      { success: false, error: "Login failed", message: "Login failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = String(body.username || "");
    const password = String(body.password || "");

    return authenticate(username, password);
  } catch (error) {
    console.error("[POST /api/mobile/login]", error);
    return NextResponse.json(
      { success: false, error: "Login failed", message: "Login failed" },
      { status: 500 }
    );
  }
}
