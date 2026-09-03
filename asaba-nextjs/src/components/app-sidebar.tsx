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

/**
 * Ukuran ikon seragam untuk seluruh sidebar, termasuk tombol Keluar.
 *
 * Ikon berbasis <svg> (Dashboard, lucide) ikut dipaksa ke ukuran ini lewat
 * `[&_svg]:size-[18px]` di BUTTON_CLASS. Varian bawaan SidebarMenuButton
 * memasang `[&_svg]:size-4`, dan selektor turunan itu lebih spesifik daripada
 * kelas di <svg>-nya sendiri — tanpa penimpa, ikon svg jadi 16px sementara
 * ikon mask (span) 18px, dan barisnya terlihat tidak rata.
 */
const ICON_CLASS = "size-[18px] shrink-0";

/**
 * Kelas tombol yang dipakai SEMUA baris sidebar — menu navigasi maupun Keluar —
 * supaya tinggi, padding, dan ritme hover-nya identik.
 *
 * Di mode ringkas (rail 48px) tombolnya persegi 40px. Varian bawaan memakai
 * `size-8!`/`p-2!` ber-important; penimpanya juga harus ber-important supaya
 * tailwind-merge menganggapnya konflik yang sama dan membuang yang lama.
 * SidebarContent memberi `px-1` di mode ringkas (bukan px-2) agar 40px itu
 * benar-benar terpusat di rail 48px, bukan geser 8px ke kanan.
 */
const BUTTON_CLASS = cn(
  "relative h-10 w-full gap-3 rounded-lg px-3 text-[13px] font-medium tracking-[0.01em]",
  "transition-[width,height,padding,background-color,color,box-shadow] duration-150",
  "[&_svg]:size-[18px]",
  "group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
);

/**
 * Ikon dari file SVG, diwarnai lewat CSS mask.
 *
 * Yang dipakai hanya bentuk (alpha) file-nya; warnanya datang dari `bg-current`,
 * jadi selalu identik dengan warna label di sebelahnya — penting di tema gelap,
 * karena file-file ini aslinya berwarna `black`, `white`, bahkan `#303481`.
 * Varian `_fill` dipakai murni untuk perbedaan BENTUK (outline → solid saat
 * aktif), bukan untuk warna.
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
      d="M19.318 13.5H15.443C14.9293 13.4995 14.4364 13.7027 14.0724 14.065C13.7083 14.4274 13.5029 14.9193 13.501 15.433V19.308C13.5007 19.5631 13.5508 19.8158 13.6483 20.0515C13.7458 20.2872 13.8888 20.5014 14.0692 20.6818C14.2496 20.8622 14.4638 21.0052 14.6995 21.1027C14.9353 21.2002 15.1879 21.2503 15.443 21.25H19.318C19.8315 21.2479 20.3232 21.0423 20.6853 20.6783C21.0475 20.3142 21.2505 19.8215 21.25 19.308V15.433C21.2503 15.1792 21.2005 14.9279 21.1035 14.6933C21.0065 14.4588 20.8642 14.2457 20.6847 14.0663C20.5053 13.8868 20.2922 13.7445 20.0577 13.6475C19.8231 13.5505 19.5718 13.5007 19.318 13.501M8.557 13.5H4.682C4.16859 13.5029 3.67721 13.7089 3.3152 14.073C2.95319 14.437 2.74999 14.9296 2.75 15.443V19.318C2.74974 19.5718 2.79953 19.8231 2.89653 20.0577C2.99353 20.2922 3.13583 20.5053 3.31528 20.6847C3.49474 20.8642 3.70783 21.0065 3.94235 21.1035C4.17687 21.2005 4.42821 21.2503 4.682 21.25H8.557C9.07048 21.2505 9.56324 21.0475 9.92726 20.6853C10.2913 20.3232 10.4969 19.8315 10.499 19.308V15.443C10.4993 15.1879 10.4492 14.9353 10.3517 14.6995C10.2542 14.4638 10.1112 14.2496 9.93079 14.0692C9.75041 13.8888 9.53622 13.7458 9.30048 13.6483C9.06475 13.5508 8.8121 13.5007 8.557 13.501M8.557 2.75H4.682C4.42821 2.74974 4.17687 2.79953 3.94235 2.89653C3.70783 2.99353 3.49474 3.13583 3.31528 3.31528C3.13583 3.49474 2.99353 3.70783 2.89653 3.94235C2.79953 4.17687 2.74974 4.42821 2.75 4.682V8.557C2.74947 9.07048 2.95253 9.56324 3.31468 9.92726C3.67683 10.2913 4.16852 10.4969 4.682 10.499H8.557C8.8121 10.4993 9.06475 10.4492 9.30048 10.3517C9.53622 10.2542 9.75041 10.1112 9.93079 9.93079C10.1112 9.75041 10.2542 9.53622 10.3517 9.30048C10.4492 9.06475 10.4993 8.8121 10.499 8.557V4.682C10.4969 4.16852 10.2913 3.67683 9.92726 3.31468C9.56324 2.95253 9.07048 2.74947 8.557 2.75ZM19.318 2.75H15.443C14.9295 2.74947 14.4368 2.95253 14.0727 3.31468C13.7087 3.67683 13.5031 4.16852 13.501 4.682V8.557C13.5013 9.07197 13.706 9.56577 14.0701 9.92991C14.4342 10.294 14.928 10.4987 15.443 10.499H19.318C19.8315 10.4969 20.3232 10.2913 20.6853 9.92726C21.0475 9.56324 21.2505 9.07048 21.25 8.557V4.682C21.2503 4.42821 21.2005 4.17687 21.1035 3.94235C21.0065 3.70783 20.8642 3.49474 20.6847 3.31528C20.5053 3.13583 20.2922 2.99353 20.0577 2.89653C19.8231 2.79953 19.5718 2.74974 19.318 2.75Z"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Monogram "be" untuk header di mode ringkas.
 *
 * Tidak ada aset tanda merek tersendiri: logo_beacon hanya tersedia sebagai
 * lockup lebar (rasio 3,4:1) yang di rail 48px akan tinggal ±10px tinggi dan
 * tak terbaca. Monogram ini meniru dua huruf logonya — "b" merah, "e" putih —
 * di atas ubin indigo yang satu keluarga dengan pill menu aktif.
 */
