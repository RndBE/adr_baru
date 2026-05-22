"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Battery,
  Box,
  CloudRain,
  Crosshair,
  Gauge,
  Layers3,
  MapPin,
  RadioTower,
  Ruler,
  Search,
  Signal,
  SlidersHorizontal,
  TriangleAlert,
  Waves,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatMineSensorValue,
  getMineSensorPrioritySummary,
  getMineSensorStatusSummary,
  getMineSensorTypeSummary,
  mineNetworkSensors,
  mineSensorTypeLabels,
  type MineNetworkSensor,
  type MineSensorStatus,
  type MineSensorType,
} from "@/lib/mine-network";
import { cn } from "@/lib/utils";

const sensorTypes: MineSensorType[] = [
  "tiltmeter",
  "crack-meter",
  "piezometer",
  "rain-gauge",
  "vibration",
  "gnss",
];

const sensorTypeIcons = {
  tiltmeter: Gauge,
  "crack-meter": Ruler,
  piezometer: Waves,
  "rain-gauge": CloudRain,
  vibration: Activity,
  gnss: Crosshair,
} satisfies Record<MineSensorType, React.ElementType>;

const sensorTypeColors = {
  tiltmeter: { stroke: "#2f6fed", soft: "#e8f0ff" },
  "crack-meter": { stroke: "#c05621", soft: "#fff3e8" },
  piezometer: { stroke: "#0891b2", soft: "#e6f8fc" },
  "rain-gauge": { stroke: "#2563eb", soft: "#eaf2ff" },
  vibration: { stroke: "#7c3aed", soft: "#f2ecff" },
  gnss: { stroke: "#15803d", soft: "#eaf8ee" },
} satisfies Record<MineSensorType, { stroke: string; soft: string }>;

const statusStyles = {
  normal: {
    label: "Normal",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    ring: "ring-emerald-400",
  },
  caution: {
    label: "Waspada",
    dot: "bg-amber-500",
    text: "text-amber-700",
    border: "border-amber-200",
    bg: "bg-amber-50",
    ring: "ring-amber-400",
  },
  danger: {
    label: "Bahaya",
    dot: "bg-red-500",
    text: "text-red-700",
    border: "border-red-200",
    bg: "bg-red-50",
    ring: "ring-red-500",
  },
} satisfies Record<
  MineSensorStatus,
  { label: string; dot: string; text: string; border: string; bg: string; ring: string }
>;

const networkLines = [
  ["TLT-01", "VIB-01"],
  ["VIB-01", "CRK-01"],
  ["CRK-01", "PZO-01"],
  ["PZO-01", "VIB-03"],
  ["VIB-03", "TLT-03"],
  ["TLT-03", "GNS-02"],
  ["PZO-01", "GNS-03"],
  ["GNS-03", "CRK-02"],
  ["CRK-02", "RNG-02"],
  ["GNS-03", "GNS-01"],
  ["GNS-01", "TLT-02"],
  ["TLT-02", "PZO-02"],
  ["PZO-02", "VIB-02"],
  ["VIB-02", "RNG-03"],
  ["TLT-02", "RNG-01"],
] as const;

function getSensorById(id: string) {
  return mineNetworkSensors.find((sensor) => sensor.id === id);
}

function StatusPill({ status }: { status: MineSensorStatus }) {
  const style = statusStyles[status];

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold", style.bg, style.border, style.text)}>
      <span className={cn("h-2 w-2 rounded-full", style.dot)} />
      {style.label}
    </span>
  );
}

function SensorMarker({
  sensor,
  selected,
  onSelect,
}: {
  sensor: MineNetworkSensor;
  selected: boolean;
  onSelect: (sensor: MineNetworkSensor) => void;
}) {
  const Icon = sensorTypeIcons[sensor.type];
  const typeColor = sensorTypeColors[sensor.type];
  const status = statusStyles[sensor.status];

  return (
    <button
      type="button"
      title={`${sensor.id} - ${sensor.name}`}
      onClick={() => onSelect(sensor)}
      className={cn(
        "absolute z-20 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-white shadow-md transition hover:scale-110 focus-visible:outline-none focus-visible:ring-4",
        selected ? "scale-110 ring-4" : "",
        status.ring
      )}
      style={{
        left: `${sensor.x}%`,
        top: `${sensor.y}%`,
        borderColor: typeColor.stroke,
      }}
    >
      <span className={cn("absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white", status.dot)} />
      <Icon className="h-4 w-4" style={{ color: typeColor.stroke }} />
    </button>
  );
}

