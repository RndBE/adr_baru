import React from "react";
import { cn } from "@/lib/utils";
import { useRtsConnectionStatus } from "@/hooks/use-api";

function fmtDate(d: string | Date | null, showSeconds = false, shortYear = false) {
  if (!d) return "-";
  let isoStr = typeof d === "string" ? d : d.toISOString();
  if (isoStr.includes("T")) {
    const [datePart, timePart] = isoStr.split("T");
    const [year, month, day] = datePart.split("-");
    const [hr, min, sec] = timePart.split(".")[0].split(":");
    const yFormat = shortYear ? year.slice(2) : year;
    const sFormat = showSeconds ? `:${sec}` : "";
    return `${day}-${month}-${yFormat} ${hr}:${min}${sFormat}`;
  }
  return "-";
}

export function RtsConnectionBadge({ className }: { className?: string }) {
  const { isConnected, lastUpdate } = useRtsConnectionStatus();
  const lastUpdateStr = lastUpdate ? fmtDate(lastUpdate, true) : "Belum ada data";

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 flex-shrink-0 whitespace-nowrap rounded-full text-[11px] font-bold border",
      isConnected 
        ? "bg-[#E5F7E7] text-[#06C022] border-green-200 shadow-sm" 
        : "bg-red-50 text-red-600 border-red-200 shadow-sm",
      className
    )}>
      {isConnected ? "Terhubung" : "Tidak Terhubung"} &bull; {lastUpdateStr}
    </div>
  );
}
