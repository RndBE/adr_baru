"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { LogOut, Database, Settings2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type SidebarIconProps = {
  className?: string;
  isActive?: boolean;
};

/** Ukuran ikon seragam untuk seluruh sidebar, termasuk tombol Keluar. */
const ICON_CLASS =
  "h-[18px] w-[18px] flex-shrink-0 group-data-[collapsible=icon]:h-5 group-data-[collapsible=icon]:w-5";

/**
 * Ikon dari file SVG, diwarnai lewat CSS mask.
 *
 * Sebelumnya file-file ini dimuat sebagai <Image> lalu diwarnai paksa dengan
 * filter `brightness-0 invert` (untuk putih) dan `brightness-0 opacity-60`
 * (untuk abu). Itu perlu karena warna di dalam file-nya sendiri tidak seragam —
 * ada yang `black`, ada `white`, dan kontrol_adr_fill.svg malah `#303481`.
 * Akibatnya tiap ikon mendarat di abu yang sedikit berbeda dan tak ada yang
 * benar-benar sama dengan warna teks di sebelahnya.
 *
 * Dengan mask, yang dipakai hanya bentuk (alpha) file-nya; warnanya datang dari
 * `bg-current`, jadi selalu identik dengan warna label. Varian `_fill` tetap
 * dipakai, tapi kini murni untuk perbedaan BENTUK (outline → solid saat aktif),
 * bukan untuk warna.
 */
const MaskIcon = ({ basePath, className, isActive }: SidebarIconProps & { basePath: string }) => {
  const src = isActive ? `${basePath}_fill.svg` : `${basePath}.svg`;
  return (
    <span
      aria-hidden="true"
      className={cn("block bg-current", className)}
      style={{
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
      }}
    />
  );
};

