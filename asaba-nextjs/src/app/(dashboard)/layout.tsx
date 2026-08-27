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

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6 bg-white min-w-0">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
