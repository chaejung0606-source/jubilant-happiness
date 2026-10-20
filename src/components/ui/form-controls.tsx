import * as React from "react";
import { cn } from "@/lib/utils";

export const selectClass =
  "flex h-11 w-full rounded-2xl border-0 bg-card px-3.5 text-sm shadow-soft ring-1 ring-black/[0.05] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60";

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(selectClass, className)} {...props}>
      {children}
    </select>
  )
);
NativeSelect.displayName = "NativeSelect";

export function Field({
  label, required, hint, className, children,
}: { label?: string; required?: boolean; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="block text-[13px] font-medium text-foreground/80">
          {label}
          {required && <span className="ml-0.5 text-pastel-coralInk">*</span>}
          {hint && <span className="ml-1 text-[11px] font-normal text-muted-foreground">{hint}</span>}
        </label>
      )}
      {children}
    </div>
  );
}

export function FormSection({
  title, description, children,
}: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card bg-card p-6 shadow-soft ring-1 ring-black/[0.03]">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}