// Dashboard: SVG inline supaya bisa berubah dari outline ke solid saat aktif.
const DashboardIcon = ({ className, isActive }: SidebarIconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill={isActive ? "currentColor" : "none"}
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M19.318 13.5H15.443C14.9293 13.4995 14.4364 13.7027 14.0724 14.065C13.7083 14.4274 13.5029 14.9193 13.501 15.433V19.308C13.5007 19.5631 13.5508 19.8158 13.6483 20.0515C13.7458 20.2872 13.8888 20.5014 14.0692 20.6818C14.2496 20.8622 14.4638 21.0052 14.6995 21.1027C14.9353 21.2002 15.1879 21.2503 15.443 21.25H19.318C19.8315 21.2479 20.3232 21.0423 20.6853 20.6783C21.0475 20.3142 21.2505 19.8215 21.25 19.308V15.433C21.2503 15.1792 21.2005 14.9279 21.1035 14.6933C21.0065 14.4588 20.8642 14.2457 20.6847 14.0663C20.5053 13.8868 20.2922 13.7445 20.0577 13.6475C19.8231 13.5505 19.5718 13.5007 19.318 13.501M8.557 13.5H4.682C4.16859 13.5029 3.67721 13.7089 3.3152 14.073C2.95319 14.437 2.74999 14.9296 2.75 15.443V19.318C2.74974 19.5718 2.79953 19.8231 2.89653 20.0577C2.99353 20.2922 3.13583 20.5053 3.31528 20.6847C3.49474 20.8642 3.70783 21.0065 3.94235 21.1035C4.17687 21.2005 4.42821 21.2503 4.682 21.25H8.557C9.07048 21.2505 9.56324 21.0475 9.92726 20.6853C10.2913 20.3232 10.4969 19.8315 10.499 19.318V15.443C10.4993 15.1879 10.4492 14.9353 10.3517 14.6995C10.2542 14.4638 10.1112 14.2496 9.93079 14.0692C9.75041 13.8888 9.53622 13.7458 9.30048 13.6483C9.06475 13.5508 8.8121 13.5007 8.557 13.501M8.557 2.75H4.682C4.42821 2.74974 4.17687 2.79953 3.94235 2.89653C3.70783 2.99353 3.49474 3.13583 3.31528 3.31528C3.13583 3.49474 2.99353 3.70783 2.89653 3.94235C2.79953 4.17687 2.74974 4.42821 2.75 4.682V8.557C2.74947 9.07048 2.95253 9.56324 3.31468 9.92726C3.67683 10.2913 4.16852 10.4969 4.682 10.499H8.557C8.8121 10.4993 9.06475 10.4492 9.30048 10.3517C9.53622 10.2542 9.75041 10.1112 9.93079 9.93079C10.1112 9.75041 10.2542 9.53622 10.3517 9.30048C10.4492 9.06475 10.4993 8.8121 10.499 8.557V4.682C10.4969 4.16852 10.2913 3.67683 9.92726 3.31468C9.56324 2.95253 9.07048 2.74947 8.557 2.75ZM19.318 2.75H15.443C14.9295 2.74947 14.4368 2.95253 14.0727 3.31468C13.7087 3.67683 13.5031 4.16852 13.501 4.682V8.557C13.5013 9.07197 13.706 9.56577 14.0701 9.92991C14.4342 10.294 14.928 10.4987 15.443 10.499H19.318C19.8315 10.4969 20.3232 10.2913 20.6853 9.92726C21.0475 9.56324 21.2505 9.07048 21.25 8.557V4.682C21.2503 4.42821 21.2005 4.17687 21.1035 3.94235C21.0065 3.70783 20.8642 3.49474 20.6847 3.31528C20.5053 3.13583 20.2922 2.99353 20.0577 2.89653C19.8231 2.79953 19.5718 2.74974 19.318 2.75Z"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

type NavItem = {
  title: string;
  href: string;
  /**
   * Ikon sebagai fungsi, bukan komponen bertipe SidebarIconProps: ikon lucide
   * meneruskan prop yang tak dikenalnya ke <svg>, jadi `isActive` akan bocor
   * sebagai atribut DOM dan memicu peringatan React. Di sini tiap item yang
   * memutuskan sendiri apakah peduli pada status aktif.
   */
  icon: (active: boolean) => React.ReactNode;
};

/**
 * Menu dikelompokkan menurut pekerjaan yang dilakukan operator: menjalankan
 * perangkat, membaca hasilnya, atau mengurus master data. Sebelumnya kedelapan
 * menu ini satu daftar rata tanpa penanda, sehingga "Prism Config" (mengatur
 * RTS) terbaca sederajat dengan "Rekap Data" (membaca hasil).
 *
 * Urutan lama dipertahankan semaksimal mungkin — hanya Prism Config yang
 * berpindah naik, supaya berdampingan dengan Kontrol ADR yang menyasar
 * perangkat yang sama.
 */
const navBeranda: NavItem = {
  title: "Dashboard",
  href: "/beranda",
  icon: (active) => <DashboardIcon className={ICON_CLASS} isActive={active} />,
};

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Perangkat",
    items: [
      {
        title: "Kontrol ADR",
        href: "/kontrol-adr",
        icon: (active) => <MaskIcon basePath="/kontrol_adr" className={ICON_CLASS} isActive={active} />,
      },
      {
        title: "Prism Config",
        href: "/prism-config",
        icon: (active) => <MaskIcon basePath="/prism_config" className={ICON_CLASS} isActive={active} />,
      },
    ],
  },
  {
    label: "Data Pengukuran",
    items: [
      {
        title: "Hasil Pengukuran",
        href: "/hasil-pengukuran",
        icon: (active) => <MaskIcon basePath="/hasil_pengukuran" className={ICON_CLASS} isActive={active} />,
      },
      {
        title: "Visualisasi 3D",
        href: "/visualisasi-3d",
        icon: (active) => <MaskIcon basePath="/3d" className={ICON_CLASS} isActive={active} />,
      },
      // Dinonaktifkan dari sidebar 29 Agustus 2026 atas permintaan. Rutenya
      // TIDAK dihapus — /peta-jaringan-tambang dan sub-rute /3d masih ada dan
      // tetap terbuka lewat URL langsung. Judulnya juga masih terdaftar di
      // pageTitles pada (dashboard)/layout.tsx, jadi header halamannya tetap
      // benar kalau dibuka.
      //
      // Mengembalikannya: buka komentar baris di bawah DAN tambahkan lagi
      // `MapPinned` ke import lucide-react di atas — ikonnya ikut dilepas dari
      // import supaya tidak tertinggal sebagai import tak terpakai.
      // { title: "Peta Tambang", href: "/peta-jaringan-tambang", icon: () => <MapPinned className={ICON_CLASS} strokeWidth={1.6} /> },
      { title: "Rekap Data", href: "/rekap-data", icon: () => <Database className={ICON_CLASS} strokeWidth={1.6} /> },
    ],
  },
  {
    label: "Pengaturan",
    items: [{ title: "Master Data", href: "/master-data", icon: () => <Settings2 className={ICON_CLASS} strokeWidth={1.6} /> }],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  const isItemActive = (href: string) => pathname.startsWith(href);

  const renderItem = (item: NavItem) => {
    const active = isItemActive(item.href);

    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          render={<Link href={item.href} aria-current={active ? "page" : undefined} />}
          isActive={active}
          tooltip={item.title}
          className={cn(
            // gap-3 dipakai apa adanya. Sebelumnya ikonnya `absolute left-3`
            // dan labelnya `ml-8` — memalsukan jarak yang sudah disediakan flex,
            // lalu perlu dibatalkan lagi (`static left-auto`) di mode ringkas.
            "h-10 w-full gap-3 rounded-[8px] px-3 text-[13px] font-medium tracking-wide transition-colors",
            "group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
            active
              ? "!bg-[#303481] !text-white shadow-sm hover:!bg-[#303481] hover:!text-white"
              : "text-muted-foreground hover:bg-[#F4F6F9] hover:text-foreground"
          )}
        >
          {item.icon(active)}
          <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar variant="sidebar" collapsible="icon" className="border-r border-border bg-card">
      {/* h-16 menyamai tinggi header konten (h-16 di (dashboard)/layout.tsx),
          dan border-b-nya selebar penuh sidebar — bukan garis inset terpisah.
          Dua nilai itu harus tetap sama: sebelumnya header ini 84px sementara
          header konten 64px, jadi kedua garis berjalan sejajar dengan selisih
          20px dan terbaca sebagai satu garis yang terputus.
          Blok ini tetap tampil saat sidebar diringkas — hanya logonya yang
          disembunyikan — supaya garis atasnya tidak berhenti di rail. */}
      <SidebarHeader className="h-16 justify-center border-b border-border bg-card p-0 px-4 group-data-[collapsible=icon]:px-2">
        <div className="flex w-full items-center justify-center">
          <Link
            href="/beranda"
            aria-label="Beacon Engineering — ke Dashboard"
            className="group-data-[collapsible=icon]:hidden"
          >
            <Image
              src="/logo_beacon.png"
              alt="Beacon Engineering"
              width={499}
              height={148}
              priority
              className="h-10 w-auto object-contain"
              draggable={false}
            />
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-card px-3 pt-4 group-data-[collapsible=icon]:px-2">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">{renderItem(navBeranda)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="p-0">
            {/* Di mode ringkas label ini disembunyikan penuh. Base-nya hanya
                meng-nol-kan opacity dan menarik margin (-mt-8) dengan asumsi
                tinggi h-8; karena tingginya di sini h-auto, sisa ruangnya akan
                tetap terlihat sebagai celah. */}
            <SidebarGroupLabel className="h-auto px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60 group-data-[collapsible=icon]:hidden">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">{group.items.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="bg-card p-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
        <div className="mb-1 border-t border-border" />
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Padding & tinggi disamakan dengan menu di atas supaya barisnya
                sejajar, bukan sedikit bergeser seperti sebelumnya. */}
            <Link
              href="/login"
              className="flex h-10 w-full items-center gap-3 rounded-[8px] px-3 text-[13px] font-medium tracking-wide text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
              title="Keluar"
            >
              <LogOut className={ICON_CLASS} />
              <span className="group-data-[collapsible=icon]:hidden">Keluar</span>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
