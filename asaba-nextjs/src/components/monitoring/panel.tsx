"use client";

import type { ComponentProps, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { WARNA_STATUS, type StatusLabel } from "./status";

/** Kartu kertas: hairline, tanpa bayangan. Datanya yang boleh ramai, bukan bingkainya. */
export function Panel({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-[14px] bg-white ring-1 ring-(--line)",
        className
      )}
      {...props}
    />
  );
}

export function Eyebrow({
  className,
  tone = "paper",
  ...props
}: ComponentProps<"p"> & { tone?: "paper" | "console" }) {
  return (
    <p
      className={cn(
        "font-display text-[11px] font-semibold uppercase tracking-[0.14em]",
        tone === "console" ? "text-(--console-ink-3)" : "text-(--ink-3)",
        className
      )}
      {...props}
    />
  );
}

export function PanelTitle({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      className={cn(
        "font-display text-[19px] font-bold leading-tight tracking-[-0.01em] text-(--ink)",
        className
      )}
      {...props}
    />
  );
}

export function PanelHeader({
  title,
  children,
  actions,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3",
        className
      )}
    >
      <div className="min-w-0">
        <PanelTitle>{title}</PanelTitle>
        {children && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-(--ink-3)">
            {children}
          </div>
        )}
      </div>
      {/* Tanpa shrink-0: blok aksi yang lebih lebar dari panelnya (mis. pemilih
          rentang di layar 390px) harus boleh membungkus, bukan meluap keluar
          panel. Pada lebar normal perilakunya sama — flex hanya menyusutkan
          item yang sendirian melebihi barisnya. */}
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Chip kecil untuk meta: tanggal sesi, jumlah prisma. */
export function Chip({
  className,
  mono,
  ...props
}: ComponentProps<"span"> & { mono?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full bg-(--paper) px-2.5 text-[11.5px] font-medium text-(--ink-2) ring-1 ring-(--line)",
        mono && "font-mono tabular-nums",
        className
      )}
      {...props}
    />
  );
}

export function LinkLanjut({ children, className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "group inline-flex cursor-pointer items-center gap-1.5 rounded-md text-[13px] font-semibold text-(--navy) outline-none hover:underline focus-visible:ring-2 focus-visible:ring-(--navy)/40",
        className
      )}
      {...props}
    >
      {children}
      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

export function PanelFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-end border-t border-(--line) px-5 py-3", className)}>
      {children}
    </div>
  );
}

export function StatusDot({
  status,
  className,
}: {
  status: StatusLabel | null | undefined;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ background: status ? WARNA_STATUS[status] : "var(--ink-3)" }}
    />
  );
}

/** Titik + teks — status tidak pernah diwakili warna saja. */
export function StatusChip({
  status,
  className,
  tone = "paper",
}: {
  status: StatusLabel | null | undefined;
  className?: string;
  tone?: "paper" | "console";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[12.5px] font-semibold",
        tone === "console" ? "text-(--console-ink)" : "text-(--ink)",
        className
      )}
    >
      <StatusDot status={status} />
      {status ?? "—"}
    </span>
  );
}

export function StatTile({
  label,
  value,
  unit,
  sub,
  compact,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  sub?: ReactNode;
  /** Untuk nilai berupa tanggal/teks panjang, bukan angka. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[12px] text-(--ink-2)">{label}</p>
      <p className="mt-1 flex items-baseline gap-1 text-(--ink)">
        <span
          className={cn(
            "font-bold leading-none tracking-[-0.02em]",
            compact ? "text-[20px]" : "text-[26px]"
          )}
        >
          {value}
        </span>
        {unit && <span className="text-[12px] font-medium text-(--ink-3)">{unit}</span>}
      </p>
      {sub && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-(--ink-3)">{sub}</div>
      )}
    </div>
  );
}
