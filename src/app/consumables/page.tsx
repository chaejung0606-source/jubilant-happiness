import { FlaskConical } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SoftCard, SoftCardHeader } from "@/components/cards/soft-card";
import { StatusBadge } from "@/components/badges/status-badge";
import { getConsumables } from "@/data";

export default async function ConsumablesPage() {
  const CONSUMABLES = await getConsumables();
  return (
    <>
      <PageHeader title="소모품" description="연구재료·소모품 재고" icon={<FlaskConical className="h-6 w-6" />} />
      <div className="grid gap-4 sm:grid-cols-2">
        {CONSUMABLES.map((c) => {
          const ratio = c.safetyQty > 0 ? Math.min(100, Math.round((c.qty / (c.safetyQty * 2)) * 100)) : 100;
          return (
            <SoftCard key={c.itemName} hover>
              <SoftCardHeader
                title={c.itemName}
                description={c.spec}
                action={<StatusBadge label={c.status} tone={c.statusTone} />}
              />
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-2xl font-bold tabular-nums text-foreground">{c.qty}<span className="ml-1 text-sm font-medium text-muted-foreground">{c.unit}</span></div>
                  <div className="text-xs text-muted-foreground">안전재고 {c.safetyQty}{c.unit}</div>
                </div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
                <div
                  className={c.qty <= c.safetyQty ? "h-full rounded-full bg-pastel-coralInk/70" : "h-full rounded-full bg-brand-400"}
                  style={{ width: `${ratio}%` }}
                />
              </div>
            </SoftCard>
          );
        })}
      </div>
    </>
  );
}
