"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Search, Plus, X, Check, Loader2, Undo2, Trash2, PackagePlus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SoftCard } from "@/components/cards/soft-card";
import { StatusBadge } from "@/components/badges/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form-controls";
import { SignaturePad } from "@/components/ui/signature-pad";
import { createLoansAction, returnLoanAction, returnLoansAction, deleteLoanAction } from "@/app/loans/actions";
import { todayKst } from "@/lib/diff";
import type { LoanRow } from "@/lib/dummy";
import type { Tone } from "@/lib/status";

type AssetLite = { mgmtNo: string; itemName: string };
type Tab = "active" | "returned" | "all";

// 공통 대여자 정보(물품은 selectedAssets 로 별도 다중 관리)
const EMPTY = {
  borrower: "", idNo: "", affiliation: "", phone: "",
  reason: "", signature: "", loanedAt: "", lendBy: "", dueAt: "",
};
type Form = typeof EMPTY;

const statusTone = (s: string): Tone => (s === "반납완료" ? "slate" : s === "연체" ? "coral" : "sky");

/** 반납예정일 기준 D-day. */
function dday(dueAt: string): { label: string; tone: Tone; near: boolean; over: boolean } {
  if (!dueAt) return { label: "—", tone: "slate", near: false, over: false };
  const t = new Date(todayKst() + "T00:00:00").getTime();
  const d = new Date(dueAt + "T00:00:00").getTime();
  if (!Number.isFinite(d)) return { label: "—", tone: "slate", near: false, over: false };
  const diff = Math.round((d - t) / 86400000);
  if (diff < 0) return { label: `D+${-diff}`, tone: "coral", near: false, over: true };
  if (diff === 0) return { label: "D-DAY", tone: "coral", near: true, over: false };
  if (diff <= 3) return { label: `D-${diff}`, tone: "apricot", near: true, over: false };
  return { label: `D-${diff}`, tone: "mint", near: false, over: false };
}

