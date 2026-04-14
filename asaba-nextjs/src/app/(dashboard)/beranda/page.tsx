"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusCard } from "@/components/status-card";
import {
  SensorCategoryCard,
  CategorySection,
} from "@/components/sensor-category-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Gamepad2,
  Download,
  RotateCcw,
  Map,
  TableIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLoggers, useLogKontrol, useDeformasi, useLoggerDetail } from "@/hooks/use-api";

// ─── Helper: format date nicely ──────────────────────────────
function fmtDate(d: string | Date | null) {
  if (!d) return "-";
  const dt = new Date(d);
  return dt.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }) + " " + dt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

// ─── Helper: group loggers by category ───────────────────────
interface LoggerRow {
  id: number;
  id_logger: string;
  nama_logger: string;
  nama_lokasi: string;
  latitude: string;
  longitude: string;
  nama_kategori: string;
  kepanjangan: string;
  temp_data: string;
  tabel: string;
  kategori_log: string;
  lokasi_logger: string;
  icon_app?: string;
  seri?: string;
  serial_number?: string;
  masa_aktif?: string;
  nosell?: string;
}

function groupByCategory(loggers: LoggerRow[]) {
  const groups: Record<string, { kategori: string; kepanjangan: string; loggers: LoggerRow[] }> = {};
  for (const l of loggers) {
    const key = l.nama_kategori || "Unknown";
    if (!groups[key]) {
      groups[key] = { kategori: key, kepanjangan: l.kepanjangan || "", loggers: [] };
    }
    groups[key].loggers.push(l);
  }
  return Object.values(groups);
}

