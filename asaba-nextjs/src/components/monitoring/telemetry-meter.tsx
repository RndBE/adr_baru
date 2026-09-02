import { fmt } from "./format";

/**
 * Satu bacaan telemetri: label, angka, dan jalur meter tipis di bawahnya.
 * Jalurnya memberi acuan besaran (mis. baterai 12,97 V pada rentang 10–14,5 V)
 * yang tidak dimiliki angka telanjang. Satu warna, tanpa arti status.
 */
export function TelemetryMeter({
  label,
  value,
  unit,
  min,
  max,
  desimal = 2,
}: {
  label: string;
  value: number | null;
  unit: string;
  min: number;
  max: number;
  desimal?: number;
}) {
  const pct =
    value === null ? 0 : Math.min(1, Math.max(0, (value - min) / (max - min)));

  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-3">
      <span className="text-[12px] text-(--console-ink-2)">{label}</span>
      <span className="text-right">
        <span className="text-[17px] font-semibold leading-none text-(--console-ink)">
          {fmt(value, desimal)}
        </span>
        <span className="ml-1 text-[11px] text-(--console-ink-3)">{unit}</span>
      </span>
      <div
        aria-hidden="true"
        className="col-span-2 mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/10"
      >
        <div
          className="h-full rounded-full bg-(--console-accent) transition-[width] duration-700 ease-out"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