export function LoansClient({ loans, assets }: { loans: LoanRow[]; assets: AssetLite[] }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("active");
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<Form>({ ...EMPTY, loanedAt: todayKst() });
  const [busy, setBusy] = React.useState<string>(""); // id 또는 "new" / "bulk"
  const [error, setError] = React.useState("");
  const [confirmId, setConfirmId] = React.useState("");

  // 대여 물품 다중 선택
  const [selected, setSelected] = React.useState<AssetLite[]>([]);
  const [pickOpen, setPickOpen] = React.useState(false);
  const [pickQuery, setPickQuery] = React.useState("");
  const [manualName, setManualName] = React.useState("");
  const [manualMgmt, setManualMgmt] = React.useState("");

  // 반납: 단건 인라인 + 다건 체크
  const [returnId, setReturnId] = React.useState("");
  const [returnBy, setReturnBy] = React.useState("");
  const [checked, setChecked] = React.useState<Set<string>>(new Set());
  const [bulkBy, setBulkBy] = React.useState("");

  const selectedKeys = React.useMemo(() => new Set(selected.map((a) => a.mgmtNo + "|" + a.itemName)), [selected]);
  const pickResults = React.useMemo(() => {
    const q = pickQuery.trim().toLowerCase();
    const base = q
      ? assets.filter((a) => a.mgmtNo.toLowerCase().includes(q) || a.itemName.toLowerCase().includes(q))
      : assets;
    return base.filter((a) => !selectedKeys.has(a.mgmtNo + "|" + a.itemName)).slice(0, 40);
  }, [assets, pickQuery, selectedKeys]);

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
        [l.mgmtNo, l.itemName, l.borrower, l.idNo, l.affiliation, l.phone].some((v) => (v ?? "").toLowerCase().includes(q))
      );
  }, [loans, tab, query]);

  const checkableIds = React.useMemo(() => rows.filter((l) => l.status !== "반납완료" && l.id).map((l) => l.id as string), [rows]);

  function set<K extends keyof Form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function addAsset(a: AssetLite) {
    setSelected((s) => (selectedKeys.has(a.mgmtNo + "|" + a.itemName) ? s : [...s, a]));
    setPickQuery("");
  }
  function addManual() {
    const name = manualName.trim();
    if (!name) return;
    setSelected((s) => [...s, { mgmtNo: manualMgmt.trim(), itemName: name }]);
    setManualName(""); setManualMgmt("");
  }
  function removeAsset(i: number) {
    setSelected((s) => s.filter((_, idx) => idx !== i));
  }
  function resetForm() {
    setForm({ ...EMPTY, loanedAt: todayKst() });
    setSelected([]); setPickQuery(""); setManualName(""); setManualMgmt("");
  }

  async function submitLoan(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (selected.length === 0) { setError("대여 물품을 1개 이상 선택하세요."); return; }
    if (!form.borrower.trim() || !form.dueAt) { setError("대여자·반납예정일은 필수입니다."); return; }
    setBusy("new");
    const shared = {
      borrower: form.borrower.trim(), idNo: form.idNo.trim(), affiliation: form.affiliation.trim(),
      phone: form.phone.trim(), reason: form.reason.trim(), signature: form.signature,
      loanedAt: form.loanedAt || todayKst(), lendBy: form.lendBy.trim(), dueAt: form.dueAt,
    };
    const inputs = selected.map((a) => ({ mgmtNo: a.mgmtNo, itemName: a.itemName, ...shared }));
    const r = await createLoansAction(inputs);
    setBusy("");
    if (r.ok === 0) { setError(r.error || "대여 처리에 실패했습니다."); return; }
    if (r.fail > 0) setError(`${r.ok}건 등록, ${r.fail}건 실패: ${r.error ?? ""}`);
    resetForm();
    setOpen(false);
    router.refresh();
  }

  async function doReturn(l: LoanRow) {
    if (!l.id) { setError("이 대여 건은 식별자(id)가 없어 반납 처리를 할 수 없습니다. 시트 연동 후 다시 시도하세요."); return; }
    setError("");
    setBusy(l.id);
    const r = await returnLoanAction(l.id, todayKst(), returnBy.trim());
    setBusy("");
    if (!r.ok) { setError(r.error || "반납 처리에 실패했습니다."); return; }
    setReturnId(""); setReturnBy("");
    router.refresh();
  }

  async function doBulkReturn() {
    const ids = [...checked];
    if (!ids.length) return;
    setError("");
    setBusy("bulk");
    const r = await returnLoansAction(ids, todayKst(), bulkBy.trim());
    setBusy("");
    if (r.ok === 0) { setError(r.error || "반납 처리에 실패했습니다."); return; }
    setChecked(new Set()); setBulkBy("");
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

  function toggleCheck(id: string) {
    setChecked((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() {
    setChecked((c) => (c.size === checkableIds.length && checkableIds.length > 0 ? new Set() : new Set(checkableIds)));
  }

  const TabBtn = ({ k, label, n }: { k: Tab; label: string; n: number }) => (
    <button
      onClick={() => { setTab(k); setChecked(new Set()); }}
      className={
        "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
        (tab === k ? "bg-primary text-primary-foreground shadow-pill" : "text-muted-foreground hover:bg-accent")
      }
    >
      {label} <span className="tabular-nums opacity-70">{n}</span>
    </button>
  );

  const SectionTitle = ({ n, children }: { n: number; children: React.ReactNode }) => (
    <div className="mb-3 mt-1 flex items-center gap-2">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-pastel-lavender text-[12px] font-bold text-pastel-lavenderInk">{n}</span>
      <h3 className="text-sm font-bold text-foreground">{children}</h3>
    </div>
  );

  return (
    <>
      <PageHeader
        title="대여 및 반납"
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
          <form onSubmit={submitLoan} className="space-y-6">
            {/* ① 대여 물품 (다중) */}
            <section>
              <SectionTitle n={1}>대여 물품 <span className="ml-1 text-xs font-normal text-muted-foreground">여러 개 선택 가능</span></SectionTitle>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <Field label="자산 검색" hint="클릭하면 아래 목록에 담깁니다">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        value={pickQuery}
                        onChange={(e) => { setPickQuery(e.target.value); setPickOpen(true); }}
                        onFocus={() => setPickOpen(true)}
                        onBlur={() => setTimeout(() => setPickOpen(false), 150)}
                        placeholder="예: 노트북  또는  [1]202407315011B0000142"
                      />
                      {pickOpen && pickResults.length > 0 && (
                        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-2xl bg-card p-1 shadow-soft-lg ring-1 ring-black/[0.08]">
                          {pickResults.map((a) => (
                            <li key={a.mgmtNo + a.itemName}>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => addAsset(a)}
                                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-accent"
                              >
                                <span className="truncate font-medium text-foreground">{a.itemName || "(품명 없음)"}</span>
                                <span className="shrink-0 font-mono text-[12px] text-muted-foreground">{a.mgmtNo}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </Field>
                  <div className="mt-3 flex items-end gap-2">
                    <Field label="직접 추가" hint="목록에 없을 때" className="flex-1">
                      <Input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="품명" />
                    </Field>
                    <Input value={manualMgmt} onChange={(e) => setManualMgmt(e.target.value)} placeholder="관리번호(선택)" className="w-40" />
                    <Button type="button" variant="outline" onClick={addManual}><PackagePlus className="h-4 w-4" />추가</Button>
                  </div>
                </div>

                {/* 선택된 물품 목록 */}
                <div className="rounded-2xl bg-muted/30 p-3 ring-1 ring-black/[0.04]">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-[13px] font-semibold text-foreground">선택된 물품 <span className="text-primary">{selected.length}</span>건</span>
                    {selected.length > 0 && <button type="button" onClick={() => setSelected([])} className="text-[12px] text-muted-foreground hover:text-foreground">모두 비우기</button>}
                  </div>
                  {selected.length === 0 ? (
                    <p className="px-1 py-6 text-center text-[13px] text-muted-foreground">검색해서 물품을 담아주세요.</p>
                  ) : (
                    <ul className="max-h-56 space-y-1.5 overflow-auto">
                      {selected.map((a, i) => (
                        <li key={a.mgmtNo + a.itemName + i} className="flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-2 shadow-soft">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-foreground">{a.itemName || "(품명 없음)"}</div>
                            <div className="truncate font-mono text-[11px] text-muted-foreground">{a.mgmtNo || "관리번호 없음"}</div>
                          </div>
                          <button type="button" onClick={() => removeAsset(i)} className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="제거">
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>

            {/* ② 대여 일자 */}
            <section>
              <SectionTitle n={2}>대여 일자</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="대여일" required>
                  <Input type="date" value={form.loanedAt} onChange={(e) => set("loanedAt", e.target.value)} />
                </Field>
                <Field label="반납예정일" required>
                  <Input type="date" value={form.dueAt} onChange={(e) => set("dueAt", e.target.value)} />
                </Field>
                <Field label="대여 확인자" hint="처리 담당자">
                  <Input value={form.lendBy} onChange={(e) => set("lendBy", e.target.value)} placeholder="담당자 이름" />
                </Field>
              </div>
            </section>

            {/* ③ 대여자 정보 */}
            <section>
              <SectionTitle n={3}>대여자 정보 <span className="ml-1 text-xs font-normal text-muted-foreground">선택한 물품 전체에 공통 적용</span></SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="대여자" required>
                  <Input value={form.borrower} onChange={(e) => set("borrower", e.target.value)} placeholder="홍길동" />
                </Field>
                <Field label="학번/사번">
                  <Input value={form.idNo} onChange={(e) => set("idNo", e.target.value)} placeholder="202412345 / S2024..." />
                </Field>
                <Field label="소속">
                  <Input value={form.affiliation} onChange={(e) => set("affiliation", e.target.value)} placeholder="데이터보안학과" />
                </Field>
                <Field label="연락처">
                  <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="010-0000-0000" />
                </Field>
                <Field label="사유" className="lg:col-span-2">
                  <Input value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="현장 조사" />
                </Field>
                <Field label="대여자 서명" hint="직접 그리기" className="sm:col-span-2 lg:col-span-3">
                  <SignaturePad value={form.signature} onChange={(v) => set("signature", v)} />
                </Field>
              </div>
            </section>

            {error && <p className="text-sm text-pastel-coralInk">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setOpen(false); setError(""); }}>취소</Button>
              <Button type="submit" disabled={busy === "new"}>
                {busy === "new" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {selected.length > 1 ? `${selected.length}건 대여 등록` : "대여 등록"}
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
          <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="학번·이름·품명·관리번호 검색" />
        </div>
      </div>

      {/* 다건 반납 바 */}
      {checked.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-pastel-mint/40 px-4 py-3 ring-1 ring-black/[0.04]">
          <span className="text-sm font-semibold text-foreground">선택 {checked.size}건 반납</span>
          <Input value={bulkBy} onChange={(e) => setBulkBy(e.target.value)} placeholder="반납 확인자" className="h-9 w-40" />
          <Button size="sm" disabled={busy === "bulk"} onClick={doBulkReturn}>
            {busy === "bulk" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}선택 반납
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())}>선택 해제</Button>
        </div>
      )}

      {error && !open && <p className="mb-3 text-sm text-pastel-coralInk">{error}</p>}

      <SoftCard padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-left text-xs text-muted-foreground">
                <th className="w-10 px-4 py-3">
                  {checkableIds.length > 0 && (
                    <input type="checkbox" checked={checked.size === checkableIds.length} onChange={toggleAll} className="h-4 w-4 cursor-pointer accent-primary" title="전체 선택" />
                  )}
                </th>
                <th className="px-5 py-3 font-medium">관리번호</th>
                <th className="px-5 py-3 font-medium">품명</th>
                <th className="px-5 py-3 font-medium">대여자</th>
                <th className="px-5 py-3 font-medium">학번/사번</th>
                <th className="px-5 py-3 font-medium">반납예정</th>
                <th className="px-5 py-3 font-medium">D-day</th>
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
                const returned = l.status === "반납완료";
                const dd = returned ? null : dday(l.dueAt);
                const rowTint = dd?.over ? "bg-pastel-coral/20" : dd?.near ? "bg-pastel-apricot/30" : "";
                const isChecked = !!l.id && checked.has(l.id);
                return (
                  <tr key={(l.id || l.mgmtNo) + l.borrower + l.loanedAt} className={"border-b border-black/[0.04] hover:bg-accent/60 " + rowTint}>
                    <td className="px-4 py-3">
                      {!returned && l.id && (
                        <input type="checkbox" checked={isChecked} onChange={() => toggleCheck(l.id as string)} className="h-4 w-4 cursor-pointer accent-primary" />
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-[13px] text-foreground/80">{l.mgmtNo}</td>
                    <td className="px-5 py-3 font-medium text-foreground">{l.itemName}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-foreground/80">{l.borrower}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{l.idNo || "—"}</td>
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums text-muted-foreground">{l.dueAt}</td>
                    <td className="px-5 py-3">
                      {returned ? <span className="text-xs text-muted-foreground">반납 {l.returnedAt}</span>
                        : <StatusBadge label={dd!.label} tone={dd!.tone} />}
                    </td>
                    <td className="px-5 py-3"><StatusBadge label={l.status} tone={statusTone(l.status)} /></td>
                    <td className="px-5 py-3">
                      {returnId === l.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Input autoFocus value={returnBy} onChange={(e) => setReturnBy(e.target.value)} placeholder="반납 확인자" className="h-9 w-32" />
                          <Button size="sm" disabled={rowBusy} onClick={() => doReturn(l)}>
                            {rowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}확인
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setReturnId(""); setReturnBy(""); }}>취소</Button>
                        </div>
                      ) : confirmId === l.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" variant="destructive" disabled={rowBusy} onClick={() => doDelete(l)}>삭제</Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmId("")}>취소</Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          {!returned && (
                            <Button size="sm" variant="outline" disabled={!l.id} onClick={() => { setReturnId(l.id || ""); setReturnBy(""); setError(""); }} title="반납 처리">
                              <Undo2 className="h-4 w-4" /> 반납
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" disabled={!l.id} onClick={() => setConfirmId(l.id || "")} title="삭제">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
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
