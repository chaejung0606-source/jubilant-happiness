"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Boxes, Search, Plus, Download, X, Check, Loader2, Pencil, Trash2, Eye } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SoftCard } from "@/components/cards/soft-card";
import { StatusBadge } from "@/components/badges/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/ui/form-controls";
import { ASSET_STATUS_OPTIONS } from "@/data/map";
import { createAssetAction, updateAssetAction, deleteAssetAction } from "@/app/assets/actions";
import { toCsv, downloadCsv } from "@/lib/csv";
import { diffSummary, ASSET_DIFF_FIELDS, todayKst } from "@/lib/diff";
import type { AssetRow } from "@/lib/dummy";
import { won } from "@/lib/dummy";

const EMPTY = {
  mgmtNo: "", tagNo: "", spec: "", itemName: "", category: "", status: "정상",
  user: "", location: "", unitPrice: "", acquiredAt: "", memo: "", reason: "",
};
type Form = typeof EMPTY;

function rowToForm(a: AssetRow): Form {
  return {
    mgmtNo: a.mgmtNo, tagNo: a.tagNo ?? "", spec: a.spec ?? "", itemName: a.itemName,
    category: a.category, status: a.status, user: a.user ?? "", location: a.location,
    unitPrice: a.unitPrice ? String(a.unitPrice) : "", acquiredAt: a.acquiredAt, memo: a.memo ?? "", reason: "",
  };
}
function formToInput(f: Form) {
  return {
    mgmtNo: f.mgmtNo.trim(), tagNo: f.tagNo.trim(), spec: f.spec.trim(),
    itemName: f.itemName.trim(), category: f.category.trim(), status: f.status,
    user: f.user.trim(), location: f.location.trim(),
    unitPrice: Number(String(f.unitPrice).replace(/[,\s]/g, "")) || 0,
    acquiredAt: f.acquiredAt, memo: f.memo.trim(),
  };
}

