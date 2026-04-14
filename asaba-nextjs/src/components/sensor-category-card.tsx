import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { List } from "lucide-react";

interface SensorCategoryCardProps {
  title: string;
  abbreviation?: string;
  locationName: string;
  lastUpdate: string;
  statusColor: "green" | "red" | "dark" | "yellow" | "blue";
  loggerId: string;
  loggerStatus: string;
  sdStatus: string;
  children: React.ReactNode;
}

const colorMap: Record<string, string> = {
  green: "bg-emerald-500",
  red: "bg-red-500",
  dark: "bg-zinc-600",
  yellow: "bg-amber-500",
  blue: "bg-sky-500",
};

export function SensorCategoryCard({
  title,
  abbreviation,
  locationName,
  lastUpdate,
  statusColor,
  loggerId,
  loggerStatus,
  sdStatus,
  children,
}: SensorCategoryCardProps) {
  return (
    <Card className="relative overflow-hidden">
      {/* Color status bar on top */}
      <div className={cn("h-1 w-full", colorMap[statusColor])} />

      {/* Ribbon badge */}
      <div
        className={cn(
          "absolute top-3 right-4 z-10 flex items-center gap-2 rounded-md px-3 py-1 text-xs font-medium text-white shadow-md",
          colorMap[statusColor]
        )}
      >
        {lastUpdate}
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded p-0.5 transition-colors hover:bg-white/20 cursor-pointer">
            <List className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem className="flex justify-between">
              <span className="font-semibold">Id Logger</span>
              <span className="text-muted-foreground">{loggerId}</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex justify-between">
              <span className="font-semibold">Status Logger</span>
              <span className="text-muted-foreground">{loggerStatus}</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex justify-between">
              <span className="font-semibold">Status SD Card</span>
              <span className="text-muted-foreground">{sdStatus}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CardHeader className="pb-3 pt-5">
        <CardTitle className="text-base">
          {locationName}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function CategorySection({
  name,
  abbreviation,
  children,
}: {
  name: string;
  abbreviation?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          <strong>{name}</strong>
          {abbreviation && (
            <span className="ml-1 font-normal text-muted-foreground">
              ({abbreviation})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
