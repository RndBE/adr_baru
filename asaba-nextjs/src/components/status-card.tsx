import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";

interface StatusCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: LucideIcon;
  href?: string;
  className?: string;
}

export function StatusCard({
  label,
  value,
  unit,
  className,
}: StatusCardProps) {
  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-brand/5 hover:-translate-y-0.5",
        className
      )}
    >
      <CardContent className="flex flex-col items-center justify-center py-4 text-center">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-2xl font-bold tracking-tight">{value}</span>
          {unit && (
            <span className="text-sm font-medium text-muted-foreground">
              {unit}
            </span>
          )}
        </div>
      </CardContent>
      {/* Hover gradient accent */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-brand/0 via-brand/60 to-brand/0 opacity-0 transition-opacity group-hover:opacity-100" />
    </Card>
  );
}
