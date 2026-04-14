"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLoggers, useSensorData } from "@/hooks/use-api";

interface LoggerItem {
  id_logger: string;
  nama_logger: string;
  nama_lokasi: string;
  nama_kategori: string;
  tabel: string;
}

// Color thresholds for ARR (rainfall) and AWLR (water level)
function getArrColor(val: number) {
  if (val < 0.5) return { bg: "white", dark: false };
  if (val < 5) return { bg: "#70cddd", dark: false };
  if (val < 10) return { bg: "#35549d", dark: true };
  if (val < 20) return { bg: "#fef216", dark: false };
  if (val < 50) return { bg: "#f47e2c", dark: true };
  return { bg: "#ed1c24", dark: true };
}

function getAwlrColor(val: number, siaga1 = 40, siaga2 = 45) {
  if (val < siaga1) return { bg: "white", dark: false };
  if (val < siaga2) return { bg: "#fef216", dark: false };
  return { bg: "#ed1c24", dark: true };
}

export default function MonitoringPage() {
  const { loggers, isLoading: loggersLoading } = useLoggers();
  const [selectedKategori, setSelectedKategori] = useState("arr");
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));

  // Filter loggers by selected category
  const filteredLoggers = useMemo(() => {
    return (loggers as LoggerItem[]).filter((l) => {
      const cat = l.nama_kategori?.toLowerCase() || "";
      if (selectedKategori === "arr") return cat.includes("arr") || cat.includes("ews");
      if (selectedKategori === "awlr") return cat.includes("awlr");
      return false;
    });
  }, [loggers, selectedKategori]);

  const isARR = selectedKategori === "arr";

  return (
    <div className="space-y-6">
      <PageHeader title="Monitoring" description="Monitoring heatmap data sensor per jam" />

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Left sidebar filters */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5">
              <Label className="text-xs font-medium text-muted-foreground">Pilih Kategori</Label>
              <select
                value={selectedKategori}
                onChange={(e) => setSelectedKategori(e.target.value)}
                className="mt-1.5 h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="arr">ARR (Curah Hujan)</option>
                <option value="awlr">AWLR (Tinggi Muka Air)</option>
              </select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <Label className="text-xs font-medium text-muted-foreground">Pilih Tanggal</Label>
              <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="mt-1.5" />
              <Button className="mt-3 w-full bg-brand hover:bg-brand-dark" size="sm">
                Tampil
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Heatmap table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Monitoring {isARR ? "ARR (Curah Hujan)" : "AWLR (Tinggi Muka Air)"} pada {tanggal}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loggersLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : filteredLoggers.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center rounded-lg border-2 border-dashed">
                <p className="text-sm text-muted-foreground">Tidak ada logger {isARR ? "ARR" : "AWLR"} terdaftar</p>
              </div>
            ) : (
              <>
                <div className="overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="sticky left-0 z-10 bg-muted/90 backdrop-blur min-w-[140px]" rowSpan={2}>
                          Nama Pos
                        </TableHead>
                        <TableHead colSpan={24} className="text-center border-l">Jam</TableHead>
                        {isARR && <TableHead className="text-center border-l" rowSpan={2}>Akumulasi</TableHead>}
                      </TableRow>
                      <TableRow className="bg-muted/30">
                        {Array.from({ length: 24 }, (_, i) => (
                          <TableHead key={i} className="text-center text-[10px] px-1 min-w-[55px] border-l">
                            {String(i).padStart(2, "0")}:00
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLoggers.map((logger) => (
                        <HeatmapRow key={logger.id_logger} logger={logger} tanggal={tanggal} isARR={isARR} />
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Legend */}
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium text-muted-foreground">Keterangan:</span>
                  {isARR ? (
                    <>
                      {[
                        { color: "white", label: "Tidak Hujan", border: true },
                        { color: "#70cddd", label: "Sangat Ringan" },
                        { color: "#35549d", label: "Ringan" },
                        { color: "#fef216", label: "Sedang", border: true },
                        { color: "#f47e2c", label: "Lebat" },
                        { color: "#ed1c24", label: "Sangat Lebat" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-1.5">
                          <div className={cn("h-5 w-8 rounded", item.border && "border border-zinc-300")} style={{ backgroundColor: item.color }} />
                          <span className="text-xs">{item.label}</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      {[
                        { color: "#fef216", label: "Waspada", border: true },
                        { color: "#ed1c24", label: "Siaga" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-1.5">
                          <div className={cn("h-5 w-8 rounded", item.border && "border border-zinc-300")} style={{ backgroundColor: item.color }} />
                          <span className="text-xs">{item.label}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Individual Heatmap Row (fetches own data) ────────────────
function HeatmapRow({ logger, tanggal, isARR }: { logger: LoggerItem; tanggal: string; isARR: boolean }) {
  const tableName = isARR ? "ews" : "awlr";
  const { sensorData, isLoading } = useSensorData(
    logger.id_logger,
    tableName,
    { from: `${tanggal} 00:00:00`, to: `${tanggal} 23:59:59`, limit: 288 }
  );

  // Group data by hour, picking sensor1 as value
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, () => ({ value: 0, hasData: false }));
    for (const row of sensorData as Record<string, unknown>[]) {
      const dt = new Date(row.waktu as string);
      const h = dt.getHours();
      const val = Number(row.sensor1) || 0;
      if (isARR) {
        hours[h] = { value: hours[h].value + val, hasData: true };
      } else {
        // For AWLR take latest value per hour
        hours[h] = { value: val, hasData: true };
      }
    }
    return hours;
  }, [sensorData, isARR]);

  const akumulasi = hourlyData.reduce((s, d) => s + d.value, 0);

  if (isLoading) {
    return (
      <TableRow>
        <TableCell className="sticky left-0 z-10 bg-white font-medium text-xs whitespace-nowrap border-r">
          {logger.nama_lokasi || logger.nama_logger}
        </TableCell>
        <TableCell colSpan={isARR ? 25 : 24}>
          <div className="flex items-center gap-2 px-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-brand/40" />
            <span className="text-xs text-muted-foreground">Memuat...</span>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="sticky left-0 z-10 bg-white font-medium text-xs whitespace-nowrap border-r">
        {logger.nama_lokasi || logger.nama_logger}
      </TableCell>
      {hourlyData.map((cell, i) => {
        const coloring = isARR ? getArrColor(cell.value) : getAwlrColor(cell.value);
        return (
          <TableCell
            key={i}
            className={cn("text-center text-[11px] font-semibold px-1 border-l", coloring.dark ? "text-white" : "text-zinc-900")}
            style={{ backgroundColor: coloring.bg }}
          >
            {cell.hasData ? (
              <>
                {cell.value.toFixed(1)}
                <span className="ml-0.5 text-[9px] opacity-70">{isARR ? "mm" : "m"}</span>
              </>
            ) : (
              <span className="text-muted-foreground/40">-</span>
            )}
          </TableCell>
        );
      })}
      {isARR && (
        <TableCell className="text-center text-xs font-bold border-l">
          {akumulasi.toFixed(1)} mm
        </TableCell>
      )}
    </TableRow>
  );
}
