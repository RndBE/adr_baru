"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Battery,
  Layers,
  Loader2,
  Map,
  RadioTower,
  Signal,
  Thermometer,
  TriangleAlert,
  Eye,
  Box,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  formatMineSensorValue,
  getMineSensorGeoPoints,
  getMineSensorStatusSummary,
  mineNetworkSensors,
  mineSensorTypeLabels,
  type MineSensorStatus,
} from "@/lib/mine-network";
import { cn } from "@/lib/utils";

// Deck.gl + MapLibre only runs on client — must be dynamically imported
const MineNetwork3DDeck = dynamic(
  () => import("@/components/mine-network-3d-deck").then((m) => ({ default: m.MineNetwork3DDeck })),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 text-white">
        <Loader2 className="h-7 w-7 animate-spin" />
        <p className="text-sm font-semibold">Memuat Deck.gl viewer…</p>
      </div>
    ),
  }
);

const statusStyles = {
  normal: { label: "Normal", dot: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-200", bg: "bg-emerald-50" },
  caution: { label: "Waspada", dot: "bg-amber-500", text: "text-amber-700", border: "border-amber-200", bg: "bg-amber-50" },
  danger: { label: "Bahaya", dot: "bg-red-500", text: "text-red-700", border: "border-red-200", bg: "bg-red-50" },
} satisfies Record<MineSensorStatus, { label: string; dot: string; text: string; border: string; bg: string }>;

function StatusPill({ status }: { status: MineSensorStatus }) {
  const style = statusStyles[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold", style.bg, style.border, style.text)}>
      <span className={cn("h-2 w-2 rounded-full", style.dot)} />
      {style.label}
    </span>
  );
}

export function MineNetwork3DView() {
  const [selectedId, setSelectedId] = useState("TLT-02");
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [topView, setTopView] = useState(false);

  const geoPoints = useMemo(() => getMineSensorGeoPoints(mineNetworkSensors), []);
  const statusSummary = getMineSensorStatusSummary(mineNetworkSensors);

  const selectedSensor =
    mineNetworkSensors.find((s) => s.id === selectedId) ?? mineNetworkSensors[0];
  const selectedGeo = geoPoints.find((p) => p.id === selectedId);

  const prioritySensors = mineNetworkSensors
    .filter((s) => s.status !== "normal")
    .sort((a, b) => (a.status === "danger" ? -1 : 1) - (b.status === "danger" ? -1 : 1));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-lg border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="h-7 rounded-md border-[#303481]/25 bg-[#303481]/5 text-[#303481]">
              Deck.gl · MapLibre GL
            </Badge>
            <span className="text-sm text-muted-foreground">
              Satellite · {statusSummary.total} sensor · {statusSummary.danger} bahaya
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold">Peta 3D Tambang</h2>
        </div>
        <Link
          href="/peta-jaringan-tambang"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Peta 2D
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* 3D Map */}
        <section className="relative min-h-180 overflow-hidden rounded-lg border bg-slate-950">
          <MineNetwork3DDeck
            selectedId={selectedId}
            onSelect={setSelectedId}
            showHeatmap={showHeatmap}
            topView={topView}
          />

          {/* Top-left badge */}
          <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-lg border border-white/15 bg-black/60 px-3 py-2 shadow backdrop-blur">
            <p className="text-xs font-bold text-white">
              {topView ? "Tampilan Dari Atas" : "3D Perspektif"} · Deck.gl
            </p>
            <p className="mt-0.5 text-[11px] text-white/60">
              {topView ? "Scroll zoom · klik marker" : "Drag orbit · scroll zoom · klik marker"}
            </p>
          </div>

          {/* View controls — top right */}
          <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
            {/* Top-view toggle */}
            <button
              type="button"
              onClick={() => setTopView((v) => !v)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow backdrop-blur transition",
                topView
                  ? "border-sky-300/50 bg-sky-500/20 text-sky-200 hover:bg-sky-500/30"
                  : "border-white/20 bg-black/60 text-white/70 hover:bg-white/10"
              )}
            >
              {topView ? <Box className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {topView ? "Tampilan 3D" : "Dari Atas"}
            </button>

            {/* Heatmap toggle */}
            <button
              type="button"
              onClick={() => setShowHeatmap((v) => !v)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow backdrop-blur transition",
                showHeatmap
                  ? "border-amber-300/50 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
                  : "border-white/20 bg-black/60 text-white/70 hover:bg-white/10"
              )}
            >
              <Thermometer className="h-3.5 w-3.5" />
              Heatmap
            </button>
          </div>

          {/* Status legend */}
          <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex flex-wrap gap-2 rounded-lg border border-white/15 bg-black/60 p-3 shadow backdrop-blur">
            {(["normal", "caution", "danger"] as MineSensorStatus[]).map((s) => (
              <StatusPill key={s} status={s} />
            ))}
          </div>

          {/* Selected sensor mini-card */}
          {selectedGeo && (
            <div className="pointer-events-none absolute bottom-4 right-4 z-10 w-52 rounded-lg border border-white/15 bg-black/70 p-3 shadow backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{selectedSensor.id}</p>
              <p className="mt-0.5 text-sm font-bold text-white leading-tight">{selectedSensor.name}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-white">{formatMineSensorValue(selectedSensor)}</span>
                <StatusPill status={selectedSensor.status} />
              </div>
              <p className="mt-2 text-[11px] text-white/50">
                {selectedGeo.latitude.toFixed(5)}, {selectedGeo.longitude.toFixed(5)}
              </p>
            </div>
          )}
        </section>

        {/* Right sidebar */}
        <aside className="space-y-4">
          {/* Layer info */}
          <section className="rounded-lg border bg-white p-4">
            <h3 className="text-sm font-bold">Layer Aktif</h3>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Map className="h-4 w-4" />
                  Basemap
                </span>
                <span className="font-bold">ESRI Satellite</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Thermometer className="h-4 w-4" />
                  Heatmap
                </span>
                <span className={cn("font-bold", showHeatmap ? "text-amber-600" : "text-muted-foreground")}>
                  {showHeatmap ? "Aktif" : "Nonaktif"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Layers className="h-4 w-4" />
                  Sensor overlay
                </span>
                <span className="font-bold">{statusSummary.total} titik</span>
              </div>
            </div>
          </section>

          {/* Status summary */}
          <section className="rounded-lg border bg-white p-4">
            <h3 className="text-sm font-bold">Ringkasan Status</h3>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-center">
                <div className="text-lg font-bold text-emerald-700">{statusSummary.normal}</div>
                <div className="text-[11px] font-semibold text-emerald-700">Normal</div>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-center">
                <div className="text-lg font-bold text-amber-700">{statusSummary.caution}</div>
                <div className="text-[11px] font-semibold text-amber-700">Waspada</div>
              </div>
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-center">
                <div className="text-lg font-bold text-red-700">{statusSummary.danger}</div>
                <div className="text-[11px] font-semibold text-red-700">Bahaya</div>
              </div>
            </div>
          </section>

          {/* Priority list */}
          <section className="rounded-lg border bg-white p-4">
            <div className="flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-red-600" />
              <h3 className="text-sm font-bold">Prioritas Inspeksi</h3>
            </div>
            <div className="mt-3 space-y-2">
              {prioritySensors.slice(0, 6).map((sensor) => (
                <button
                  key={sensor.id}
                  type="button"
                  onClick={() => setSelectedId(sensor.id)}
                  className={cn(
                    "w-full rounded-md border p-3 text-left transition hover:bg-muted/50",
                    sensor.id === selectedId && "border-[#303481]/30 bg-[#303481]/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold">{sensor.id}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{sensor.criticalPoint}</p>
                    </div>
                    <StatusPill status={sensor.status} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="font-semibold">{mineSensorTypeLabels[sensor.type]}</span>
                    <span className="font-bold">{formatMineSensorValue(sensor)}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Network health */}
          <section className="rounded-lg border bg-white p-4">
            <h3 className="text-sm font-bold">Kesehatan Network</h3>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <RadioTower className="h-4 w-4" />
                  Sensor aktif
                </span>
                <span className="font-bold">{statusSummary.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Battery className="h-4 w-4" />
                  Battery rata-rata
                </span>
                <span className="font-bold">84%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Signal className="h-4 w-4" />
                  Signal rata-rata
                </span>
                <span className="font-bold">85%</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
