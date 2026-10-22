import { Gift } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/cards/stat-card";
import { SoftCard, SoftCardHeader } from "@/components/cards/soft-card";
import { StatusBadge } from "@/components/badges/status-badge";
import { getPromo } from "@/data";

export default async function PromoPage() {
  const PROMO = await getPromo();
  const totalQty = PROMO.reduce((s, p) => s + p.qty, 0);
  const lowCount = PROMO.filter((p) => p.qty <= p.safetyQty).length;

  return (
    <>
      <PageHeader title="홍보물품" description="홍보물품 수불·재고" icon={<Gift className="h-6 w-6" />} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label="품목 수" value={`${PROMO.length}종`} icon={Gift} tone="purple" />
        <StatCard label="총 재고" value={`${totalQty.toLocaleString("ko-KR")}개`} tone="mint" />
        <StatCard label="재고 주의" value={`${lowCount}종`} tone="apricot" />
      </div>

      <SoftCard padded={false}>
        <SoftCardHeader title="품목 목록" className="px-6 pt-6" />
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">코드</th>
                <th className="px-5 py-3 font-medium">품명</th>
                <th className="px-5 py-3 text-right font-medium">재고</th>
                <th className="px-5 py-3 text-right font-medium">안전재고</th>
                <th className="px-5 py-3 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {PROMO.map((p) => (
                <tr key={p.code} className="border-b border-black/[0.04] hover:bg-accent/60">
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-[13px] text-foreground/70">{p.code}</td>
                  <td className="px-5 py-3 font-medium text-foreground">{p.name}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums">{p.qty.toLocaleString("ko-KR")}{p.unit}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-muted-foreground">{p.safetyQty}{p.unit}</td>
                  <td className="px-5 py-3"><StatusBadge label={p.status} tone={p.statusTone} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SoftCard>
    </>
  );
}