// ─── RTS Detail Sub-Component ────────────────────────────────
function RtsSection({ logger }: { logger: LoggerRow }) {
  const { detail, isLoading: detailLoading } = useLoggerDetail(logger.id_logger);
  const { logs, isLoading: logsLoading } = useLogKontrol(undefined, 30);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"tabel" | "peta">("tabel");
  const [dataView, setDataView] = useState<"event" | "harian">("event");
  const perPage = 10;

  // Select first log if not yet selected
  const activeLog = selectedLog || (logs.length > 0 ? logs[0].id_log : null);
  const { deformasi, isLoading: defLoading } = useDeformasi(activeLog);

  const totalPages = Math.max(1, Math.ceil(logs.length / perPage));
  const pagedLogs = logs.slice((currentPage - 1) * perPage, currentPage * perPage);

  // Extract temp data for status cards
  const tempRts = detail?.tempData?.[0];
  const statusRts = tempRts ? "Running" : "Offline";
  const powerRts = tempRts?.sensor2 ?? "-";
  const humidity = tempRts?.sensor3 ?? "-";
  const battery = tempRts?.sensor4 ?? "-";
  const temperature = tempRts?.sensor5 ?? "-";

  // Deformation data for table
  const pengukuran = deformasi?.data_pengukuran || [];

  return (
    <SensorCategoryCard
      title="RTS"
      locationName={logger.nama_lokasi || logger.nama_logger}
      lastUpdate={tempRts?.waktu ? fmtDate(tempRts.waktu) : "-"}
      statusColor={tempRts ? "green" : "dark"}
      loggerId={logger.id_logger}
      loggerStatus={tempRts ? "Koneksi Terhubung" : "Koneksi Terputus"}
      sdStatus="OK"
    >
      {/* Status Cards Grid */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        <Card className="border border-brand/20 bg-brand/5">
          <CardContent className="flex items-center justify-center py-3">
            <Button variant="default" size="sm" className="bg-brand hover:bg-brand-dark">
              <Gamepad2 className="mr-1 h-4 w-4" />
              Kontrol ADR
            </Button>
          </CardContent>
        </Card>
        <StatusCard label="Status RTS" value={statusRts} />
        <StatusCard label="Power RTS" value={powerRts} unit="Volt" />
        <StatusCard label="Humidity Logger" value={humidity} unit="%" />
        <StatusCard label="Battery Logger" value={battery} unit="Volt" />
        <StatusCard label="Temperature Logger" value={temperature} unit="°C" />
      </div>

      {/* Main content: Log list + Prisma table */}
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Left: Tanggal Running */}
        <Card className="border-0 shadow-none">
          <CardHeader className="rounded-lg border px-3 py-2.5">
            <CardTitle className="text-sm font-bold">Tanggal Running</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pt-2">
            {logsLoading ? (
              <div className="space-y-2 px-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <>
                <div className="space-y-0.5">
                  {pagedLogs.map((vl: { id_log: string; datetime: string; site: string; r0: number }) => (
                    <button
                      key={vl.id_log}
                      onClick={() => setSelectedLog(vl.id_log)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted",
                        activeLog === vl.id_log && "bg-muted font-medium"
                      )}
                    >
                      <span className="flex-1">{fmtDate(vl.datetime)}</span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] uppercase text-white",
                          vl.site === "ccp" ? "bg-sky-500" : "bg-amber-500"
                        )}
                      >
                        {vl.site === "ccp" ? "CCP 3" : "VP"}
                      </Badge>
                      {vl.r0 === 1 && (
                        <Badge variant="secondary" className="text-[10px] bg-zinc-500 text-white">
                          R0
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
                {/* Pagination */}
                <div className="mt-3 flex items-center justify-center gap-1">
                  <Button
                    variant="outline" size="icon" className="h-8 w-8"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
                    <Button
                      key={i} variant={currentPage === i + 1 ? "default" : "outline"}
                      size="icon" className={cn("h-8 w-8 text-xs", currentPage === i + 1 && "bg-brand hover:bg-brand-dark")}
                      onClick={() => setCurrentPage(i + 1)}
                    >
                      {i + 1}
                    </Button>
                  ))}
                  <Button
                    variant="outline" size="icon" className="h-8 w-8"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right: Prisma Data */}
        <Card>
          <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Data Prisma</CardTitle>
              {activeLog && (
                <Badge variant="secondary" className="bg-sky-100 text-sky-700 font-normal">
                  Log: {activeLog}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm">
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Lihat 3D
              </Button>
              <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-300 hover:bg-emerald-50">
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download Excel
              </Button>
              <div className="flex overflow-hidden rounded-md border">
                <button
                  onClick={() => setDataView("event")}
                  className={cn("px-3 py-1.5 text-xs font-medium transition-colors border-r", dataView === "event" ? "bg-brand text-white" : "hover:bg-muted")}
                >
                  Event
                </button>
                <button
                  onClick={() => setDataView("harian")}
                  className={cn("px-3 py-1.5 text-xs font-medium transition-colors", dataView === "harian" ? "bg-brand text-white" : "hover:bg-muted")}
                >
                  Harian
                </button>
              </div>
              <div className="flex overflow-hidden rounded-md border">
                <button
                  onClick={() => setViewMode("tabel")}
                  className={cn("flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors border-r", viewMode === "tabel" ? "bg-brand text-white" : "hover:bg-muted")}
                >
                  <TableIcon className="h-3 w-3" />Tabel
                </button>
                <button
                  onClick={() => setViewMode("peta")}
                  className={cn("flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors", viewMode === "peta" ? "bg-brand text-white" : "hover:bg-muted")}
                >
                  <Map className="h-3 w-3" />Peta
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === "peta" ? (
              <div className="flex h-[400px] items-center justify-center rounded-lg border-2 border-dashed bg-muted/30">
                <div className="text-center text-muted-foreground">
                  <Map className="mx-auto mb-2 h-10 w-10 opacity-40" />
                  <p className="text-sm font-medium">Peta Lokasi Prisma</p>
                  <p className="text-xs">Map akan ditampilkan di sini</p>
                </div>
              </div>
            ) : defLoading ? (
              <div className="flex h-[300px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-brand/40" />
              </div>
            ) : pengukuran.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center rounded-lg border-2 border-dashed bg-muted/20">
                <p className="text-sm text-muted-foreground">Tidak ada data untuk log ini</p>
              </div>
            ) : (
              <div className="overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-center border-r w-12">No</TableHead>
                      <TableHead className="border-r min-w-[120px]">Nama Prisma</TableHead>
                      <TableHead colSpan={6} className="text-center border-r">Awal Pengukuran</TableHead>
                      <TableHead colSpan={6} className="text-center border-r">Hasil Pengukuran</TableHead>
                      <TableHead colSpan={4} className="text-center border-r">Pergeseran</TableHead>
                      <TableHead className="text-center min-w-[100px]">Arah</TableHead>
                    </TableRow>
                    <TableRow className="bg-muted/30">
                      {["E", "N", "Z", "HA", "VA", "SD"].map((h) => (
                        <TableHead key={`a-${h}`} className="text-center text-xs border-r px-2">{h}</TableHead>
                      ))}
                      {["E", "N", "Z", "HA", "VA", "SD"].map((h) => (
                        <TableHead key={`b-${h}`} className="text-center text-xs border-r px-2">{h}</TableHead>
                      ))}
                      {["ΔE", "ΔN", "ΔZ", "Linier"].map((h) => (
                        <TableHead key={`c-${h}`} className="text-center text-xs border-r px-2">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pengukuran.map((pr: Record<string, unknown>, idx: number) => {
                      const t = pr.temp_tembak as Record<string, unknown> | undefined;
                      if (!t) return null;
                      return (
                        <TableRow key={pr.id_prisma as string} className="transition-colors hover:bg-brand/3">
                          <TableCell className="text-center border-r text-xs">{idx + 1}</TableCell>
                          <TableCell className="border-r text-xs font-medium text-brand">{pr.nama_prisma as string}</TableCell>
                          <TableCell className="text-center border-r text-xs">{String(t.E0)}</TableCell>
                          <TableCell className="text-center border-r text-xs">{String(t.N0)}</TableCell>
                          <TableCell className="text-center border-r text-xs">{String(t.Z0)}</TableCell>
                          <TableCell className="text-center border-r text-xs">{String(t.HA0)}</TableCell>
                          <TableCell className="text-center border-r text-xs">{String(t.VA0)}</TableCell>
                          <TableCell className="text-center border-r text-xs">{String(t.SD0)}</TableCell>
                          <TableCell className="text-center border-r text-xs">{String(t.E1)}</TableCell>
                          <TableCell className="text-center border-r text-xs">{String(t.N1)}</TableCell>
                          <TableCell className="text-center border-r text-xs">{String(t.Z1)}</TableCell>
                          <TableCell className="text-center border-r text-xs">{String(t.HA1)}</TableCell>
                          <TableCell className="text-center border-r text-xs">{String(t.VA1)}</TableCell>
                          <TableCell className="text-center border-r text-xs">{String(t.SD1)}</TableCell>
                          <TableCell className="text-center border-r text-xs">{String(t.DE)}</TableCell>
                          <TableCell className="text-center border-r text-xs">{String(t.DN)}</TableCell>
                          <TableCell className="text-center border-r text-xs">{String(t.DZ)}</TableCell>
                          <TableCell className="text-center border-r text-xs">{typeof t.linear === "number" ? (t.linear as number).toFixed(4) : String(t.linear)}</TableCell>
                          <TableCell className="text-center text-xs">{String(t.arah_pergeseran)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SensorCategoryCard>
  );
}

// ─── Non-RTS Logger Card (AWLR, ARR, EWS etc) ──────────────
function SensorLoggerCard({ logger }: { logger: LoggerRow }) {
  const { detail, isLoading } = useLoggerDetail(logger.id_logger);

  const tempTable = `temp_${logger.tabel || logger.nama_kategori?.toLowerCase() || "awlr"}`;
  const tempData = detail?.tempData?.[0];
  const parameters = detail?.parameters || [];

  const lastUpdate = tempData?.waktu ? fmtDate(tempData.waktu) : "-";
  const isConnected = !!tempData;

  return (
    <SensorCategoryCard
      title={logger.nama_kategori}
      locationName={logger.nama_lokasi || logger.nama_logger}
      lastUpdate={lastUpdate}
      statusColor={isConnected ? "green" : "dark"}
      loggerId={logger.id_logger}
      loggerStatus={isConnected ? "Terhubung" : "Terputus"}
      sdStatus="OK"
    >
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : parameters.length > 0 ? (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Parameter</TableHead>
                <TableHead>Nilai Ukur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parameters.map((p: { id_param: number; nama_param: string; kolom_sensor: string; satuan: string }) => {
                const sensorKey = p.kolom_sensor; // e.g. "sensor1"
                const value = tempData ? (tempData as Record<string, unknown>)[sensorKey] : "-";
                return (
                  <TableRow key={p.id_param} className="transition-colors hover:bg-brand/3">
                    <TableCell className="text-sm font-medium text-brand">{p.nama_param}</TableCell>
                    <TableCell className="text-sm">
                      {value !== undefined && value !== null ? `${value} ${p.satuan}` : "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : tempData ? (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Sensor</TableHead>
                <TableHead>Nilai</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(tempData as Record<string, unknown>)
                .filter(([k]) => k.startsWith("sensor") && (tempData as Record<string, unknown>)[k] !== 0)
                .slice(0, 8)
                .map(([key, val]) => (
                  <TableRow key={key} className="transition-colors hover:bg-brand/3">
                    <TableCell className="text-sm font-medium text-brand">{key}</TableCell>
                    <TableCell className="text-sm">{String(val)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-4 text-center">Belum ada data</p>
      )}
    </SensorCategoryCard>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function BerandaPage() {
  const { loggers, isLoading, isError } = useLoggers();

  const categories = useMemo(() => groupByCategory(loggers), [loggers]);

  // Separate RTS from other categories
  const rtsCategory = categories.find((g) => g.kategori.toUpperCase().includes("RTS") || g.kategori.toUpperCase().includes("ADR"));
  const otherCategories = categories.filter((g) => g !== rtsCategory);

  return (
    <div className="space-y-6">
      <PageHeader title="Beranda" />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[150px] w-full" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Gagal memuat data logger. Pastikan koneksi database sudah benar.
            </p>
          </CardContent>
        </Card>
      ) : loggers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Belum ada logger terdaftar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* RTS Section */}
          {rtsCategory && (
            <CategorySection
              name={rtsCategory.kategori}
              abbreviation={rtsCategory.kepanjangan}
            >
              {rtsCategory.loggers.map((log) => (
                <RtsSection key={log.id_logger} logger={log} />
              ))}
            </CategorySection>
          )}

          {/* Other Sensor Categories */}
          <div className="grid gap-6 lg:grid-cols-2">
            {otherCategories.map((cat) => (
              <CategorySection
                key={cat.kategori}
                name={cat.kategori}
                abbreviation={cat.kepanjangan}
              >
                {cat.loggers.map((log) => (
                  <SensorLoggerCard key={log.id_logger} logger={log} />
                ))}
              </CategorySection>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
