"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";

/**
 * URUTAN PENTING. Judul dicari dengan `startsWith` dan yang cocok pertama yang
 * dipakai, jadi rute yang lebih spesifik harus didaftarkan lebih dulu —
 * "/peta-jaringan-tambang/3d" sebelum "/peta-jaringan-tambang", kalau tidak
 * halaman 3D akan memakai judul induknya.
 */
const pageTitles: Record<string, string> = {
  "/beranda": "Dashboard",
  "/analisa": "Analisa",
  "/monitoring": "Monitoring",
  // "/master-data" harus di atas "/masterdata"? Tidak — keduanya string
  // berbeda dan tak saling berawalan, jadi urutannya bebas.
  "/master-data": "Master Data",
  "/masterdata": "Masterdata",
  "/pengaturan": "Pengaturan",
  "/kontrol-adr": "Kontrol ADR",
  "/prism-config": "Prism Configuration",
  "/hasil-pengukuran": "Hasil Pengukuran",
  "/visualisasi-3d": "Visualisasi 3D",
  "/peta-jaringan-tambang/3d": "Peta Jaringan Tambang 3D",
  "/peta-jaringan-tambang": "Peta Jaringan Tambang",
  "/rekap-data": "Rekap Data Masuk",
  "/power-rts": "Power RTS",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const title =
    Object.entries(pageTitles).find(([key]) => pathname.startsWith(key))?.[1] ??
    "Dashboard";

  /**
   * Halaman yang mengatur gutter-nya sendiri. Kalau layout ikut memberi padding,
   * hasilnya dua lapis (24px + 24px) dan konten terlihat mengambang di dalam
   * bingkai — bukan itu yang diinginkan untuk halaman selebar tabel.
   *
   * Tiga halaman terakhir sebelumnya membatalkan gutter layout dengan margin
   * negatif `-m-4 md:-m-6` di wrapper-nya sendiri. Cara itu BOCOR: anaknya jadi
   * 48px lebih lebar dari <main> (24px menjorok ke kiri, 24px meluber ke kanan),
   * sehingga seluruh isi halaman meleset dari kolom kontennya dan <main>
   * memunculkan overflow horizontal. Paling kentara di layar 1366.
   */
  const RUTE_FULL_BLEED = ["/master-data", "/kontrol-adr", "/beranda", "/power-rts"];
  /**
   * Cocok PERSIS, bukan berawalan. "/hasil-pengukuran" memakai tema monitoring
   * dan memasang paddingnya sendiri, tapi sub-rutenya
   * "/hasil-pengukuran/<nama-prisma>" belum — kalau dicocokkan dengan
   * startsWith, halaman detail itu kehilangan gutter dan isinya menempel ke
   * tepi layar.
   */
  const RUTE_FULL_BLEED_PERSIS = ["/hasil-pengukuran", "/prism-config", "/visualisasi-3d"];
  const fullBleed =
    RUTE_FULL_BLEED_PERSIS.includes(pathname) ||
    RUTE_FULL_BLEED.some((r) => pathname.startsWith(r));

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        {/* Top Header */}
        {/* Tombol ciutkan sidebar tinggal di sini, bukan di dalam sidebar.
            Sebelumnya ada dua: satu di header tapi `md:hidden` (mobile saja),
            satu lagi di header sidebar untuk desktop. */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-white/85 px-3 backdrop-blur-lg md:px-5">
          {/* Tanpa Separator vertikal di antara tombol dan judul: garis 1×20px
              itu menggantung di tengah header tanpa tersambung ke apa pun, dan
              warnanya sama dengan border bawah header sehingga terbaca sebagai
              garis yang terputus. Jarak `gap-3` sudah cukup memisahkan. */}
          <SidebarTrigger className="-ml-1 h-8 w-8 flex-shrink-0 cursor-pointer rounded-md text-muted-foreground hover:bg-[#F4F6F9] hover:text-foreground" />
          <h1 className="truncate text-lg font-bold tracking-tight text-gray-900">{title}</h1>
        </header>

        {/* Page Content.
            <div>, bukan <main>: SidebarInset di atasnya SUDAH merender <main>
            (lihat data-slot="sidebar-inset" di components/ui/sidebar.tsx), jadi
            elemen ini membuat dokumen punya dua landmark utama di setiap
            halaman dashboard. Kelasnya tidak berubah — hanya tag-nya. */}
        <div
          className={`flex-1 overflow-auto bg-white min-w-0 ${
            fullBleed ? "" : "p-4 md:p-6"
          }`}
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
