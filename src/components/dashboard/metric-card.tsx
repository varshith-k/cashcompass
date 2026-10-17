import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  delta?: { value: string; direction: "up" | "down"; isGood: boolean };
  sublabel?: string;
}

export function MetricCard({ label, value, icon: Icon, delta, sublabel }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="px-5 py-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} />
        </div>
        <p className="font-heading text-2xl font-semibold mt-2">{value}</p>
        <div className="flex items-center gap-1.5 mt-1 min-h-5">
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                delta.isGood ? "text-positive" : "text-critical",
              )}
            >
              {delta.direction === "up" ? (
                <ArrowUpRight className="size-3.5" />
              ) : (
                <ArrowDownRight className="size-3.5" />
              )}
              {delta.value}
            </span>
          )}
          {sublabel && <span className="text-xs text-muted-foreground">{sublabel}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
