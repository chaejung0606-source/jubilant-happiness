import { Boxes, Coins, ScanLine, Sparkles, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { HeroCard } from "@/components/cards/hero-card";
import { StatCard } from "@/components/cards/stat-card";
import { SoftCard, SoftCardHeader } from "@/components/cards/soft-card";
import { StatusBadge } from "@/components/badges/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/ui/form-controls";

// 디자인 시스템 쇼케이스 — 이 한 화면이 무광 세라믹 룩을 전부 보여준다.
// 실제 앱을 만들 땐 이 페이지를 지우고 컴포넌트를 조합해 쓰면 된다.
const rows = [
  { no: "A-001", name: "곰두리 스마트톡", tone: "mint" as const, status: "정상", qty: 804 },
  { no: "A-002", name: "백령잣 선물세트", tone: "cream" as const, status: "재고 주의", qty: 60 },
  { no: "A-003", name: "세라믹 고블렛잔", tone: "coral" as const, status: "품절", qty: 0 },
  { no: "A-004", name: "위글위글 보냉백", tone: "sky" as const, status: "정상", qty: 290 },
];

export default function Home() {
  return (
    <main className="ceramic-page min-h-screen">
      <div className="mx-auto w-full max-w-[1120px] animate-fade-in-up px-4 py-8 md:px-8">
        <PageHeader
          title="디자인 시스템 스타터"
          description="무광 세라믹 · 아이보리 + 민트 파스텔. 이 화면의 컴포넌트를 조합해 앱을 만드세요."
          icon={<Sparkles className="h-6 w-6" />}
          actions={
            <>
              <Button variant="outline" size="sm"><Search className="h-4 w-4" /> 검색</Button>
              <Button size="sm"><Plus className="h-4 w-4" /> 새로 만들기</Button>
            </>
          }
        />

        <HeroCard
          greeting="안녕하세요 👋"
          subtitle="광택 없이 은은한 그림자와 입자감으로 완성한 무광 세라믹 톤입니다."
          actions={
            <>
              <a className="inline-flex items-center gap-2 rounded-2xl bg-white/90 px-4 py-2.5 text-sm font-semibold text-brand-700 shadow-pill transition hover:bg-white" href="#components">
                <Sparkles className="h-4 w-4" /> 컴포넌트 보기
              </a>
            </>
          }
        />

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="전체 품목" value="906" sub="건" icon={Boxes} tone="lavender" />
          <StatCard label="누적 금액" value="11.7억" sub="원" icon={Coins} tone="purple" />
          <StatCard label="미등록" value="34%" sub="RFID" icon={ScanLine} tone="coral" />
          <StatCard label="이번 달 신규" value="12" sub="2026-10" icon={Sparkles} tone="mint" />
        </div>

        <div id="components" className="mt-6 grid gap-6 lg:grid-cols-5">
          {/* 표 */}
          <SoftCard className="lg:col-span-3">
            <SoftCardHeader title="재고 현황" description="카드형 테이블 + 상태 배지" action={<Button variant="ghost" size="sm">전체 보기</Button>} />
            <div className="overflow-x-auto pastel-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.05] text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium">코드</th>
                    <th className="px-3 py-2.5 font-medium">품명</th>
                    <th className="px-3 py-2.5 font-medium">상태</th>
                    <th className="px-3 py-2.5 text-right font-medium">재고</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.no} className="border-b border-black/[0.04] transition-colors last:border-0 hover:bg-accent/60">
                      <td className="px-3 py-3 font-mono text-xs">{r.no}</td>
                      <td className="px-3 py-3 font-medium">{r.name}</td>
                      <td className="px-3 py-3"><StatusBadge label={r.status} tone={r.tone} /></td>
                      <td className="px-3 py-3 text-right tabular-nums">{r.qty.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SoftCard>

          {/* 폼 + 버튼 + 배지 */}
          <SoftCard className="lg:col-span-2">
            <SoftCardHeader title="폼 요소" description="입력 · 선택 · 버튼" />
            <div className="space-y-3">
              <Field label="품명" required><Input placeholder="예: 곰두리 스마트톡" /></Field>
              <Field label="분류" hint="선택"><NativeSelect defaultValue=""><option value="" disabled>선택</option><option>기념품</option><option>소모품</option></NativeSelect></Field>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button>기본</Button>
                <Button variant="soft">소프트</Button>
                <Button variant="outline">아웃라인</Button>
                <Button variant="ghost">고스트</Button>
                <Button variant="destructive">삭제</Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(["mint","sky","lavender","purple","cream","apricot","coral","slate"] as const).map((t) => (
                  <StatusBadge key={t} label={t} tone={t} dot={false} />
                ))}
              </div>
            </div>
          </SoftCard>
        </div>
      </div>
    </main>
  );
}