const BrandMonogram = ({ className }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={cn(
      "size-9 items-center justify-center rounded-[10px] text-[15px] leading-none font-bold tracking-[-0.02em] select-none",
      "bg-[image:linear-gradient(145deg,oklch(0.36_0.1_278),oklch(0.25_0.06_278))] ring-1 ring-white/10",
      "shadow-[inset_0_1px_0_oklch(1_0_0/0.12),0_8px_18px_-10px_oklch(0.3_0.1_278)]",
      className
    )}
  >
    <span className="text-[#E83A3A]">b</span>
    <span className="text-white">e</span>
  </span>
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

/**
 * Sidebar bertema gelap: permukaan navy tua yang satu keluarga dengan navy
 * merek #303481 dan panel `--console` pada .tema-monitoring, sehingga Beranda
 * dan sidebar terbaca sebagai satu konsol yang sama.
 *
 * Warnanya TIDAK di-hardcode di sini melainkan lewat token `--sidebar-*` di
 * globals.css. Sheet untuk mobile (components/ui/sidebar.tsx) dirender lewat
 * portal dan tidak menerima className dari komponen ini — ia hanya membaca
 * `bg-sidebar`/`text-sidebar-foreground` — jadi token adalah satu-satunya jalur
 * yang menjangkau desktop dan mobile sekaligus.
 */
export function AppSidebar() {
  const pathname = usePathname();

  const isItemActive = (href: string) => pathname.startsWith(href);

  const renderItem = (item: NavItem) => {
    const active = isItemActive(item.href);

    return (
      <SidebarMenuItem key={item.href}>
        {/* Penanda aktif di tepi kiri sidebar. Sengaja di LUAR tombol: tombolnya
            `overflow-hidden`, jadi pseudo-element di dalamnya akan terpotong.
            Offsetnya menyamai padding horizontal SidebarContent — px-3 saat
            lebar, px-1 saat ringkas — supaya selalu menempel di tepi. */}
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-1/2 -left-3 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-ring",
            "transition-[height,opacity] duration-200 group-data-[collapsible=icon]:-left-1",
            active ? "h-5 opacity-100" : "h-2 opacity-0"
          )}
        />
        <SidebarMenuButton
          render={<Link href={item.href} aria-current={active ? "page" : undefined} />}
          isActive={active}
          tooltip={item.title}
          className={cn(
            BUTTON_CLASS,
            "text-sidebar-foreground/70",
            // Aktif: pill gradasi indigo, bukan navy pekat #303481 seperti di
            // tema terang — di atas latar yang juga navy, pill pekat itu hampir
            // tak terlihat. Gradasinya background-IMAGE, jadi tidak bertabrakan
            // dengan `data-active:bg-sidebar-accent` (background-color) bawaan.
            "data-active:bg-[image:linear-gradient(135deg,oklch(0.47_0.14_278),oklch(0.37_0.11_278))]",
            "data-active:font-semibold data-active:text-white",
            "data-active:shadow-[inset_0_1px_0_oklch(1_0_0/0.14),0_10px_24px_-14px_oklch(0.55_0.16_278)]"
          )}
        >
          {item.icon(active)}
          <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar variant="sidebar" collapsible="icon" className="border-sidebar-border">
      {/* Pendar lembut di pojok kiri atas: memberi kedalaman pada permukaan
          navy yang kalau rata terasa seperti blok mati. Ia absolut, sedangkan
          header/content/footer di bawahnya diberi `relative` supaya dicat DI
          ATAS pendar ini — elemen berposisi selalu dicat setelah saudara yang
          statis, apa pun urutannya di DOM. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[image:radial-gradient(120%_55%_at_0%_0%,oklch(0.45_0.13_278/0.28),transparent_60%)]"
      />

      {/* h-16 menyamai tinggi header konten (h-16 di (dashboard)/layout.tsx)
          supaya garis bawah keduanya sejajar. Blok ini tetap tampil saat
          sidebar diringkas — logonya berganti monogram — supaya garis atasnya
          tidak berhenti di rail. */}
      <SidebarHeader className="relative h-16 flex-row items-center justify-center border-b border-sidebar-border px-4 py-0 group-data-[collapsible=icon]:px-0">
        <Link
          href="/beranda"
          aria-label="Beacon Engineering — ke Dashboard"
          className="flex items-center rounded-md outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          {/* logo_beacon_dark.png diturunkan dari logo_beacon.png: piksel navy
              (#33345x) dijadikan putih dan merahnya dinaikkan dari #B30303 ke
              #E83A3A. Logo aslinya navy di atas transparan — di sidebar yang
              juga navy, huruf "e" dan tulisan BEACON ENGINEERING-nya lenyap.
              Tingginya dari --app-logo-height di globals.css, satu tempat
              dengan lebar sidebar, jadi keduanya mengecil bersamaan. */}
          <Image
            src="/logo_beacon_dark.png"
            alt="Beacon Engineering"
            width={499}
            height={148}
            preload
            className="h-(--app-logo-height) w-auto object-contain group-data-[collapsible=icon]:hidden"
            draggable={false}
          />
          <BrandMonogram className="hidden group-data-[collapsible=icon]:flex" />
        </Link>
      </SidebarHeader>

      <SidebarContent className="relative px-3 pt-3 group-data-[collapsible=icon]:px-1">
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
            <SidebarGroupLabel className="h-auto px-3 pt-5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45 group-data-[collapsible=icon]:hidden">
              {group.label}
            </SidebarGroupLabel>
            {/* Pengganti label di mode ringkas: garis pendek, supaya batas
                antarkelompok tetap terbaca meski tanpa teks. */}
            <div
              aria-hidden="true"
              className="mx-auto my-2 hidden h-px w-5 bg-sidebar-border group-data-[collapsible=icon]:block"
            />
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">{group.items.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="relative p-3 pt-0 group-data-[collapsible=icon]:px-1">
        <div className="mb-2 h-px bg-sidebar-border" />
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Memakai SidebarMenuButton yang sama dengan menu di atas supaya
                barisnya sejajar dan dapat tooltip di mode ringkas. Merah hanya
                muncul saat hover — di aplikasi pemantauan, merah yang diam
                terbaca sebagai status Awas. */}
            <SidebarMenuButton
              render={<Link href="/login" />}
              tooltip="Keluar"
              className={cn(BUTTON_CLASS, "text-sidebar-foreground/60 hover:bg-red-400/10 hover:text-red-300")}
            >
              <LogOut className={ICON_CLASS} strokeWidth={1.6} />
              <span className="group-data-[collapsible=icon]:hidden">Keluar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
