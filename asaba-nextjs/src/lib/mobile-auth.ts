/**
 * Token bearer untuk klien mobile.
 *
 * Sebelum berkas ini, `/api/mobile/login` mengembalikan
 * `crypto.randomBytes(24)` yang TIDAK PERNAH DISIMPAN ke mana pun — tidak ke
 * tabel, tidak ke cache. Token itu karena itu tidak bisa diverifikasi oleh
 * siapa pun, termasuk oleh servernya sendiri. Akibatnya aplikasi mobile tidak
 * punya jalan sah untuk memanggil `/api/sites`, `/api/kontrol/*`, dan kawan-
 * kawannya: semuanya dijaga `proxy.ts` lewat cookie Auth.js, dan cookie itu
 * lahir dari alur credentials di peramban yang tidak dimiliki aplikasi native.
 *
 * Jadi token sekarang ditandatangani, bukan diundi. Payloadnya memuat identitas
 * pengguna, ditandatangani HS256 dengan AUTH_SECRET yang sama dengan Auth.js,
 * sehingga `proxy.ts` bisa memverifikasinya tanpa menyentuh basis data — penjaga
 * itu berjalan pada setiap permintaan, jadi satu query per permintaan hanya
 * untuk memeriksa token adalah ongkos yang tidak perlu.
 *
 * ponytail: token stateless, tidak ada daftar cabut. Satu-satunya cara
 * mematikan token sebelum kedaluwarsa adalah mengganti AUTH_SECRET (yang
 * mematikan semua sesi sekaligus). Kalau nanti perlu cabut per-perangkat,
 * tambahkan tabel `mobile_token` berisi jti + tanggal cabut lalu periksa di
 * `verifikasiTokenMobile()`. Belum dibuat karena belum ada yang memintanya.
 */
import { SignJWT, jwtVerify } from "jose";

/** 30 hari. Operator lapangan tidak login ulang tiap hari. */
export const MASA_BERLAKU_TOKEN = "30d";

const PENERBIT = "beacon-mobile";

export type IsiTokenMobile = {
  id_user: number;
  username: string;
  nama: string;
  level: string;
};

function kunci(): Uint8Array {
  const rahasia = process.env.AUTH_SECRET;
  if (!rahasia) {
    // Dilempar, bukan di-default: token yang ditandatangani string kosong
    // sama saja dengan tidak ada autentikasi, dan itu gagal diam-diam.
    throw new Error("AUTH_SECRET belum disetel; token mobile tidak bisa dibuat");
  }
  return new TextEncoder().encode(rahasia);
}

export async function buatTokenMobile(isi: IsiTokenMobile): Promise<string> {
  return new SignJWT({ ...isi })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(isi.id_user))
    .setIssuer(PENERBIT)
    .setIssuedAt()
    .setExpirationTime(MASA_BERLAKU_TOKEN)
    .sign(kunci());
}

export async function verifikasiTokenMobile(
  token: string
): Promise<IsiTokenMobile | null> {
  try {
    const { payload } = await jwtVerify(token, kunci(), { issuer: PENERBIT });
    return {
      id_user: Number(payload.id_user),
      username: String(payload.username ?? ""),
      nama: String(payload.nama ?? ""),
      level: String(payload.level ?? ""),
    };
  } catch {
    return null;
  }
}

/** Ambil token dari header `Authorization: Bearer <token>`. */
export function tokenDariHeader(header: string | null): string | null {
  if (!header) return null;
  const cocok = /^Bearer\s+(.+)$/i.exec(header.trim());
  return cocok ? cocok[1].trim() : null;
}
