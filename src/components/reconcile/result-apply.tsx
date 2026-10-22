"use client";

import * as React from "react";
import { FileUp, Download, UploadCloud, CheckCircle2, Loader2, Info } from "lucide-react";
import { SoftCard } from "@/components/cards/soft-card";
import { StatusBadge } from "@/components/badges/status-badge";
import { Button } from "@/components/ui/button";
import { parseTable, readFileSmart, toCsv, downloadCsv } from "@/lib/csv";
import {
  draftsFromDaesa, looksLikeDaesa, isActionable, draftToAssetInput,
  draftToCsvRow, LEDGER_CSV_HEADERS, type Draft,
} from "@/lib/ledger";
import { ASSET_STATUS_OPTIONS } from "@/data/map";
import { applyLedgerAction } from "@/app/assets/actions";
import type { Tone } from "@/lib/status";

const cell =
  "w-full min-w-[80px] rounded-lg bg-card px-2 py-1 text-[13px] ring-1 ring-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
const won = (s: string) => {
  const n = Number(String(s).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n ? "₩" + n.toLocaleString("ko-KR") : "";
};

export function ResultApply() {
  const [text, setText] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [drafts, setDrafts] = React.useState<Draft[]>([]);
  const [invalid, setInvalid] = React.useState(false);
  const [onlyAction, setOnlyAction] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: number; fail: number; error?: string } | null>(null);

  function load(raw: string, name = "") {
    const t = parseTable(raw);
    setFileName(name);
    if (!t.headers.length || !looksLikeDaesa(t.headers)) {
      setDrafts([]); setInvalid(!!raw.trim()); return;
    }
    setInvalid(false);
    setDrafts(draftsFromDaesa(t));
    setResult(null);
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const raw = await readFileSmart(f);
    setText(raw);
    load(raw, f.name);
  }

  function update(id: string, patch: Partial<Draft>) {
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  const loaded = drafts.length > 0;
  const included = drafts.filter((d) => d.include);
  const visible = onlyAction ? drafts.filter((d) => isActionable(d.detail)) : drafts;

  // 세부 구분별 그룹 (조치 필요 → 보류 → 참고/일치 순)
  const groups = React.useMemo(() => {
    const map = new Map<string, Draft[]>();
    for (const d of visible) {
      const key = `${d.group} · ${d.detail || "-"}`;
      (map.get(key) ?? map.set(key, []).get(key)!).push(d);
    }
    const rank = (k: string) => (/(누락|미확인|불일치|오기)/.test(k) ? 0 : /보류/.test(k) ? 1 : 2);
    return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [visible]);

  async function apply() {
    if (!included.length) return;
    setBusy(true); setResult(null);
    const res = await applyLedgerAction(included.map(draftToAssetInput));
    setBusy(false); setResult(res);
  }
  function exportCsv() {
    const rows = included.map(draftToCsvRow);
    downloadCsv("관리대장_반영본.csv", toCsv(LEDGER_CSV_HEADERS, rows));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 1단계 */}
      <StepCard n={1} title="대사 결과 불러오기" done={loaded}>
        <p className="mb-3 text-sm text-muted-foreground">
          로컬에서 만든 대사 결과 파일(예: <span className="font-mono text-xs">자산대사_전체.csv</span>)을 올리거나,
          표를 복사해 붙여넣으세요.
        </p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-card px-3 py-2 text-sm shadow-soft ring-1 ring-black/[0.06] hover:bg-accent">
          <FileUp className="h-4 w-4" /> 결과 파일 선택 (CSV)
          <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={onFile} />
        </label>
        {fileName && <span className="ml-2 text-xs text-muted-foreground">{fileName}</span>}
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); load(e.target.value); }}
          placeholder="또는 대사 결과 표(머리글 포함)를 복사해 붙여넣기…"
          className="mt-2 h-20 w-full resize-y rounded-2xl border-0 bg-card p-3 font-mono text-xs shadow-soft ring-1 ring-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        />
        {invalid && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-pastel-coralInk">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            대사 결과 형식이 아닙니다. ‘구분·세부’와 ‘A …/B …’ 열이 있는 파일(자산대사_전체.csv 등)을 올려주세요.
          </p>
        )}
        {loaded && <div className="mt-3"><StatusBadge label={`${drafts.length}행 인식됨`} tone="mint" /></div>}
      </StepCard>

      {/* 2단계 */}
      {loaded && (
        <StepCard n={2} title="조치 항목 검토·수정" done={false}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Seg value={onlyAction} onChange={setOnlyAction} />
            <span className="text-sm text-muted-foreground">
              표시 {visible.length}건 · 반영 포함 <b className="text-foreground">{included.length}</b>건
            </span>
            <div className="ml-auto flex gap-2">
              <button type="button" className="text-xs text-primary hover:underline"
                onClick={() => setDrafts((ds) => ds.map((d) => (visible.includes(d) ? { ...d, include: true } : d)))}>
                보이는 항목 전체 포함
              </button>
              <button type="button" className="text-xs text-muted-foreground hover:underline"
                onClick={() => setDrafts((ds) => ds.map((d) => (visible.includes(d) ? { ...d, include: false } : d)))}>
                전체 해제
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-2 py-2 font-medium">반영</th>
                  <th className="px-2 py-2 font-medium">품명</th>
                  <th className="px-2 py-2 font-medium">태그번호</th>
                  <th className="px-2 py-2 font-medium">단가</th>
                  <th className="px-2 py-2 font-medium">취득일</th>
                  <th className="px-2 py-2 font-medium">위치</th>
                  <th className="px-2 py-2 font-medium">상태</th>
                  <th className="px-2 py-2 font-medium">메모</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(([key, rows]) => (
                  <React.Fragment key={key}>
                    <tr>
                      <td colSpan={8} className="pt-4">
                        <div className="flex items-center gap-2">
                          <StatusBadge label={key} tone={groupTone(key)} />
                          <span className="text-xs text-muted-foreground">{rows.length}건</span>
                        </div>
                      </td>
                    </tr>
                    {rows.map((d) => (
                      <tr key={d.id} className="border-b border-black/[0.04] align-top">
                        <td className="px-2 py-1.5">
                          <input type="checkbox" checked={d.include} onChange={(e) => update(d.id, { include: e.target.checked })}
                            className="h-4 w-4 accent-[color:var(--primary,#5f8f79)]" />
                        </td>
                        <td className="px-2 py-1.5 min-w-[160px]"><input className={cell} value={d.itemName} onChange={(e) => update(d.id, { itemName: e.target.value })} /></td>
                        <td className="px-2 py-1.5"><input className={`${cell} font-mono`} value={d.tagNo} onChange={(e) => update(d.id, { tagNo: e.target.value })} /></td>
                        <td className="px-2 py-1.5"><input className={`${cell} text-right tabular-nums`} value={d.unitPrice} onChange={(e) => update(d.id, { unitPrice: e.target.value })} title={won(d.unitPrice)} /></td>
                        <td className="px-2 py-1.5"><input className={cell} value={d.acquiredAt} onChange={(e) => update(d.id, { acquiredAt: e.target.value })} /></td>
                        <td className="px-2 py-1.5 min-w-[140px]"><input className={cell} value={d.location} onChange={(e) => update(d.id, { location: e.target.value })} /></td>
                        <td className="px-2 py-1.5">
                          <select className={cell} value={d.status} onChange={(e) => update(d.id, { status: e.target.value })}>
                            {ASSET_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5 min-w-[200px]"><input className={cell} value={d.note} onChange={(e) => update(d.id, { note: e.target.value })} /></td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                {visible.length === 0 && (
                  <tr><td colSpan={8} className="px-2 py-8 text-center text-muted-foreground">표시할 항목이 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </StepCard>
      )}

      {/* 3단계 */}
      {loaded && (
        <StepCard n={3} title="관리대장에 반영" done={!!result && result.fail === 0}>
          <p className="mb-3 text-sm text-muted-foreground">
            ‘반영’에 체크한 <b className="text-foreground">{included.length}건</b>을 관리대장(앱 자산 시트)에 등록합니다.
태그번호·규격은 전용 열로, 구분·메모는 메모 열에 저장됩니다. 교정본을 파일로도 받을 수 있어요.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={apply} disabled={busy || included.length === 0}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              관리대장에 {included.length}건 반영
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={included.length === 0}>
              <Download className="h-4 w-4" /> 교정 CSV 내보내기
            </Button>
          </div>
          {included.length > 40 && !busy && (
            <p className="mt-2 text-xs text-muted-foreground">※ 건수가 많으면 반영에 시간이 걸릴 수 있습니다(한 건씩 저장).</p>
          )}
          {result && (
            <div className={`mt-3 flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm ${result.fail === 0 ? "bg-pastel-mint/60 text-pastel-mintInk" : "bg-pastel-apricot/60 text-pastel-apricotInk"}`}>
              <CheckCircle2 className="h-4 w-4" />
              반영 완료 — 성공 {result.ok}건{result.fail ? ` · 실패 ${result.fail}건` : ""}
              {result.error ? ` (${result.error})` : ""}
            </div>
          )}
        </StepCard>
      )}
    </div>
  );
}

function StepCard({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <SoftCard>
      <div className="mb-3 flex items-center gap-2.5">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${done ? "bg-brand-500 text-white" : "bg-pastel-mint text-pastel-mintInk"}`}>
          {done ? "✓" : n}
        </span>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </SoftCard>
  );
}

function Seg({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="inline-flex rounded-xl bg-card p-0.5 shadow-soft ring-1 ring-black/[0.06]">
      {[["조치 필요만", true], ["전체", false]].map(([label, v]) => (
        <button key={label as string} type="button" onClick={() => onChange(v as boolean)}
          className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${value === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          {label as string}
        </button>
      ))}
    </div>
  );
}

function groupTone(key: string): Tone {
  if (/불일치|오기/.test(key)) return "coral";
  if (/누락/.test(key)) return "apricot";
  if (/미확인/.test(key)) return "sky";
  if (/보류/.test(key)) return "cream";
  if (/일치/.test(key)) return "mint";
  return "slate";
}
