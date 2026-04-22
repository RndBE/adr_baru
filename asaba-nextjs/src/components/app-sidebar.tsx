"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  LayoutGrid,
  RadioTower,
  TableProperties,
  Box,
  Target,
  LogOut,
  Database,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

// DashboardIcon using inline SVG so fill="currentColor" works beautifully
const DashboardIcon = ({ className, strokeWidth, fill }: { className?: string, strokeWidth?: number, fill?: string }) => (
  // Use stroke="currentColor" to color the borders, and fill="currentColor" to make the boxes solid when active
  <svg width="24" height="24" viewBox="0 0 24 24" fill={fill || "none"} xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M19.318 13.5H15.443C14.9293 13.4995 14.4364 13.7027 14.0724 14.065C13.7083 14.4274 13.5029 14.9193 13.501 15.433V19.308C13.5007 19.5631 13.5508 19.8158 13.6483 20.0515C13.7458 20.2872 13.8888 20.5014 14.0692 20.6818C14.2496 20.8622 14.4638 21.0052 14.6995 21.1027C14.9353 21.2002 15.1879 21.2503 15.443 21.25H19.318C19.8315 21.2479 20.3232 21.0423 20.6853 20.6783C21.0475 20.3142 21.2505 19.8215 21.25 19.308V15.433C21.2503 15.1792 21.2005 14.9279 21.1035 14.6933C21.0065 14.4588 20.8642 14.2457 20.6847 14.0663C20.5053 13.8868 20.2922 13.7445 20.0577 13.6475C19.8231 13.5505 19.5718 13.5007 19.318 13.501M8.557 13.5H4.682C4.16859 13.5029 3.67721 13.7089 3.3152 14.073C2.95319 14.437 2.74999 14.9296 2.75 15.443V19.318C2.74974 19.5718 2.79953 19.8231 2.89653 20.0577C2.99353 20.2922 3.13583 20.5053 3.31528 20.6847C3.49474 20.8642 3.70783 21.0065 3.94235 21.1035C4.17687 21.2005 4.42821 21.2503 4.682 21.25H8.557C9.07048 21.2505 9.56324 21.0475 9.92726 20.6853C10.2913 20.3232 10.4969 19.8315 10.499 19.318V15.443C10.4993 15.1879 10.4492 14.9353 10.3517 14.6995C10.2542 14.4638 10.1112 14.2496 9.93079 14.0692C9.75041 13.8888 9.53622 13.7458 9.30048 13.6483C9.06475 13.5508 8.8121 13.5007 8.557 13.501M8.557 2.75H4.682C4.42821 2.74974 4.17687 2.79953 3.94235 2.89653C3.70783 2.99353 3.49474 3.13583 3.31528 3.31528C3.13583 3.49474 2.99353 3.70783 2.89653 3.94235C2.79953 4.17687 2.74974 4.42821 2.75 4.682V8.557C2.74947 9.07048 2.95253 9.56324 3.31468 9.92726C3.67683 10.2913 4.16852 10.4969 4.682 10.499H8.557C8.8121 10.4993 9.06475 10.4492 9.30048 10.3517C9.53622 10.2542 9.75041 10.1112 9.93079 9.93079C10.1112 9.75041 10.2542 9.53622 10.3517 9.30048C10.4492 9.06475 10.4993 8.8121 10.499 8.557V4.682C10.4969 4.16852 10.2913 3.67683 9.92726 3.31468C9.56324 2.95253 9.07048 2.74947 8.557 2.75ZM19.318 2.75H15.443C14.9295 2.74947 14.4368 2.95253 14.0727 3.31468C13.7087 3.67683 13.5031 4.16852 13.501 4.682V8.557C13.5013 9.07197 13.706 9.56577 14.0701 9.92991C14.4342 10.294 14.928 10.4987 15.443 10.499H19.318C19.8315 10.4969 20.3232 10.2913 20.6853 9.92726C21.0475 9.56324 21.2505 9.07048 21.25 8.557V4.682C21.2503 4.42821 21.2005 4.17687 21.1035 3.94235C21.0065 3.70783 20.8642 3.49474 20.6847 3.31528C20.5053 3.13583 20.2922 2.99353 20.0577 2.89653C19.8231 2.79953 19.5718 2.74974 19.318 2.75Z" stroke="currentColor" strokeWidth={strokeWidth || 1.5} strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Generic wrapper for the customized SVG images
const ImageIcon = ({ basePath, className, isActive }: { basePath: string, className?: string, isActive?: boolean }) => {
  // Automatically switch between the normal and the "_fill" SVG variant
  const src = isActive ? `${basePath}_fill.svg` : `${basePath}.svg`;
  return (
    // Filter `brightness-0 invert` forces it to pure white to match the active text
    // Filter `brightness-0 opacity-60` forces it to solid dark-grey matching the inactive text
    <img 
      src={src} 
      alt="" 
      className={cn(className, isActive ? "brightness-0 invert" : "brightness-0 opacity-60")} 
    />
  );
};

const KontrolADRIcon = ({ className, fill }: any) => <ImageIcon basePath="/kontrol_adr" className={className} isActive={fill === "currentColor"} />;
const HasilPengukuranIcon = ({ className, fill }: any) => <ImageIcon basePath="/hasil_pengukuran" className={className} isActive={fill === "currentColor"} />;
const Visualisasi3DIcon = ({ className, fill }: any) => <ImageIcon basePath="/3d" className={className} isActive={fill === "currentColor"} />;
const PrismConfigIcon = ({ className, fill }: any) => <ImageIcon basePath="/prism_config" className={className} isActive={fill === "currentColor"} />;

const mainNavItems = [
  { title: "Dashboard", href: "/beranda", icon: DashboardIcon },
  { title: "Kontrol ADR", href: "/kontrol-adr", icon: KontrolADRIcon },
  { title: "Hasil Pengukuran", href: "/hasil-pengukuran", icon: HasilPengukuranIcon },
  { title: "Visualisasi 3D", href: "/visualisasi-3d", icon: Visualisasi3DIcon },
  { title: "Prism Config", href: "/prism-config", icon: PrismConfigIcon },
  { title: "Rekap Data", href: "/rekap-data", icon: Database },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar variant="sidebar" collapsible="icon" className="border-r border-gray-100 bg-white">
      <SidebarHeader className="border-b-0 pt-6 pb-4 px-4 group-data-[collapsible=icon]:px-0 bg-white">
        <div className="flex items-center justify-between w-full h-8 group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-2 overflow-hidden group-data-[collapsible=icon]:hidden">
            <img 
              src="/logo_be.png" 
              alt="Beacon Engineering Logo" 
              className="h-9 object-contain"
            />
          </div>
          <SidebarTrigger className="h-6 w-6 rounded-md border border-gray-300 flex-shrink-0 text-gray-500 hover:text-gray-900" />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 pt-6 bg-white group-data-[collapsible=icon]:px-2">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {mainNavItems.map((item) => {
                // If we're at root /beranda, make dashboard active. Else exact match
                const isActive = item.href === "/beranda" 
                  ? pathname.startsWith("/beranda") 
                  : pathname.startsWith(item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      tooltip={item.title}
                      className={cn(
                        "h-10 text-[13px] font-medium transition-colors rounded-[8px] gap-3 px-3 relative w-full flex items-center group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
                        isActive
                          ? "!bg-[#303481] !text-white hover:!bg-[#303481]/90 hover:!text-white"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      )}
                    >
                      <item.icon 
                        className={cn("flex-shrink-0 h-[18px] w-[18px] absolute left-3 group-data-[collapsible=icon]:static group-data-[collapsible=icon]:left-auto", isActive ? "!text-white" : "text-gray-500")} 
                        strokeWidth={isActive ? 0 : 1.5} 
                        fill={isActive ? "currentColor" : "none"} 
                      />
                      <span className="tracking-wide ml-8 group-data-[collapsible=icon]:hidden">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t-0 p-4 bg-white group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:items-center">
        <SidebarMenu>
          <SidebarMenuItem>
            <Link
              href="/login"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-red-600 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center"
              title="Keluar"
            >
              <LogOut className="h-[18px] w-[18px] flex-shrink-0 group-data-[collapsible=icon]:ml-1" />
              <span className="group-data-[collapsible=icon]:hidden tracking-wide">Keluar</span>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
