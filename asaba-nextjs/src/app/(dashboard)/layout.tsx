"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/beranda": "Dashboard",
  "/analisa": "Analisa",
  "/monitoring": "Monitoring",
  "/masterdata": "Masterdata",
  "/pengaturan": "Pengaturan",
  "/kontrol-adr": "Kontrol ADR",
  "/prism-config": "Prism Configuration",
  "/hasil-pengukuran": "Hasil Pengukuran",
  "/visualisasi-3d": "Visualisasi 3D",
  "/peta-jaringan-tambang/3d": "Peta Jaringan Tambang 3D",
  "/peta-jaringan-tambang": "Peta Jaringan Tambang",
  "/rekap-data": "Rekap Data Masuk",
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
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur-lg bg-white md:px-4">
          <SidebarTrigger className="-ml-1 md:hidden" />
          <Separator orientation="vertical" className="h-5 md:hidden" />
          <h1 className="text-sm font-semibold tracking-tight">{title}</h1>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6 bg-white min-w-0">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