export function AssetsClient({ initial, configured }: { initial: AssetRow[]; configured: boolean }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [statusF, setStatusF] = React.useState("전체");
  const [catF, setCatF] = React.useState("전체");

  const [open, setOpen] = React.useState(false);
  const [editingRow, setEditingRow] = React.useState<AssetRow | null>(null);
  const [form, setForm] = React.useState<Form>({ ...EMPTY });
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<AssetRow | null>(null);

  const categories = React.useMemo(
    () => Array.from(new Set(initial.map((a) => a.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ko")),
    [initial]
  );

  const rows = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return initial.filter((a) => {
      if (statusF !== "전체" && a.status !== statusF) return false;
      if (catF !== "전체" && a.category !== catF) return false;
      if (!term) return true;
      return [a.mgmtNo, a.tagNo ?? "", a.itemName, a.spec ?? "", a.category, a.user ?? "", a.location, a.status]
        .join(" ").toLowerCase().includes(term);
    });
  }, [q, statusF, catF, initial]);

  function set<K extends keyof Form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }
  function openCreate() { setEditingRow(null); setForm({ ...EMPTY }); setError(null); setOpen(true); }
  function openEdit(a: AssetRow) { setEditingRow(a); setForm(rowToForm(a)); setError(null); setOpen(true); setDetail(null); }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setPending(true);
    const input = formToInput(form);
    let res;
    if (editingRow?.id) {
      const detail = diffSummary(formToInput(rowToForm(editingRow)), input, ASSET_DIFF_FIELDS);
      const reason = form.reason.trim();
      res = await updateAssetAction(editingRow.id, {
        ...input, editReason: reason, editDetail: detail, editedAt: (detail || reason) ? todayKst() : "",
      });
    } else {
      res = await createAssetAction(input);
    }
    setPending(false);
    if (res.ok) { setForm({ ...EMPTY }); setOpen(false); setEditingRow(null); router.refresh(); }
    else setError(res.error ?? "저장에 실패했습니다.");
  }

  async function doDelete(id: string) {
    setError(null); setPending(true);
    const res = await deleteAssetAction(id);
    setPending(false); setDeletingId(null);
    if (res.ok) { setDetail(null); router.refresh(); } else setError(res.error ?? "삭제에 실패했습니다.");
  }

  function exportCsv() {
    const headers = ["관리번호", "태그번호", "품명", "규격", "분류", "상태", "사용자", "장소", "취득단가", "취득일", "메모"];
    const data = rows.map((a) => ({
      관리번호: a.mgmtNo, 태그번호: a.tagNo ?? "", 품명: a.itemName, 규격: a.spec ?? "",
      분류: a.category, 상태: a.status, 사용자: a.user ?? "", 장소: a.location,
      취득단가: a.unitPrice, 취득일: a.acquiredAt, 메모: a.memo ?? "",
    }));
    downloadCsv("자산목록.csv", toCsv(headers, data));
  }

  return (
    <>
      <PageHeader
        title="자산"
        description="사업단 자산 원장"
        icon={<Boxes className="h-6 w-6" />}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="h-4 w-4" /> 내보내기
            </Button>
            <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> 자산 등록</Button>
          </>
        }
      />

      {open && (
        <SoftCard className="mb-4">
          <form onSubmit={submit}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">{editingRow ? "자산 수정" : "새 자산 등록"}</h3>
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
              <Field label="자산태그번호"><Input value={form.tagNo} onChange={(e) => set("tagNo", e.target.value)} placeholder="KKR-PB-… (번호로 관리)" /></Field>
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
              <Field label="메모" className="sm:col-span-2 lg:col-span-3">
                <Input value={form.memo} onChange={(e) => set("memo", e.target.value)} placeholder="비고" />
              </Field>
              {editingRow && (
                <Field label="수정사유" className="sm:col-span-2 lg:col-span-3">
                  <Input value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="무엇을 왜 고쳤는지 (변경 전→후는 자동 기록)" />
                </Field>
              )}
            </div>
            {error && <p className="mt-3 text-sm text-pastel-coralInk">{error}</p>}
            <div className="mt-4 flex items-center gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {editingRow ? "수정 저장" : "저장"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>취소</Button>
            </div>
          </form>
        </SoftCard>
      )}

      {/* 검색 + 필터 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="관리번호·태그번호·품명·규격 검색" className="pl-9" />
        </div>
        <NativeSelect value={statusF} onChange={(e) => setStatusF(e.target.value)} className="h-11 w-auto">
          <option value="전체">상태 전체</option>
          {ASSET_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </NativeSelect>
        <NativeSelect value={catF} onChange={(e) => setCatF(e.target.value)} className="h-11 w-auto">
          <option value="전체">분류 전체</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </NativeSelect>
        <span className="whitespace-nowrap text-sm text-muted-foreground">{rows.length}건</span>
      </div>

      {error && !open && <p className="mb-3 text-sm text-pastel-coralInk">{error}</p>}

      <SoftCard padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">관리번호</th>
                <th className="px-5 py-3 font-medium">태그번호</th>
                <th className="px-5 py-3 font-medium">품명</th>
                <th className="px-5 py-3 font-medium">규격</th>
                <th className="px-5 py-3 font-medium">상태</th>
                <th className="px-5 py-3 font-medium">사용자</th>
                <th className="px-5 py-3 font-medium">장소</th>
                <th className="px-5 py-3 text-right font-medium">취득단가</th>
                <th className="px-5 py-3 font-medium">취득일</th>
                <th className="px-5 py-3 text-right font-medium">작업</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => (
                <tr key={a.id ?? a.mgmtNo + i} className="border-b border-black/[0.04] transition-colors hover:bg-accent/60">
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-[13px] text-foreground/80">{a.mgmtNo}</td>
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-[12px] text-muted-foreground">{a.tagNo || "—"}</td>
                  <td className="px-5 py-3 font-medium text-foreground">
                    <button type="button" className="text-left hover:text-primary hover:underline" onClick={() => setDetail(a)}>{a.itemName}</button>
                    {a.editReason && <span title={a.editDetail || a.editReason} className="ml-1.5 whitespace-nowrap text-[11px] text-pastel-apricotInk">✎수정</span>}
                  </td>
                  <td className="max-w-[200px] truncate px-5 py-3 text-muted-foreground" title={a.spec || ""}>{a.spec || "—"}</td>
                  <td className="px-5 py-3"><StatusBadge label={a.status} tone={a.statusTone} /></td>
                  <td className="whitespace-nowrap px-5 py-3 text-foreground/80">{a.user ?? "—"}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{a.location}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-foreground/90">{won(a.unitPrice)}</td>
                  <td className="whitespace-nowrap px-5 py-3 tabular-nums text-muted-foreground">{a.acquiredAt}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right">
                    {deletingId === a.id ? (
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="text-pastel-coralInk">삭제?</span>
                        <button type="button" disabled={pending} onClick={() => a.id && doDelete(a.id)} className="rounded-lg bg-pastel-coral px-2 py-1 font-semibold text-pastel-coralInk">예</button>
                        <button type="button" onClick={() => setDeletingId(null)} className="rounded-lg px-2 py-1 text-muted-foreground hover:bg-accent">아니오</button>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <IconBtn label="상세" onClick={() => setDetail(a)}><Eye className="h-4 w-4" /></IconBtn>
                        {a.id && <IconBtn label="수정" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></IconBtn>}
                        {a.id && <IconBtn label="삭제" danger onClick={() => setDeletingId(a.id!)}><Trash2 className="h-4 w-4" /></IconBtn>}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={10} className="px-5 py-10 text-center text-muted-foreground">조건에 맞는 자산이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SoftCard>

      {detail && <DetailModal a={detail} onClose={() => setDetail(null)} onEdit={() => openEdit(detail)} />}
    </>
  );
}

function IconBtn({ children, label, onClick, danger }: { children: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className={`grid h-8 w-8 place-items-center rounded-lg hover:bg-accent ${danger ? "text-pastel-coralInk" : "text-muted-foreground hover:text-foreground"}`}>
      {children}
    </button>
  );
}

function DetailModal({ a, onClose, onEdit }: { a: AssetRow; onClose: () => void; onEdit: () => void }) {
  const rows: [string, React.ReactNode][] = [
    ["관리번호", a.mgmtNo], ["자산태그번호", a.tagNo || "—"], ["품명", a.itemName], ["규격", a.spec || "—"],
    ["분류", a.category || "—"], ["상태", <StatusBadge key="s" label={a.status} tone={a.statusTone} />],
    ["사용자", a.user ?? "—"], ["장소", a.location || "—"], ["취득단가", won(a.unitPrice)], ["취득일", a.acquiredAt || "—"],
    ["메모", a.memo || "—"],
  ];
  if (a.editReason || a.editDetail || a.editedAt) {
    rows.push(
      ["수정일", a.editedAt || "—"],
      ["수정사유", a.editReason || "—"],
      ["변경내역", a.editDetail || "—"],
    );
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-lg rounded-card bg-card p-6 shadow-soft-lg animate-fade-in-up">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">자산 상세</h3>
          <button type="button" onClick={onClose} aria-label="닫기" className="grid h-8 w-8 place-items-center rounded-xl text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2.5 text-sm">
          {rows.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="min-w-0 break-words text-foreground">{v}</dd>
            </React.Fragment>
          ))}
        </dl>
        <div className="mt-5 flex justify-end gap-2">
          {a.id && <Button size="sm" onClick={onEdit}><Pencil className="h-4 w-4" /> 수정</Button>}
          <Button variant="ghost" size="sm" onClick={onClose}>닫기</Button>
        </div>
      </div>
    </div>
  );
}
