"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  RadioTower,
  TableProperties,
  Box,
  Target,
  LogOut,
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

const mainNavItems = [
  { title: "Dashboard", href: "/beranda", icon: LayoutGrid },
  { title: "Kontrol ADR", href: "/kontrol-adr", icon: RadioTower },
  { title: "Hasil Pengukuran", href: "/hasil-pengukuran", icon: TableProperties },
  { title: "Visualisasi 3D", href: "/visualisasi-3d", icon: Box },
  { title: "Prism Config", href: "/prism-config", icon: Target },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar variant="sidebar" collapsible="icon" className="border-r border-gray-100 bg-white">
      <SidebarHeader className="border-b-0 pt-6 pb-4 px-4 group-data-[collapsible=icon]:px-0">
        <div className="flex items-center justify-between w-full h-8 group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-2 overflow-hidden group-data-[collapsible=icon]:hidden">
            {/* Custom Logo Styling */}
            <div className="relative flex-shrink-0 flex items-center justify-center font-black italic tracking-tighter text-[#2a3073] text-2xl">
               <span className="text-yellow-400 font-extrabold mr-[-2px]">\</span>
               <span className="font-extrabold">/</span>
            </div>
            <div className="flex flex-col overflow-hidden whitespace-nowrap">
              <span className="text-[13px] font-black tracking-tighter text-[#2a3073] leading-none mb-[2px]">
                PT.ASABA
              </span>
              <span className="text-[7px] font-bold text-[#2a3073] leading-none tracking-tight">
                SURVEYING SOLUTIONS
              </span>
            </div>
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
                      <item.icon className={cn("flex-shrink-0 h-[18px] w-[18px] absolute left-3 group-data-[collapsible=icon]:static group-data-[collapsible=icon]:left-auto", isActive ? "!text-white" : "text-gray-500")} strokeWidth={isActive ? 2.5 : 2} />
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
