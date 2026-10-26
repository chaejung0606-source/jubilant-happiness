"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Search, Plus, X, Check, Loader2, Undo2, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SoftCard } from "@/components/cards/soft-card";
import { StatusBadge } from "@/components/badges/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form-controls";
import { createLoanAction, returnLoanAction, deleteLoanAction } from "@/app/loans/actions";
import { todayKst } from "@/lib/diff";
import type { LoanRow } from "@/lib/dummy";
import type { Tone } from "@/lib/status";

type AssetLite = { mgmtNo: string; itemName: string };
type Tab = "active" | "returned" | "all";

const EMPTY = { mgmtNo: "", itemName: "", borrower: "", affiliation: "", phone: "", reason: "", loanedAt: "", dueAt: "" };
type Form = typeof EMPTY;

const statusTone = (s: string): Tone => (s === "반납완료" ? "slate" : s === "연체" ? "coral" : "sky");

export function LoansClient({ loans, assets }: { loans: LoanRow[]; assets: AssetLite[] }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("active");
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<Form>({ ...EMPTY, loanedAt: todayKst() });
  const [busy, setBusy] = React.useState<string>(""); // id 또는 "new"
  const [error, setError] = React.useState("");
  const [confirmId, setConfirmId] = React.useState("");

  const itemByMgmt = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const a of assets) if (a.mgmtNo) m.set(a.mgmtNo, a.itemName);
    return m;
  }, [assets]);

  const counts = React.useMemo(() => {
    let active = 0, returned = 0;
    for (const l of loans) {
      if (l.status === "반납완료") returned += 1;
      else active += 1;
    }
    return { active, returned, all: loans.length };
  }, [loans]);

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return loans
      .filter((l) => (tab === "active" ? l.status !== "반납완료" : tab === "returned" ? l.status === "반납완료" : true))
      .filter((l) =>
        !q ||
        [l.mgmtNo, l.itemName, l.borrower, l.affiliation, l.phone].some((v) => (v ?? "").toLowerCase().includes(q))
      );
  }, [loans, tab, query]);

  function set<K extends keyof Form>(k: K, v: string) {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "mgmtNo") {
        const name = itemByMgmt.get(v.trim());
        if (name) next.itemName = name;
      }
      return next;
    });
  }

  async function submitLoan(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.mgmtNo.trim() || !form.itemName.trim() || !form.borrower.trim() || !form.dueAt) {
      setError("관리번호·품명·대여자·반납예정일은 필수입니다.");
      return;
    }
    setBusy("new");
    const r = await createLoanAction({
      mgmtNo: form.mgmtNo.trim(),
      itemName: form.itemName.trim(),
      borrower: form.borrower.trim(),
      affiliation: form.affiliation.trim(),
      phone: form.phone.trim(),
      reason: form.reason.trim(),
      loanedAt: form.loanedAt || todayKst(),
      dueAt: form.dueAt,
    });
    setBusy("");
    if (!r.ok) { setError(r.error || "대여 처리에 실패했습니다."); return; }
    setForm({ ...EMPTY, loanedAt: todayKst() });
    setOpen(false);
    router.refresh();
  }

  async function doReturn(l: LoanRow) {
    if (!l.id) { setError("이 대여 건은 식별자(id)가 없어 반납 처리를 할 수 없습니다. 시트 연동 후 다시 시도하세요."); return; }
    setError("");
    setBusy(l.id);
    const r = await returnLoanAction(l.id, todayKst());
    setBusy("");
    if (!r.ok) { setError(r.error || "반납 처리에 실패했습니다."); return; }
    router.refresh();
  }

  async function doDelete(l: LoanRow) {
    if (!l.id) return;
    setError("");
    setBusy(l.id);
    const r = await deleteLoanAction(l.id);
    setBusy("");
    setConfirmId("");
    if (!r.ok) { setError(r.error || "삭제에 실패했습니다."); return; }
    router.refresh();
  }

  const TabBtn = ({ k, label, n }: { k: Tab; label: string; n: number }) => (
    <button
      onClick={() => setTab(k)}
      className={
        "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
        (tab === k ? "bg-primary text-primary-foreground shadow-pill" : "text-muted-foreground hover:bg-accent")
      }
    >
      {label} <span className="tabular-nums opacity-70">{n}</span>
    </button>
  );

  return (
    <>
      <PageHeader
        title="대여"
        description="자산 대여·반납 처리와 대여내역 관리"
        icon={<ArrowLeftRight className="h-6 w-6" />}
        actions={
          <Button onClick={() => { setOpen((v) => !v); setError(""); }}>
            {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {open ? "닫기" : "대여 처리"}
          </Button>
        }
      />

      {open && (
        <SoftCard className="mb-5">
          <form onSubmit={submitLoan} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="관리번호" required hint="목록에서 선택/입력">
                <Input list="loan-asset-list" value={form.mgmtNo} onChange={(e) => set("mgmtNo", e.target.value)} placeholder="[1]202407315011B0000142" />
                <datalist id="loan-asset-list">
                  {assets.slice(0, 2000).map((a) => <option key={a.mgmtNo} value={a.mgmtNo}>{a.itemName}</option>)}
                </datalist>
              </Field>
              <Field label="품명" required>
                <Input value={form.itemName} onChange={(e) => set("itemName", e.target.value)} placeholder="관리번호 선택 시 자동" />
              </Field>
              <Field label="대여자" required>
                <Input value={form.borrower} onChange={(e) => set("borrower", e.target.value)} placeholder="홍길동" />
              </Field>
              <Field label="소속">
                <Input value={form.affiliation} onChange={(e) => set("affiliation", e.target.value)} placeholder="데이터보안학과" />
              </Field>
              <Field label="연락처">
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="010-0000-0000" />
              </Field>
              <Field label="사유">
                <Input value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="현장 조사" />
              </Field>
              <Field label="대여일" required>
                <Input type="date" value={form.loanedAt} onChange={(e) => set("loanedAt", e.target.value)} />
              </Field>
              <Field label="반납예정일" required>
                <Input type="date" value={form.dueAt} onChange={(e) => set("dueAt", e.target.value)} />
              </Field>
            </div>
            {error && <p className="text-sm text-pastel-coralInk">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setOpen(false); setError(""); }}>취소</Button>
              <Button type="submit" disabled={busy === "new"}>
                {busy === "new" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                대여 등록
              </Button>
            </div>
          </form>
        </SoftCard>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          <TabBtn k="active" label="대여중·연체" n={counts.active} />
          <TabBtn k="returned" label="반납완료" n={counts.returned} />
          <TabBtn k="all" label="전체" n={counts.all} />
        </div>
        <div className="relative ml-auto min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="관리번호·품명·대여자 검색" />
        </div>
      </div>

      {error && !open && <p className="mb-3 text-sm text-pastel-coralInk">{error}</p>}

      <SoftCard padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">관리번호</th>
                <th className="px-5 py-3 font-medium">품명</th>
                <th className="px-5 py-3 font-medium">대여자</th>
                <th className="px-5 py-3 font-medium">소속</th>
                <th className="px-5 py-3 font-medium">대여일</th>
                <th className="px-5 py-3 font-medium">반납예정</th>
                <th className="px-5 py-3 font-medium">반납일</th>
                <th className="px-5 py-3 font-medium">상태</th>
                <th className="px-5 py-3 text-right font-medium">작업</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-muted-foreground">해당하는 대여 내역이 없습니다.</td></tr>
              )}
              {rows.map((l) => {
                const rowBusy = !!l.id && busy === l.id;
                return (
                  <tr key={(l.id || l.mgmtNo) + l.borrower + l.loanedAt} className="border-b border-black/[0.04] hover:bg-accent/60">
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-[13px] text-foreground/80">{l.mgmtNo}</td>
                    <td className="px-5 py-3 font-medium text-foreground">{l.itemName}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-foreground/80">{l.borrower}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{l.affiliation}</td>
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums text-muted-foreground">{l.loanedAt}</td>
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums text-muted-foreground">{l.dueAt}</td>
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums text-muted-foreground">{l.returnedAt || "—"}</td>
                    <td className="px-5 py-3"><StatusBadge label={l.status} tone={statusTone(l.status)} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {l.status !== "반납완료" && (
                          <Button size="sm" variant="outline" disabled={rowBusy} onClick={() => doReturn(l)} title="반납 처리">
                            {rowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                            반납
                          </Button>
                        )}
                        {confirmId === l.id ? (
                          <>
                            <Button size="sm" variant="destructive" disabled={rowBusy} onClick={() => doDelete(l)}>삭제</Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirmId("")}>취소</Button>
                          </>
                        ) : (
                          <Button size="sm" variant="ghost" disabled={!l.id} onClick={() => setConfirmId(l.id || "")} title="삭제">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SoftCard>
    </>
  );
}
