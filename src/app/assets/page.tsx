"use client";

import * as React from "react";
import { Boxes, Search, Plus, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SoftCard } from "@/components/cards/soft-card";
import { StatusBadge } from "@/components/badges/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ASSETS, won } from "@/lib/dummy";

export default function AssetsPage() {
  const [q, setQ] = React.useState("");

  const rows = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return ASSETS;
    return ASSETS.filter((a) =>
      [a.mgmtNo, a.itemName, a.category, a.user ?? "", a.location, a.status]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [q]);

  return (
    <>
      <PageHeader
        title="자산"
        description="사업단 자산 원장"
        icon={<Boxes className="h-6 w-6" />}
        actions={
          <>
            <Button variant="outline" size="sm"><Download className="h-4 w-4" /> 내보내기</Button>
            <Button size="sm"><Plus className="h-4 w-4" /> 자산 등록</Button>
          </>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="관리번호·품명·사용자·상태 검색"
            className="pl-9"
          />
        </div>
        <span className="whitespace-nowrap text-sm text-muted-foreground">{rows.length}건</span>
      </div>

      <SoftCard padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">관리번호</th>
                <th className="px-5 py-3 font-medium">품명</th>
                <th className="px-5 py-3 font-medium">분류</th>
                <th className="px-5 py-3 font-medium">상태</th>
                <th className="px-5 py-3 font-medium">사용자</th>
                <th className="px-5 py-3 font-medium">장소</th>
                <th className="px-5 py-3 text-right font-medium">취득단가</th>
                <th className="px-5 py-3 font-medium">취득일</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.mgmtNo} className="border-b border-black/[0.04] transition-colors hover:bg-accent/60">
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-[13px] text-foreground/80">{a.mgmtNo}</td>
                  <td className="px-5 py-3 font-medium text-foreground">{a.itemName}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{a.category}</td>
                  <td className="px-5 py-3"><StatusBadge label={a.status} tone={a.statusTone} /></td>
                  <td className="whitespace-nowrap px-5 py-3 text-foreground/80">{a.user ?? "—"}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{a.location}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-foreground/90">{won(a.unitPrice)}</td>
                  <td className="whitespace-nowrap px-5 py-3 tabular-nums text-muted-foreground">{a.acquiredAt}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">검색 결과가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SoftCard>
    </>
  );
}
