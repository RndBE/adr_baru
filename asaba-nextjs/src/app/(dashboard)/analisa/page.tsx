"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Filter, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLoggers } from "@/hooks/use-api";

interface LoggerItem {
  id_logger: string;
  nama_logger: string;
  nama_lokasi: string;
  nama_kategori: string;
  latitude: string;
  longitude: string;
}

export default function AnalisaPage() {
  const { loggers, isLoading } = useLoggers();
  const [selectedLocation, setSelectedLocation] = useState("");
  const [filters, setFilters] = useState<Record<string, boolean>>({});

  // Extract unique categories from actual data
  const categories = useMemo(() => {
    const cats: Record<string, number> = {};
    for (const l of loggers as LoggerItem[]) {
      const cat = l.nama_kategori || "Unknown";
      cats[cat] = (cats[cat] || 0) + 1;
    }
    return Object.entries(cats).map(([name, count]) => ({ name, count }));
  }, [loggers]);

  // Initialize filters when categories change
  useMemo(() => {
    if (categories.length > 0 && Object.keys(filters).length === 0) {
      setFilters(Object.fromEntries(categories.map((c) => [c.name, true])));
    }
  }, [categories]);

  // Filter loggers
  const filteredLoggers = useMemo(() => {
    let list = loggers as LoggerItem[];
    if (selectedLocation) {
      list = list.filter((l) => l.id_logger === selectedLocation);
    }
    return list.filter((l) => filters[l.nama_kategori] !== false);
  }, [loggers, selectedLocation, filters]);

  const colorForCategory = (cat: string) => {
    const lower = cat.toLowerCase();
    if (lower.includes("awlr")) return "bg-sky-500";
    if (lower.includes("arr") || lower.includes("ews")) return "bg-emerald-500";
    if (lower.includes("awr") || lower.includes("awgc")) return "bg-amber-500";
    return "bg-violet-500";
  };

  const markerColor = (cat: string) => {
    const lower = cat.toLowerCase();
    if (lower.includes("awlr")) return "bg-sky-500 text-white";
    if (lower.includes("arr") || lower.includes("ews")) return "bg-emerald-500 text-white";
    if (lower.includes("awr") || lower.includes("awgc")) return "bg-amber-600 text-white";
    return "bg-violet-500 text-white";
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Analisa" description="Analisa data dan lokasi sensor monitoring" />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium">Analisa Data</label>
              {isLoading ? (
                <Skeleton className="h-10 w-full max-w-xs" />
              ) : (
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="h-10 w-full max-w-xs rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Semua Lokasi</option>
                  {(loggers as LoggerItem[]).map((l) => (
                    <option key={l.id_logger} value={l.id_logger}>
                      {l.nama_lokasi || l.nama_logger} ({l.nama_kategori})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent cursor-pointer">
                <Filter className="h-3.5 w-3.5" />
                Filter
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {categories.map((cat) => (
                  <DropdownMenuCheckboxItem
                    key={cat.name}
                    checked={filters[cat.name] !== false}
                    onCheckedChange={(checked) =>
                      setFilters((prev) => ({ ...prev, [cat.name]: !!checked }))
                    }
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn("h-3 w-3 rounded-sm", colorForCategory(cat.name))} />
                      {cat.name} ({cat.count})
                    </div>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Map area */}
      <Card>
        <CardContent className="p-0">
          <div className="relative flex h-[500px] items-center justify-center rounded-lg bg-gradient-to-br from-muted/50 to-muted/80">
            <div className="absolute inset-0 overflow-hidden rounded-lg">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M0%200h40v40H0z%22%20fill%3D%22none%22%20stroke%3D%22%23e5e7eb%22%20stroke-width%3D%220.5%22%2F%3E%3C%2Fsvg%3E')] opacity-50" />
              {filteredLoggers.map((marker, i) => (
                <div
                  key={marker.id_logger}
                  className="absolute flex flex-col items-center"
                  style={{
                    left: `${10 + ((i * 13) % 80)}%`,
                    top: `${15 + ((i * 17) % 65)}%`,
                  }}
                >
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-125", markerColor(marker.nama_kategori))}>
                    <MapPin className="h-4 w-4" />
                  </div>
                  <span className="mt-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium shadow-sm backdrop-blur">
                    {marker.nama_lokasi || marker.nama_logger}
                  </span>
                </div>
              ))}
            </div>
            <div className="relative z-10 text-center">
              <MapPin className="mx-auto mb-2 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">Peta Analisa Lokasi Sensor</p>
              <p className="text-xs text-muted-foreground/70">
                {filteredLoggers.length} logger ditampilkan
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="font-medium text-muted-foreground">Keterangan:</span>
        {categories.map((cat) => (
          <div key={cat.name} className="flex items-center gap-1.5">
            <div className={cn("h-3 w-3 rounded-full", colorForCategory(cat.name))} />
            <span>{cat.name} ({cat.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
