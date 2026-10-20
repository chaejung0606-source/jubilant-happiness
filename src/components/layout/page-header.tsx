import * as React from "react";
import { cn } from "@/lib/utils";

/** 페이지 상단 제목/설명 + 우측 액션 영역. */
export function PageHeader({
  title, description, actions, icon, className,
}: { title: string; description?: string; actions?: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-pastel-lavender text-pastel-lavenderInk shadow-soft">
            {icon}
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
