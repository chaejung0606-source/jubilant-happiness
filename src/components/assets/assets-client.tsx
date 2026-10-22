"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Boxes, Search, Plus, Download, X, Check, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SoftCard } from "@/components/cards/soft-card";
import { StatusBadge } from "@/components/badges/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/ui/form-controls";
import { ASSET_STATUS_OPTIONS } from "@/data/map";
import { createAssetAction } from "@/app/assets/actions";
import type { AssetRow } from "@/lib/dummy";
import { won } from "@/lib/dummy";

const EMPTY = {
  mgmtNo: "", rfid: "", spec: "", itemName: "", category: "", status: "정상",
  user: "", location: "", unitPrice: "", acquiredAt: "",
};

export function AssetsClient({ initial, configured }: { initial: AssetRow[]; configured: boolean }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ ...EMPTY });
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const rows = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return initial;
    return initial.filter((a) =>
      [a.mgmtNo, a.rfid ?? "", a.itemName, a.spec ?? "", a.category, a.user ?? "", a.location, a.status]
        .join(" ").toLowerCase().includes(term)
    );
  }, [q, initial]);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await createAssetAction({
      mgmtNo: form.mgmtNo.trim(),
      rfid: form.rfid.trim(),
      spec: form.spec.trim(),
      itemName: form.itemName.trim(),
      category: form.category.trim(),
      status: form.status,
      user: form.user.trim(),
      location: form.location.trim(),
      unitPrice: Number(String(form.unitPrice).replace(/[,\s]/g, "")) || 0,
      acquiredAt: form.acquiredAt,
    });
    setPending(false);
    if (res.ok) {
      setForm({ ...EMPTY });
      setOpen(false);
      router.refresh();
    } else {
      setError(res.error ?? "저장에 실패했습니다.");
    }
  }

  return (
    <>
      <PageHeader
        title="자산"
        description="사업단 자산 원장"
        icon={<Boxes className="h-6 w-6" />}
        actions={
          <>
            <Button variant="outline" size="sm"><Download className="h-4 w-4" /> 내보내기</Button>
            <Button size="sm" onClick={() => setOpen((v) => !v)}>
              <Plus className="h-4 w-4" /> 자산 등록
            </Button>
          </>
        }
      />

      {open && (
        <SoftCard className="mb-4">
          <form onSubmit={submit}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">새 자산 등록</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="닫기"
                className="grid h-8 w-8 place-items-center rounded-xl text-muted-foreground hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>

            {!configured && (
              <p className="mb-4 rounded-2xl bg-pastel-apricot/70 px-3.5 py-2.5 text-xs text-pastel-apricotInk">
                아직 Google Sheets 연동 전이라 저장은 되지 않습니다. 설정 &gt; 데이터 연동에서 시트를 연결하면 바로 저장됩니다.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="관리번호(자산번호)" required><Input value={form.mgmtNo} onChange={(e) => set("mgmtNo", e.target.value)} placeholder="Z0108… / 501-0016" required /></Field>
              <Field label="RFID"><Input value={form.rfid} onChange={(e) => set("rfid", e.target.value)} placeholder="KKR-PB-…" /></Field>
              <Field label="품명" required><Input value={form.itemName} onChange={(e) => set("itemName", e.target.value)} placeholder="노트북컴퓨터" required /></Field>
              <Field label="규격"><Input value={form.spec} onChange={(e) => set("spec", e.target.value)} placeholder="엘지전자 15ZG90S-…" /></Field>
              <Field label="분류"><Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="전산기기" /></Field>
              <Field label="상태">
                <NativeSelect value={form.status} onChange={(e) => set("status", e.target.value)}>
                  {ASSET_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </NativeSelect>
              </Field>
              <Field label="사용자"><Input value={form.user} onChange={(e) => set("user", e.target.value)} placeholder="(선택)" /></Field>
              <Field label="장소"><Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="공학1호관 304" /></Field>
              <Field label="취득단가(원)"><Input value={form.unitPrice} onChange={(e) => set("unitPrice", e.target.value)} inputMode="numeric" placeholder="1890000" /></Field>
              <Field label="취득일"><Input type="date" value={form.acquiredAt} onChange={(e) => set("acquiredAt", e.target.value)} /></Field>
            </div>

            {error && <p className="mt-3 text-sm text-pastel-coralInk">{error}</p>}

            <div className="mt-4 flex items-center gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} 저장
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>취소</Button>
            </div>
          </form>
        </SoftCard>
      )}

      <div className="mb-4 flex items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="관리번호·RFID·품명·규격·사용자 검색" className="pl-9" />
        </div>
        <span className="whitespace-nowrap text-sm text-muted-foreground">{rows.length}건</span>
      </div>

      <SoftCard padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">관리번호</th>
                <th className="px-5 py-3 font-medium">RFID</th>
                <th className="px-5 py-3 font-medium">품명</th>
                <th className="px-5 py-3 font-medium">규격</th>
                <th className="px-5 py-3 font-medium">분류</th>
                <th className="px-5 py-3 font-medium">상태</th>
                <th className="px-5 py-3 font-medium">사용자</th>
                <th className="px-5 py-3 font-medium">장소</th>
                <th className="px-5 py-3 text-right font-medium">취득단가</th>
                <th className="px-5 py-3 font-medium">취득일</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => (
                <tr key={a.id ?? a.mgmtNo + i} className="border-b border-black/[0.04] transition-colors hover:bg-accent/60">
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-[13px] text-foreground/80">{a.mgmtNo}</td>
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-[12px] text-muted-foreground">{a.rfid || "—"}</td>
                  <td className="px-5 py-3 font-medium text-foreground">{a.itemName}</td>
                  <td className="max-w-[220px] truncate px-5 py-3 text-muted-foreground" title={a.spec || ""}>{a.spec || "—"}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{a.category}</td>
                  <td className="px-5 py-3"><StatusBadge label={a.status} tone={a.statusTone} /></td>
                  <td className="whitespace-nowrap px-5 py-3 text-foreground/80">{a.user ?? "—"}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{a.location}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-foreground/90">{won(a.unitPrice)}</td>
                  <td className="whitespace-nowrap px-5 py-3 tabular-nums text-muted-foreground">{a.acquiredAt}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={10} className="px-5 py-10 text-center text-muted-foreground">검색 결과가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SoftCard>
    </>
  );
}
