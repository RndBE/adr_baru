"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Save, Plus, Trash2 } from "lucide-react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const menuItems = [
  {
    section: "Pengaturan AWLR",
    items: [
      { label: "Tingkat Status", href: "/pengaturan" },
      { label: "Rumus Debit", href: "/pengaturan/rumus-debit" },
    ],
  },
  {
    section: "Pengaturan ARR",
    items: [{ label: "Tingkat Status", href: "/pengaturan/tingkat-status-arr" }],
  },
  {
    section: "Menu Perbaikan",
    items: [{ label: "Perbaikan Logger", href: "/pengaturan/perbaikan" }],
  },
];

interface SetEwsRow {
  id: number;
  id_logger: string;
  status1: string;
  siaga1: number;
  siaga2: number;
  siaga3: number;
}

interface LoggerItem {
  id_logger: string;
  nama_logger: string;
  nama_lokasi: string;
  nama_kategori: string;
}

export default function PengaturanPage() {
  const [activeMenu, setActiveMenu] = useState("/pengaturan");

  // Fetch set_ews data (thresholds) via raw prisma query
  const { data: loggersData, isLoading: loggersLoading } = useSWR("/api/loggers", fetcher);
  const loggers = (loggersData?.data || []) as LoggerItem[];

  // Filter AWLR loggers
  const awlrLoggers = loggers.filter((l) => l.nama_kategori?.toLowerCase().includes("awlr"));

  return (
    <div className="space-y-6">
      <PageHeader title="Pengaturan" />

      <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
        {/* Left sidebar navigation */}
        <Card>
          <CardContent className="p-4">
            {menuItems.map((section) => (
              <div key={section.section} className="mb-4 last:mb-0">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.section}
                </h4>
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <button
                      key={item.href}
                      onClick={() => setActiveMenu(item.href)}
                      className={cn(
                        "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                        activeMenu === item.href
                          ? "bg-brand text-white font-medium"
                          : "hover:bg-muted"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Right content */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Tingkat Status AWLR</CardTitle>
            <Button size="sm" className="bg-brand hover:bg-brand-dark">
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Simpan
            </Button>
          </CardHeader>
          <CardContent>
            {loggersLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : awlrLoggers.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center rounded-lg border-2 border-dashed">
                <p className="text-sm text-muted-foreground">Tidak ada logger AWLR terdaftar</p>
              </div>
            ) : (
              <>
                <div className="overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12 text-center">No</TableHead>
                        <TableHead>Nama Pos</TableHead>
                        <TableHead className="text-center">
                          <div className="flex flex-col items-center">
                            <span>Normal</span>
                            <Badge variant="secondary" className="mt-1 bg-white text-zinc-700 text-[10px]">m</Badge>
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex flex-col items-center">
                            <span>Siaga 1</span>
                            <Badge className="mt-1 bg-amber-100 text-amber-700 text-[10px]">Waspada</Badge>
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex flex-col items-center">
                            <span>Siaga 2</span>
                            <Badge className="mt-1 bg-orange-100 text-orange-700 text-[10px]">Siaga</Badge>
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex flex-col items-center">
                            <span>Siaga 3</span>
                            <Badge className="mt-1 bg-red-100 text-red-700 text-[10px]">Awas</Badge>
                          </div>
                        </TableHead>
                        <TableHead className="w-16 text-center">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {awlrLoggers.map((logger, idx) => (
                        <TableRow key={logger.id_logger} className="transition-colors hover:bg-brand/3">
                          <TableCell className="text-center text-sm">{idx + 1}</TableCell>
                          <TableCell className="text-sm font-medium">
                            {logger.nama_lokasi || logger.nama_logger}
                          </TableCell>
                          <TableCell className="text-center">
                            <Input type="number" defaultValue={0} className="mx-auto h-8 w-20 text-center text-sm" step="0.1" />
                          </TableCell>
                          <TableCell className="text-center">
                            <Input type="number" defaultValue={0} className="mx-auto h-8 w-20 text-center text-sm" step="0.1" />
                          </TableCell>
                          <TableCell className="text-center">
                            <Input type="number" defaultValue={0} className="mx-auto h-8 w-20 text-center text-sm" step="0.1" />
                          </TableCell>
                          <TableCell className="text-center">
                            <Input type="number" defaultValue={0} className="mx-auto h-8 w-20 text-center text-sm" step="0.1" />
                          </TableCell>
                          <TableCell className="text-center">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button variant="outline" size="sm" className="mt-4">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Tambah Pos
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
