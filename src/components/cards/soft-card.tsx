import * as React from "react";
import { cn } from "@/lib/utils";

/** 공통 세라믹 카드 — 모든 표면의 기본 컨테이너. 무광 질감 + grain 내장. */
export function SoftCard({
  className, children, padded = true, hover = false, ...props
}: React.HTMLAttributes<HTMLDivElement> & { padded?: boolean; hover?: boolean }) {
  return (
    <div
      className={cn(
        "relative grain rounded-card bg-card shadow-soft ring-1 ring-black/[0.03] transition-all duration-300",
        hover && "hover:-translate-y-0.5 hover:shadow-soft-lg",
        padded && "p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SoftCardHeader({
  title, description, action, className,
}: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