export function MineNetworkMap() {
  const [selectedType, setSelectedType] = useState<MineSensorType | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  const statusSummary = getMineSensorStatusSummary(mineNetworkSensors);
  const typeSummary = getMineSensorTypeSummary(mineNetworkSensors);
  const prioritySummary = getMineSensorPrioritySummary(mineNetworkSensors);

  const filteredSensors = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return mineNetworkSensors.filter((sensor) => {
      const matchesType = selectedType === "all" || sensor.type === selectedType;
      const matchesQuery =
        !normalizedQuery ||
        sensor.name.toLowerCase().includes(normalizedQuery) ||
        sensor.id.toLowerCase().includes(normalizedQuery) ||
        sensor.zone.toLowerCase().includes(normalizedQuery);
      return matchesType && matchesQuery;
    });
  }, [query, selectedType]);

  const selectedSensor = selectedId
    ? filteredSensors.find((sensor) => sensor.id === selectedId) ??
      mineNetworkSensors.find((sensor) => sensor.id === selectedId) ??
      null
    : null;

  const highPrioritySensors = mineNetworkSensors
    .filter((sensor) => sensor.status !== "normal")
    .sort((a, b) => (a.status === "danger" ? -1 : 1) - (b.status === "danger" ? -1 : 1));

  return (
    <section className="relative h-[calc(100vh-5rem)] min-h-180 overflow-hidden rounded-lg border bg-[#e8eef0]">
          <div className="absolute inset-0">
            <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <pattern id="mine-grid" width="8" height="8" patternUnits="userSpaceOnUse">
                  <path d="M 8 0 L 0 0 0 8" fill="none" stroke="#cbd5e1" strokeWidth="0.18" opacity="0.5" />
                </pattern>
                <linearGradient id="pit-bench-outer" x1="18" y1="17" x2="86" y2="66" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#f8fafc" />
                  <stop offset="0.55" stopColor="#dbe4ec" />
                  <stop offset="1" stopColor="#aab9c8" />
                </linearGradient>
                <linearGradient id="pit-bench-mid" x1="25" y1="28" x2="78" y2="62" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#edf3f8" />
                  <stop offset="0.58" stopColor="#c9d6e2" />
                  <stop offset="1" stopColor="#8fa2b4" />
                </linearGradient>
                <linearGradient id="pit-bench-inner" x1="35" y1="40" x2="67" y2="57" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#d9e4ed" />
                  <stop offset="0.58" stopColor="#b7c6d4" />
                  <stop offset="1" stopColor="#788da1" />
                </linearGradient>
                <linearGradient id="pit-floor" x1="43" y1="44" x2="64" y2="56" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#9fb3c4" />
                  <stop offset="1" stopColor="#566d82" />
                </linearGradient>
                <linearGradient id="bench-wall" x1="52" y1="22" x2="57" y2="73" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#c6d2df" stopOpacity="0.25" />
                  <stop offset="1" stopColor="#60758a" stopOpacity="0.5" />
                </linearGradient>
                <radialGradient id="pit-depth-shadow" cx="54%" cy="50%" r="42%">
                  <stop stopColor="#334155" stopOpacity="0.34" />
                  <stop offset="0.62" stopColor="#334155" stopOpacity="0.08" />
                  <stop offset="1" stopColor="#334155" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="waste-fill" x1="0" y1="68" x2="32" y2="100" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#dbe7dd" />
                  <stop offset="1" stopColor="#c6d7cb" />
                </linearGradient>
              </defs>
              <rect width="100" height="100" fill="#e8eef0" />
              <rect width="100" height="100" fill="url(#mine-grid)" />

              <path d="M0 66 L13 50 L27 48 L37 62 L33 78 L17 91 L0 100 Z" fill="url(#waste-fill)" />
              <path d="M73 0 L100 0 L100 42 L90 47 L81 38 L76 20 Z" fill="#d9e8dc" />
              <path d="M3 92 L16 84 L28 79 L40 78 L52 86" fill="none" stroke="#64748b" strokeWidth="1.2" strokeDasharray="1 1.4" />
              <path d="M20 76 L34 70 L45 72 L57 82" fill="none" stroke="#64748b" strokeWidth="0.9" strokeDasharray="1 1.2" opacity="0.75" />

              <path d="M13 53 L15 33 L32 18 L56 13 L78 18 L90 32 L88 50 L74 66 L50 72 L27 65 Z" fill="#9fb0c1" opacity="0.32" />
              <path d="M14 31 L31 18 L55 13 L77 18 L90 31 L88 49 L74 64 L50 70 L28 64 L13 50 Z" fill="url(#pit-bench-outer)" stroke="#a5b5c5" strokeWidth="0.95" />
              <path d="M14 31 L31 18 L55 13 L77 18 L90 31 L84 34 L76 25 L56 20 L35 25 L22 36 L13 50 Z" fill="#f8fbfe" opacity="0.72" />
              <path d="M13 50 L28 64 L50 70 L74 64 L88 49 L82 51 L70 59 L50 64 L31 59 L20 48 Z" fill="url(#bench-wall)" opacity="0.9" />

              <path d="M22 36 L37 27 L57 23 L73 28 L81 39 L77 52 L64 61 L45 64 L30 58 L21 48 Z" fill="url(#pit-bench-mid)" stroke="#9fb0c2" strokeWidth="0.75" />
              <path d="M22 36 L37 27 L57 23 L73 28 L81 39 L75 40 L65 32 L56 30 L39 33 L27 42 L21 48 Z" fill="#f6f9fc" opacity="0.55" />
              <path d="M21 48 L30 58 L45 64 L64 61 L77 52 L71 53 L62 57 L46 59 L33 54 L27 47 Z" fill="#8fa2b6" opacity="0.22" />

              <path d="M31 42 L44 35 L59 33 L70 39 L72 49 L63 56 L48 59 L36 54 L30 48 Z" fill="url(#pit-bench-inner)" stroke="#8ea1b4" strokeWidth="0.72" />
              <path d="M31 42 L44 35 L59 33 L70 39 L66 41 L58 38 L45 40 L34 46 L30 48 Z" fill="#e8f0f7" opacity="0.48" />
              <path d="M30 48 L36 54 L48 59 L63 56 L72 49 L66 50 L59 53 L49 55 L38 52 Z" fill="#6f8499" opacity="0.25" />

              <path d="M41 46 L51 41 L61 43 L65 49 L59 54 L49 55 L42 52 Z" fill="url(#pit-floor)" stroke="#657b91" strokeWidth="0.68" />
              <path d="M41 46 L51 41 L61 43 L65 49 L59 54 L49 55 L42 52 Z" fill="url(#pit-depth-shadow)" />
              <path d="M42 47 L51 43 L60 45 L62 49 L58 52 L49 53 L44 51 Z" fill="#72879b" opacity="0.55" />

              <path d="M18 39 L31 47 L45 49 L62 47 L78 42" fill="none" stroke="#ffffff" strokeWidth="0.36" strokeDasharray="1.8 1.4" opacity="0.72" />
              <path d="M25 51 L38 57 L51 58 L66 54 L77 47" fill="none" stroke="#ffffff" strokeWidth="0.32" strokeDasharray="1.7 1.4" opacity="0.62" />
              <path d="M35 44 L47 47 L58 47 L68 44" fill="none" stroke="#475569" strokeWidth="0.18" strokeDasharray="1.2 1" opacity="0.3" />

              <path d="M4 89 C17 79 30 71 43 62 C57 52 68 41 82 29 C88 24 92 19 97 14" fill="none" stroke="#64748b" strokeWidth="2.25" strokeLinecap="round" opacity="0.28" />
              <path d="M4 88 C17 78 30 70 43 61 C57 51 68 40 82 28 C88 23 92 18 97 13" fill="none" stroke="#9aa9b9" strokeWidth="2.05" strokeLinecap="round" />
              <path d="M5 86 C18 77 31 69 44 59 C58 49 69 38 83 27 C89 22 93 17 98 12" fill="none" stroke="#ffffff" strokeWidth="0.7" strokeLinecap="round" strokeDasharray="2.3 2.3" />
              <path d="M28 68 C37 62 45 57 54 50 C62 44 69 37 77 31" fill="none" stroke="#d6dee7" strokeWidth="1.15" strokeLinecap="round" opacity="0.85" />
              <path d="M29 67 C38 61 46 56 55 49 C63 43 70 36 78 30" fill="none" stroke="#ffffff" strokeWidth="0.36" strokeLinecap="round" strokeDasharray="1.5 1.3" opacity="0.75" />
              <path d="M39 56 C46 53 54 49 62 45 C68 42 73 39 79 36" fill="none" stroke="#8395a8" strokeWidth="0.42" strokeLinecap="round" strokeDasharray="1.3 1.2" opacity="0.45" />
              <path d="M69 88 C66 77 68 66 76 58 C84 50 94 47 99 34" fill="none" stroke="#0ea5e9" strokeWidth="1.25" strokeLinecap="round" />
              <path d="M73 88 C70 77 72 68 80 61 C88 54 96 50 100 41" fill="none" stroke="#38bdf8" strokeWidth="0.38" strokeLinecap="round" opacity="0.7" />
              <path d="M63 56 C66 57 70 59 74 62 C76 64 78 67 80 70" fill="none" stroke="#0ea5e9" strokeWidth="0.45" strokeDasharray="0.8 1" opacity="0.85" />
              <path d="M18 74 L20 72 L22 74 L20 76 Z M23 71 L25 69 L27 71 L25 73 Z M27 76 L29 74 L31 76 L29 78 Z" fill="#9fb5a6" opacity="0.75" />
              <path d="M81 36 L86 32 L91 31 L94 33 L92 37 L86 39 Z" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="0.35" />
            </svg>
          </div>

          <div className="pointer-events-none absolute left-4 right-4 top-4 z-30 flex items-start justify-between gap-3">
            <div className="pointer-events-auto rounded-lg border bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
              <div className="flex items-center gap-2 text-xs font-bold text-[#303481]">
                <MapPin className="h-4 w-4" />
                Open Pit Geoteknik
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Dummy network, 18 titik kritis</p>
            </div>

            <div className="pointer-events-auto flex gap-2">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setFilterOpen((open) => !open)}
                className={cn(
                  "h-10 shadow-sm backdrop-blur",
                  filterOpen
                    ? "border-[#303481] bg-[#303481] text-white hover:bg-[#303481]/90 hover:text-white"
                    : "bg-white/95 text-foreground hover:bg-white"
                )}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filter
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setLegendOpen((open) => !open)}
                className={cn(
                  "h-10 shadow-sm backdrop-blur",
                  legendOpen
                    ? "border-[#303481] bg-[#303481] text-white hover:bg-[#303481]/90 hover:text-white"
                    : "bg-white/95 text-foreground hover:bg-white"
                )}
              >
                <Layers3 className="h-4 w-4" />
                Legenda
              </Button>
            </div>

            <div className="hidden min-w-0 flex-1 justify-center xl:flex">
              <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border bg-white/88 p-1.5 shadow-sm backdrop-blur">
                <div className="flex min-w-28 items-center gap-2 rounded-md border bg-white/80 px-2.5 py-1.5">
                  <RadioTower className="h-3.5 w-3.5 text-[#303481]" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Total</p>
                    <p className="text-xs font-bold">{statusSummary.total} Sensor</p>
                  </div>
                </div>
                <div className="flex min-w-22 items-center gap-2 rounded-md border border-red-200 bg-red-50/90 px-2.5 py-1.5">
                  <TriangleAlert className="h-3.5 w-3.5 text-red-600" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-red-700">Bahaya</p>
                    <p className="text-xs font-bold text-red-700">{statusSummary.danger}</p>
                  </div>
                </div>
                <div className="flex min-w-22 items-center gap-2 rounded-md border border-amber-200 bg-amber-50/90 px-2.5 py-1.5">
                  <Activity className="h-3.5 w-3.5 text-amber-600" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-amber-700">Waspada</p>
                    <p className="text-xs font-bold text-amber-700">{statusSummary.caution}</p>
                  </div>
                </div>
                <div className="flex min-w-22 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/90 px-2.5 py-1.5">
                  <Signal className="h-3.5 w-3.5 text-emerald-600" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-emerald-700">Normal</p>
                    <p className="text-xs font-bold text-emerald-700">{statusSummary.normal}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFilterOpen(true);
                    const firstDanger = prioritySummary.topDangerIds[0];
                    if (firstDanger) setSelectedId(firstDanger);
                  }}
                  className="flex min-w-[190px] items-center gap-2 rounded-md border border-red-200 bg-white/80 px-2.5 py-1.5 text-left transition hover:bg-red-50"
                >
                  <TriangleAlert className="h-3.5 w-3.5 text-red-600" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Prioritas</p>
                    <p className="text-xs font-bold">
                      {prioritySummary.dangerCount} bahaya: {prioritySummary.topDangerIds.join(", ")}
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <Link
              href="/peta-jaringan-tambang/3d"
              className="pointer-events-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#303481] px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#303481]/90"
            >
              <Box className="h-4 w-4" />
              Tampilan Peta 3D
            </Link>
          </div>

          {legendOpen && (
            <div className="absolute left-4 top-20 z-40 w-[280px] rounded-lg border bg-white/95 p-4 shadow-sm backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold">Legenda</h3>
                <button
                  type="button"
                  onClick={() => setLegendOpen(false)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {(["normal", "caution", "danger"] as MineSensorStatus[]).map((status) => (
                  <StatusPill key={status} status={status} />
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {sensorTypes.map((type) => {
                  const Icon = sensorTypeIcons[type];
                  const colors = sensorTypeColors[type];
                  return (
                    <Badge
                      key={type}
                      variant="outline"
                      className="h-7 gap-1.5 rounded-md px-2"
                      style={{ backgroundColor: colors.soft, borderColor: colors.stroke, color: colors.stroke }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {mineSensorTypeLabels[type]}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {networkLines.map(([fromId, toId]) => {
              const from = getSensorById(fromId);
              const to = getSensorById(toId);
              if (!from || !to) return null;
              return (
                <line
                  key={`${fromId}-${toId}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="#475569"
                  strokeOpacity="0.34"
                  strokeWidth="0.45"
                  strokeDasharray="1.5 1.2"
                />
              );
            })}
          </svg>

          <div className="pointer-events-none absolute inset-0 z-[12] text-[10px] font-bold uppercase tracking-wide text-slate-600/60">
            <span className="absolute rounded border border-white/50 bg-white/45 px-2 py-0.5 shadow-sm backdrop-blur-[2px]" style={{ left: "35%", top: "29%" }}>
              Pit Utara
            </span>
            <span className="absolute rounded border border-white/50 bg-white/45 px-2 py-0.5 shadow-sm backdrop-blur-[2px]" style={{ left: "68%", top: "43%" }}>
              Highwall Timur
            </span>
            <span className="absolute rounded border border-white/50 bg-white/45 px-2 py-0.5 shadow-sm backdrop-blur-[2px]" style={{ left: "47%", top: "65%" }}>
              Ramp Selatan
            </span>
          </div>

          {filteredSensors.map((sensor) => (
            <SensorMarker
              key={sensor.id}
              sensor={sensor}
              selected={sensor.id === selectedSensor?.id}
              onSelect={(nextSensor) => setSelectedId(nextSensor.id)}
            />
          ))}

          {filterOpen && (
          <div className="absolute left-4 top-24 z-30 max-h-[calc(100%-7rem)] w-[276px] space-y-3 overflow-auto pr-1">
            <section className="rounded-lg border bg-white/95 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-[#303481]" />
                  <h3 className="text-sm font-bold">Filter Sensor</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setFilterOpen(false)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <label className="mt-3 flex h-9 items-center gap-2 rounded-md border bg-background/80 px-3 text-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari ID, zona, sensor"
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                />
              </label>

              <div className="mt-3 grid max-h-[210px] gap-2 overflow-auto pr-1">
                <Button
                  variant={selectedType === "all" ? "default" : "outline"}
                  className="justify-start"
                  onClick={() => setSelectedType("all")}
                >
                  <Layers3 className="h-4 w-4" />
                  Semua Sensor
                  <span className="ml-auto text-xs">{statusSummary.total}</span>
                </Button>
                {sensorTypes.map((type) => {
                  const Icon = sensorTypeIcons[type];
                  const colors = sensorTypeColors[type];
                  return (
                    <Button
                      key={type}
                      variant={selectedType === type ? "default" : "outline"}
                      className="justify-start"
                      onClick={() => setSelectedType(type)}
                    >
                      <Icon className="h-4 w-4" style={{ color: selectedType === type ? "currentColor" : colors.stroke }} />
                      {mineSensorTypeLabels[type]}
                      <span className="ml-auto text-xs">{typeSummary[type]}</span>
                    </Button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border bg-white/95 p-3 shadow-sm backdrop-blur">
              <h3 className="text-sm font-bold">Prioritas Inspeksi</h3>
              <div className="mt-2 max-h-[170px] space-y-2 overflow-auto pr-1">
                {highPrioritySensors.slice(0, 5).map((sensor) => (
                  <button
                    key={sensor.id}
                    type="button"
                    onClick={() => setSelectedId(sensor.id)}
                    className="w-full rounded-md border bg-white/80 p-2 text-left transition hover:bg-muted/70"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold">{sensor.id}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{sensor.criticalPoint}</p>
                      </div>
                      <StatusPill status={sensor.status} />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
          )}

          {selectedSensor && (
            <aside className="absolute right-4 top-24 z-30 max-h-[calc(100%-7rem)] w-[300px] overflow-auto rounded-lg border bg-white/94 p-3.5 shadow-sm backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{selectedSensor.id}</p>
                  <h3 className="mt-0.5 text-base font-bold leading-tight">{selectedSensor.name}</h3>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <StatusPill status={selectedSensor.status} />
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-md border bg-muted/25 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Nilai</p>
                  <p className="mt-1 text-base font-bold">{formatMineSensorValue(selectedSensor)}</p>
                </div>
                <div className="rounded-md border bg-muted/25 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Trend</p>
                  <p className="mt-1 text-base font-bold capitalize">{selectedSensor.trend}</p>
                </div>
              </div>

              <dl className="mt-3 grid gap-2 text-xs">
                <div className="flex justify-between gap-3 border-b pb-2">
                  <dt className="text-muted-foreground">Tipe</dt>
                  <dd className="font-semibold">{mineSensorTypeLabels[selectedSensor.type]}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b pb-2">
                  <dt className="text-muted-foreground">Zona</dt>
                  <dd className="font-semibold">{selectedSensor.zone}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b pb-2">
                  <dt className="text-muted-foreground">Titik kritis</dt>
                  <dd className="text-right font-semibold">{selectedSensor.criticalPoint}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b pb-2">
                  <dt className="text-muted-foreground">Ambang</dt>
                  <dd className="font-semibold">{selectedSensor.threshold}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Update</dt>
                  <dd className="font-semibold">{selectedSensor.lastUpdate}</dd>
                </div>
              </dl>

              <p className="mt-3 rounded-md border bg-muted/25 p-2.5 text-xs leading-relaxed text-muted-foreground">
                {selectedSensor.note}
              </p>

              <div className="mt-3 rounded-md border bg-white/70 p-2.5">
                <h4 className="text-xs font-bold">Kesehatan Perangkat</h4>
                <div className="mt-2 space-y-2.5">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                        <Battery className="h-3.5 w-3.5" />
                        Battery
                      </span>
                      <span className="font-bold">{selectedSensor.battery}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${selectedSensor.battery}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                        <Signal className="h-3.5 w-3.5" />
                        Signal
                      </span>
                      <span className="font-bold">{selectedSensor.signal}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div className="h-1.5 rounded-full bg-[#303481]" style={{ width: `${selectedSensor.signal}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          )}
    </section>
  );
}
