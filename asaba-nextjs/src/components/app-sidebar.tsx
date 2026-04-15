"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  BarChart3,
  Activity,
  Settings,
  LogOut,
  Database,
  ChevronDown,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const mainNavItems = [
  { title: "Beranda", href: "/beranda", icon: Home },
  { title: "Analisa", href: "/analisa", icon: BarChart3 },
  { title: "Monitoring", href: "/monitoring", icon: Activity },
  { title: "Masterdata", href: "/masterdata", icon: Database },
];

const settingsSubItems = [
  { title: "Tingkat Status AWLR", href: "/pengaturan" },
  { title: "Rumus Debit", href: "/pengaturan/rumus-debit" },
  { title: "Tingkat Status ARR", href: "/pengaturan/tingkat-status-arr" },
  { title: "Perbaikan Logger", href: "/pengaturan/perbaikan" },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/beranda" />} tooltip="ASABA">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-md shadow-brand/20">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight">
                  ASABA
                </span>
                <span className="text-xs text-muted-foreground">
                  Monitoring System
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Utama</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Pengaturan with sub-menu */}
              {/* <Collapsible
                defaultOpen={pathname.startsWith("/pengaturan")}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/pengaturan")}
                      tooltip="Pengaturan"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Pengaturan</span>
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {settingsSubItems.map((sub) => (
                        <SidebarMenuSubItem key={sub.href}>
                          <SidebarMenuSubButton
                            render={<Link href={sub.href} />}
                            isActive={pathname === sub.href}
                          >
                            {sub.title}
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible> */}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-brand/10 text-brand text-xs font-semibold">
                  AD
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col text-left text-sm">
                <span className="font-medium">Admin</span>
                <span className="text-xs text-muted-foreground">
                  Administrator
                </span>
              </div>
              <Link
                href="/login"
                className="text-muted-foreground transition-colors hover:text-destructive"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
