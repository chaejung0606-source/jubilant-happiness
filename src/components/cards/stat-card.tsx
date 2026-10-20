import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toneClasses, type Tone } from "@/lib/status";

/** 은은한 파스텔 배경의 통계 카드. */
export function StatCard({
  label, value, sub, icon: Icon, tone = "lavender", trend,
}: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: LucideIcon;
  tone?: Tone; trend?: { value: string; up?: boolean };
}) {
  return (
    <div className={cn("relative grain rounded-3xl p-5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg", toneClasses[tone])}>
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium opacity-80">{label}</span>
        {Icon && (
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-white/55">
            <Icon strokeWidth={2.2} style={{ width: 18, height: 18 }} />
          </span>
        )}
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums">{value}</div>
      <div className="mt-1 flex items-center gap-2">
        {sub && <span className="text-xs opacity-70">{sub}</span>}
        {trend && <span className="text-xs font-semibold">{trend.up ? "▲" : "▼"} {trend.value}</span>}
      </div>
    </div>
  );
}
