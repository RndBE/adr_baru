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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  BarChart3,
  Info,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { useLoggers, useSensorData } from "@/hooks/use-api";

type TimeRange = "hari" | "bulan" | "tahun" | "range";

function fmtDate(d: string | Date | null) {
  if (!d) return "-";
  const dt = new Date(d);
  return dt.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + dt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function getDateRange(timeRange: TimeRange, tanggal: string, bulan: string, tahun: string, dari: string, sampai: string) {
  let from: string | undefined;
  let to: string | undefined;
  let limit = 100;

  if (timeRange === "hari") {
    from = `${tanggal} 00:00:00`;
    to = `${tanggal} 23:59:59`;
    limit = 288; // 5-min intervals
  } else if (timeRange === "bulan") {
    from = `${bulan}-01 00:00:00`;
    const d = new Date(bulan + "-01");
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    to = `${bulan}-${String(d.getDate()).padStart(2, "0")} 23:59:59`;
    limit = 1000;
  } else if (timeRange === "tahun") {
    from = `${tahun}-01-01 00:00:00`;
    to = `${tahun}-12-31 23:59:59`;
    limit = 366;
  } else {
    from = `${dari} 00:00:00`;
    to = `${sampai} 23:59:59`;
    limit = 2000;
  }

  return { from, to, limit };
}

interface LoggerItem {
  id_logger: string;
  nama_logger: string;
  nama_lokasi: string;
  nama_kategori: string;
  kepanjangan: string;
  tabel: string;
  kategori_log: string;
}

export default function MasterdataPage() {
  const { loggers, isLoading: loggersLoading } = useLoggers();
  const [selectedPos, setSelectedPos] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("hari");
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [bulan, setBulan] = useState(new Date().toISOString().slice(0, 7));
  const [tahun, setTahun] = useState(String(new Date().getFullYear()));
  const [dari, setDari] = useState(new Date().toISOString().slice(0, 10));
  const [sampai, setSampai] = useState(new Date().toISOString().slice(0, 10));
  const [triggerFetch, setTriggerFetch] = useState(false);

  // Auto select first logger when loaded
  const currentLogger = useMemo(() => {
    if (selectedPos) return loggers.find((l: LoggerItem) => l.id_logger === selectedPos);
    if (loggers.length > 0) return loggers[0];
    return null;
  }, [loggers, selectedPos]) as LoggerItem | null;

  const activeLoggerId = currentLogger?.id_logger || null;
  const tableName = currentLogger?.tabel || (currentLogger?.nama_kategori?.toLowerCase() === "awlr" ? "awlr" : currentLogger?.nama_kategori?.toLowerCase() === "ews" ? "ews" : "awlr");

  const dateRange = useMemo(() => getDateRange(timeRange, tanggal, bulan, tahun, dari, sampai), [timeRange, tanggal, bulan, tahun, dari, sampai]);

  const { sensorData, isLoading: dataLoading } = useSensorData(
    activeLoggerId,
    tableName,
    { from: dateRange.from, to: dateRange.to, limit: dateRange.limit }
  );

  const posName = currentLogger?.nama_lokasi || currentLogger?.nama_logger || "Pilih pos";

  return (
    <div className="space-y-6">
      <PageHeader title="Masterdata" description={posName}>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-sm text-emerald-600">Koneksi Terhubung</span>
          </div>
          <Button variant="outline" size="sm">
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
            Realtime Monitoring
          </Button>
          <Sheet>
            <SheetTrigger className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent cursor-pointer">
              <Info className="h-3.5 w-3.5" />
              Informasi
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Informasi Logger</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                {[
                  ["Id Logger", currentLogger?.id_logger || "-"],
                  ["Nama Logger", currentLogger?.nama_logger || "-"],
                  ["Lokasi", currentLogger?.nama_lokasi || "-"],
                  ["Kategori", currentLogger?.nama_kategori || "-"],
                  ["Tabel", tableName || "-"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b py-2 last:border-0">
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-sm text-muted-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Left sidebar */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5">
              <Label className="text-xs font-medium text-muted-foreground">Pilih Pos</Label>
              {loggersLoading ? (
                <Skeleton className="mt-1.5 h-9 w-full" />
              ) : (
                <select
                  value={selectedPos || (currentLogger?.id_logger || "")}
                  onChange={(e) => setSelectedPos(e.target.value)}
                  className="mt-1.5 h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {loggers.map((l: LoggerItem) => (
                    <option key={l.id_logger} value={l.id_logger}>
                      {l.nama_lokasi || l.nama_logger} ({l.nama_kategori})
                    </option>
                  ))}
                </select>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <Label className="text-xs font-medium text-muted-foreground">
                {timeRange === "hari" ? "Pilih Tanggal" : timeRange === "bulan" ? "Pilih Bulan" : timeRange === "tahun" ? "Pilih Tahun" : "Pilih Rentang Waktu"}
              </Label>
              {timeRange === "hari" && <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="mt-1.5" />}
              {timeRange === "bulan" && <Input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)} className="mt-1.5" />}
              {timeRange === "tahun" && <Input type="number" value={tahun} onChange={(e) => setTahun(e.target.value)} className="mt-1.5" min="2020" max="2030" />}
              {timeRange === "range" && (
                <div className="mt-1.5 space-y-2">
                  <div><Label className="text-xs">Dari</Label><Input type="date" value={dari} onChange={(e) => setDari(e.target.value)} /></div>
                  <div><Label className="text-xs">Sampai</Label><Input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} /></div>
                </div>
              )}
              <Button className="mt-3 w-full bg-brand hover:bg-brand-dark" size="sm" onClick={() => setTriggerFetch(!triggerFetch)}>
                Tampil
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <Label className="text-xs font-medium text-muted-foreground">Analisa dalam</Label>
              <div className="mt-2 space-y-2">
                {([["hari", "Hari"], ["bulan", "Bulan"], ["tahun", "Tahun"], ["range", "Rentang Waktu"]] as [TimeRange, string][]).map(([val, label]) => (
                  <label key={val} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="timeRange" value={val} checked={timeRange === val} onChange={() => setTimeRange(val)} className="h-4 w-4 accent-brand" />
                    {label}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <Button variant="outline" className="w-full border-emerald-300 text-emerald-600 hover:bg-emerald-50" size="sm">
                <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                Download Excel
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right content */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex h-[300px] items-center justify-center rounded-lg border-2 border-dashed bg-gradient-to-b from-brand/3 to-transparent">
                <div className="text-center">
                  <BarChart3 className="mx-auto mb-2 h-10 w-10 text-brand/30" />
                  <p className="text-sm font-medium text-muted-foreground">Grafik {posName}</p>
                  <p className="text-xs text-muted-foreground/70">Chart area (Highcharts integration)</p>
                </div>
              </div>

              <div className="mt-6 overflow-auto rounded-lg border">
                {dataLoading ? (
                  <div className="flex h-[200px] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-brand/40" />
                  </div>
                ) : sensorData.length === 0 ? (
                  <div className="flex h-[200px] items-center justify-center">
                    <p className="text-sm text-muted-foreground">Tidak ada data untuk periode ini</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Waktu</TableHead>
                        {Object.keys(sensorData[0] || {})
                          .filter((k) => k.startsWith("sensor"))
                          .slice(0, 6)
                          .map((k) => (
                            <TableHead key={k} className="text-center">{k}</TableHead>
                          ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sensorData.slice(0, 100).map((row: Record<string, unknown>, i: number) => (
                        <TableRow key={i} className="transition-colors hover:bg-brand/3">
                          <TableCell className="text-sm">{fmtDate(row.waktu as string)}</TableCell>
                          {Object.keys(sensorData[0] || {})
                            .filter((k) => k.startsWith("sensor"))
                            .slice(0, 6)
                            .map((k) => (
                              <TableCell key={k} className="text-center text-sm">
                                {row[k] !== undefined && row[k] !== null ? String(row[k]) : "-"}
                              </TableCell>
                            ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
