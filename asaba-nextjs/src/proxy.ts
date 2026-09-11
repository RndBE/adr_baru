/**
 * Penjaga rute — SEBELUMNYA TIDAK ADA SAMA SEKALI.
 *
 * Aplikasi ini punya halaman Masuk, tapi tidak ada satu pun bagian yang
 * memeriksa apakah seseorang sudah masuk. Tidak ada berkas proxy/middleware,
 * layout dashboard tidak memanggil `auth()`, dan tidak satu pun route API
 * memeriksa sesi. Akibatnya, sebelum berkas ini ada:
 *
 *   curl https://demo-adr.monitoring4system.com/api/users
 *   → 200, daftar akun lengkap, tanpa cookie apa pun
 *
 * Seluruh halaman dasbor dan seluruh API terbuka untuk siapa saja yang tahu
 * alamatnya. Halaman Masuk hanya hiasan.
 *
 * Itu juga sebab gejala yang dilaporkan: sesudah Keluar, menekan tombol Back
 * peramban menampilkan dasbor lagi. Bukan karena sesinya masih hidup — memang
 * tidak pernah ada yang memeriksanya.
 *
 * Di Next.js 16 berkas ini bernama `proxy.ts`; `middleware.ts` sudah usang.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Jalur yang WAJIB tetap terbuka.
 *
 * Bukan kelonggaran: ketiganya dipanggil oleh pihak yang memang tidak punya
 * sesi peramban, dan menutupnya akan mematikan fungsi yang sedang berjalan.
 *
 * - `/api/auth`      — endpoint Auth.js sendiri. Menutupnya membuat login
 *                      mustahil, termasuk bagi yang berhak.
 * - `/api/datamasuk` — logger menembakkan data berkalanya ke sini lewat HTTP
 *                      polos, tanpa cookie. Menutupnya menghentikan seluruh
 *                      aliran data pengukuran.
 * - `/api/mobile`    — punya skema sendiri: `/api/mobile/login` mengembalikan
 *                      token acak, bukan cookie Auth.js.
 * - `/login`         — tujuan pengalihannya sendiri.
 */
const JALUR_TERBUKA = ["/login", "/api/auth", "/api/datamasuk", "/api/mobile"];

function terbuka(path: string): boolean {
  return JALUR_TERBUKA.some((p) => path === p || path.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (terbuka(pathname)) return NextResponse.next();

  // KEDUA nama cookie dicoba, tidak diturunkan dari protokol permintaan.
  //
  // Auth.js memasang awalan `__Secure-` berdasarkan skema di AUTH_URL, BUKAN
  // skema permintaan yang masuk. Di produksi kedua hal itu tidak sama:
  // `AUTH_URL="http://demo-adr.monitoring4system.com"` sementara situsnya
  // disajikan lewat HTTPS. Menebak dari `request.nextUrl.protocol` karena itu
  // akan mencari `__Secure-authjs.session-token` yang tidak pernah ada, dan
  // MENGUNCI SEMUA ORANG di luar — termasuk yang sudah benar masuk.
  //
  // Mencoba keduanya juga membuat penjaga ini selamat kalau AUTH_URL nanti
  // dibetulkan ke https: nama cookie-nya berubah, penjaga ini tidak perlu ikut
  // diubah.
  const namaKandidat = ["__Secure-authjs.session-token", "authjs.session-token"];
  let token = null;
  for (const namaCookie of namaKandidat) {
    token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      // Di Auth.js v5, `salt` adalah nama cookie-nya.
      salt: namaCookie,
      cookieName: namaCookie,
      secureCookie: namaCookie.startsWith("__Secure-"),
    });
    if (token) break;
  }

  if (token) {
    const res = NextResponse.next();
    // Tanpa ini, menekan Back sesudah Keluar menampilkan dasbor dari cache
    // peramban — halaman yang sudah ter-render tidak menyentuh server lagi,
    // jadi penjaga ini tidak akan pernah dijalankan untuk permintaan itu.
    if (!pathname.startsWith("/api/")) {
      res.headers.set("Cache-Control", "no-store, must-revalidate");
    }
    return res;
  }

  // API menjawab 401, bukan dialihkan: pemanggilnya kode, dan halaman HTML
  // sebagai balasan `fetch` hanya jadi galat parse yang menyesatkan.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { success: false, error: "Tidak masuk. Silakan login lebih dulu." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const tujuan = new URL("/login", request.url);
  const res = NextResponse.redirect(tujuan);
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

export const config = {
  /**
   * Semua kecuali berkas statis Next dan aset di /public.
   *
   * Daftar ekstensinya sengaja eksplisit: pola "punya titik" akan ikut
   * meloloskan rute yang kebetulan bertitik, dan itu lubang yang tidak
   * kelihatan.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|woff|woff2|ttf|eot)$).*)",
  ],
};
