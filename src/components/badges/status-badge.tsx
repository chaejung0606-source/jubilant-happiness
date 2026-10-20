import * as React from "react";
import { cn } from "@/lib/utils";
import { toneClasses, type Tone } from "@/lib/status";

/** 공통 pill 배지 — 작은 점 + 라벨. */
export function StatusBadge({
  label, tone = "slate", dot = true, className,
}: { label: React.ReactNode; tone?: Tone; dot?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
        toneClasses[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {label}
    </span>
  );
}
