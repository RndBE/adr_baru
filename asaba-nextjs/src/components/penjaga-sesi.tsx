"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Penjaga sesi di sisi klien — pelengkap `src/proxy.ts`, bukan penggantinya.
 *
 * Proxy sudah menolak permintaan tanpa sesi, dan itu yang menjaga datanya.
 * Tapi proxy hanya berjalan kalau ada permintaan ke SERVER, dan tombol Back
 * sering tidak mengirim satu pun:
 *
 *   - App Router menangani Back sebagai navigasi sisi klien. Pohon React
 *     dipulihkan dari router cache, server tidak disentuh sama sekali.
 *   - Peramban juga punya back/forward cache sendiri, yang memulihkan halaman
 *     utuh beserta state-nya.
 *
 * Tanpa penjaga ini, yang terlihat sesudah Keluar lalu menekan Back adalah
 * kerangka dasbor lengkap dengan sidebar, berputar selamanya karena setiap
 * panggilan API di dalamnya dijawab 401. Datanya aman, layarnya berbohong.
 *
 * Header `Cache-Control: no-store` dari proxy TIDAK cukup: Next.js
 * menurunkannya jadi `no-cache` pada balasan halaman, dan itu masih
 * mengizinkan pemulihan dari bfcache.
 */
export function PenjagaSesi({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Diperiksa ulang SETIAP kali rute berubah, bukan sekali saat dipasang.
  //
  // `useSession()` tidak dipakai di sini dengan sengaja: nilainya berasal dari
  // cache provider dan ikut dibekukan bersama halaman yang dipulihkan, jadi ia
  // akan melaporkan sesi yang sudah lama mati sebagai masih hidup. Menanyakan
  // langsung ke endpoint-nya adalah satu-satunya jawaban yang tidak bisa basi.
  useEffect(() => {
    let batal = false;

    const periksa = async () => {
      try {
        const sesi = await fetch("/api/auth/session", { cache: "no-store" }).then((r) =>
          r.json()
        );
        if (!batal && !sesi?.user) router.replace("/login");
      } catch {
        // Jaringan putus BUKAN alasan mengusir operator dari halamannya —
        // proxy tetap menolak setiap permintaan yang benar-benar butuh sesi.
      }
    };

    periksa();

    // TIGA pemicu, karena tombol Back bisa berakhir di tiga jalur berbeda dan
    // hanya satu di antaranya yang membuat effect ini berjalan ulang:
    //
    //   popstate  — kembali di dalam dokumen yang sama. Pohon React dipulihkan
    //               dari router cache Next tanpa memasang ulang layout, jadi
    //               effect yang berkunci pada pathname tidak pernah jalan lagi.
    //   pageshow  — dokumen utuh dipulihkan dari back/forward cache peramban.
    //               Tidak ada yang dijalankan ulang sama sekali; `persisted`
    //               adalah satu-satunya penanda bahwa itu yang terjadi.
    //   focus     — tab ditinggal lama lalu dibuka lagi, sesinya keburu habis.
    const onPopState = () => void periksa();
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
      else void periksa();
    };
    const onFocus = () => void periksa();

    window.addEventListener("popstate", onPopState);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus);
    return () => {
      batal = true;
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname, router]);

  // Anak-anaknya tetap dirender selama pemeriksaan berjalan: menahannya membuat
  // seluruh dasbor berkedip kosong di setiap perpindahan halaman.
  return <>{children}</>;
}
