import Link from "next/link";
import {
  Boxes,
  Coins,
  ScanLine,
  ArrowLeftRight,
  Wrench,
  Sparkles,
  Plus,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/cards/stat-card";
import { SoftCard, SoftCardHeader } from "@/components/cards/soft-card";
import { StatusBadge } from "@/components/badges/status-badge";
import { Button } from "@/components/ui/button";
import { getAssets, getLoans, getConsumables, getPromo } from "@/data";
import { MONTHLY, won } from "@/lib/dummy";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [ASSETS, LOANS, CONSUMABLES, PROMO] = await Promise.all([
    getAssets(), getLoans(), getConsumables(), getPromo(),
  ]);
  const total = ASSETS.length;
  const acquisition = ASSETS.reduce((s, a) => s + a.unitPrice, 0);
  const loansOut = ASSETS.filter((a) => a.status === "대여중").length;
  const needsInspection = ASSETS.filter((a) => a.status === "점검필요" || a.status === "수리중").length;
  const rfidMissing = 2; // 더미
  const newThisMonth = 3; // 더미

  const lowStock = [
    ...CONSUMABLES.filter((c) => c.qty <= c.safetyQty).map((c) => ({ name: c.itemName, note: `${c.qty}${c.unit} / 안전 ${c.safetyQty}`, tone: c.statusTone, status: c.status })),
    ...PROMO.filter((p) => p.qty <= p.safetyQty).map((p) => ({ name: p.name, note: `${p.qty}${p.unit} / 안전 ${p.safetyQty}`, tone: p.statusTone, status: p.status })),
  ];

  const maxAmount = Math.max(...MONTHLY.map((m) => m.amount));
  const recent = ASSETS.slice(0, 5);

  return (
    <>
      <PageHeader
        title="대시보드"
        description="사업단 자산·소모품·홍보물품 현황 한눈에 보기"
        icon={<Sparkles className="h-6 w-6" />}
        actions={
          <Button asChild size="sm">
            <Link href="/assets"><Plus className="h-4 w-4" /> 자산 등록</Link>
          </Button>
        }
      />

      {/* 통계 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <StatCard label="총 자산" value={`${total}건`} sub="등록된 전체 자산" icon={Boxes} tone="mint" />
        <StatCard label="취득 총액" value={won(acquisition)} sub="누적 취득가" icon={Coins} tone="cream" />
        <StatCard label="RFID 미등록" value={`${rfidMissing}건`} sub="태그 확인 필요" icon={ScanLine} tone="apricot" />
        <StatCard label="대여중" value={`${loansOut}건`} sub="현재 외부/직원 대여" icon={ArrowLeftRight} tone="sky" />
        <StatCard label="점검·수리" value={`${needsInspection}건`} sub="조치 필요" icon={Wrench} tone="coral" />
        <StatCard label="이번달 신규" value={`${newThisMonth}건`} sub="10월 등록" icon={Sparkles} tone="purple" trend={{ value: "지난달 대비 +1", up: true }} />
      </div>

      {/* 차트 + 재고 주의 */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <SoftCard>
          <SoftCardHeader title="월별 취득 금액" description="최근 6개월 (단위: 만원)" />
          <div className="flex h-44 gap-3 sm:gap-5">
            {MONTHLY.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-xl bg-brand-400/80"
                    style={{ height: `${Math.max(8, (m.amount / maxAmount) * 100)}%` }}
                    title={`${m.amount}만원`}
                  />
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">{m.month}</span>
              </div>
            ))}
          </div>
        </SoftCard>

        <SoftCard>
          <SoftCardHeader
            title="재고 주의"
            description="안전재고 이하 품목"
            action={<AlertTriangle className="h-5 w-5 text-pastel-apricotInk" />}
          />
          <ul className="flex flex-col gap-2.5">
            {lowStock.map((it) => (
              <li key={it.name} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{it.name}</div>
                  <div className="text-xs text-muted-foreground">{it.note}</div>
                </div>
                <StatusBadge label={it.status} tone={it.tone} />
              </li>
            ))}
            {lowStock.length === 0 && <li className="text-sm text-muted-foreground">주의 품목 없음</li>}
          </ul>
        </SoftCard>
      </div>

      {/* 최근 자산 + 대여 현황 */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <SoftCard padded={false}>
          <div className="flex items-center justify-between px-6 pt-6">
            <SoftCardHeader title="최근 등록 자산" className="mb-0" />
            <Link href="/assets" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              전체 보기 <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-3 divide-y divide-black/[0.05]">
            {recent.map((a) => (
              <div key={a.mgmtNo} className="flex items-center justify-between gap-3 px-6 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{a.itemName}</div>
                  <div className="text-xs text-muted-foreground">{a.mgmtNo} · {a.category}</div>
                </div>
                <StatusBadge label={a.status} tone={a.statusTone} />
              </div>
            ))}
          </div>
        </SoftCard>

        <SoftCard>
          <SoftCardHeader title="대여 현황" description={`진행 중 ${LOANS.length}건`} />
          <ul className="flex flex-col gap-3">
            {LOANS.map((l) => (
              <li key={l.mgmtNo + l.borrower} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{l.itemName}</div>
                  <div className="text-xs text-muted-foreground">{l.borrower} · ~{l.dueAt}</div>
                </div>
                <StatusBadge label={l.overdue ? "연체" : "대여중"} tone={l.overdue ? "coral" : "sky"} />
              </li>
            ))}
          </ul>
        </SoftCard>
      </div>
    </>
  );
}
