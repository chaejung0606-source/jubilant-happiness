"use client";

import * as React from "react";
import {
  Scale, Upload, Download, AlertTriangle, FileX, FileQuestion, CheckCircle2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SoftCard, SoftCardHeader } from "@/components/cards/soft-card";
import { StatCard } from "@/components/cards/stat-card";
import { StatusBadge } from "@/components/badges/status-badge";
import { Button } from "@/components/ui/button";
import { Field, NativeSelect } from "@/components/ui/form-controls";
import { parseTable, readFileSmart, toCsv, downloadCsv, guessColumn, type Table } from "@/lib/csv";
import { reconcile, type SideCols, type KeyStat } from "@/lib/reconcile";

const KEY_RE = /지출.?문서|문서번호|지출번호|증빙|전표|결의|품의/;
const AMT_RE = /금액|단가|가격|취득가|합계/;
const NAME_RE = /품명|품목|자산명|물품|내역|규격|품목명/;

const won = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");

export default function ReconcilePage() {
  const [erpText, setErpText] = React.useState("");
  const [listText, setListText] = React.useState("");
  const [erpCols, setErpCols] = React.useState<SideCols>({ key: "" });
  const [listCols, setListCols] = React.useState<SideCols>({ key: "" });

  const erpTable = React.useMemo(() => parseTable(erpText), [erpText]);
  const listTable = React.useMemo(() => parseTable(listText), [listText]);

  useAutoColumns(erpTable, setErpCols);
  useAutoColumns(listTable, setListCols);

  const ready = erpTable.rows.length > 0 && listTable.rows.length > 0 && !!erpCols.key && !!listCols.key;
  const result = React.useMemo(
    () => (ready ? reconcile(erpTable, listTable, erpCols, listCols) : null),
    [ready, erpTable, listTable, erpCols, listCols]
  );

  return (
    <>
      <PageHeader
        title="자산 대사"
        description="ERP 구매내역 ↔ 담당자 자산목록을 지출문서번호로 비교·분석"
        icon={<Scale className="h-6 w-6" />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SourcePanel label="ERP 구매내역" sub="ERP에서 내보낸 엑셀/CSV, 또는 표 복사→붙여넣기" tone="sky"
          text={erpText} onText={setErpText} table={erpTable} />
        <SourcePanel label="담당자 자산목록" sub="담당자가 정리한 목록(엑셀/CSV/붙여넣기)" tone="mint"
          text={listText} onText={setListText} table={listTable} />
      </div>

      {(erpTable.headers.length > 0 || listTable.headers.length > 0) && (
        <SoftCard className="mt-4">
          <SoftCardHeader title="열 매핑" description="두 목록을 짝지을 지출문서번호 열을 지정하세요. 금액·품명은 선택." />
          <div className="grid gap-5 sm:grid-cols-2">
            <ColumnMap title="ERP" headers={erpTable.headers} cols={erpCols} setCols={setErpCols} />
            <ColumnMap title="담당자 목록" headers={listTable.headers} cols={listCols} setCols={setListCols} />
          </div>
        </SoftCard>
      )}

      {!ready && (
        <SoftCard className="mt-4">
          <p className="text-sm text-muted-foreground">
            두 목록을 모두 올리고 <b className="text-foreground">지출문서번호 열</b>을 지정하면 대사 결과가 여기에 표시됩니다.
            엑셀은 <b className="text-foreground">셀을 복사해 붙여넣기</b>하거나 <b className="text-foreground">CSV로 저장</b>해 업로드하세요.
          </p>
        </SoftCard>
      )}

      {result && <Results result={result} />}
    </>
  );
}

/** 테이블 헤더가 바뀌면 열을 자동 추정(사용자가 고른 값이 유효하면 유지). */
function useAutoColumns(table: Table, setCols: React.Dispatch<React.SetStateAction<SideCols>>) {
  const sig = table.headers.join("|");
  React.useEffect(() => {
    const h = table.headers;
    if (!h.length) return;
    setCols((c) => ({
      key: c.key && h.includes(c.key) ? c.key : guessColumn(h, KEY_RE) || h[0],
      amount: c.amount && h.includes(c.amount) ? c.amount : guessColumn(h, AMT_RE) || undefined,
      name: c.name && h.includes(c.name) ? c.name : guessColumn(h, NAME_RE) || undefined,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
}

function SourcePanel({
  label, sub, tone, text, onText, table,
}: {
  label: string; sub: string; tone: "sky" | "mint";
  text: string; onText: (v: string) => void; table: Table;
}) {
  const [name, setName] = React.useState<string>("");
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setName(f.name);
    onText(await readFileSmart(f));
  }
  return (
    <SoftCard>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{label}</h3>
        {table.rows.length > 0 && <StatusBadge label={`${table.rows.length}행`} tone={tone} />}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{sub}</p>
      <label className="mb-2 inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-card px-3 py-2 text-sm shadow-soft ring-1 ring-black/[0.06] hover:bg-accent">
        <Upload className="h-4 w-4" /> 파일 선택 (CSV)
        <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={onFile} />
      </label>
      {name && <span className="ml-2 text-xs text-muted-foreground">{name}</span>}
      <textarea
        value={text}
        onChange={(e) => onText(e.target.value)}
        placeholder="또는 엑셀에서 머리글 포함 셀을 복사해 여기에 붙여넣기…"
        className="mt-2 h-28 w-full resize-y rounded-2xl border-0 bg-card p-3 font-mono text-xs shadow-soft ring-1 ring-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      />
    </SoftCard>
  );
}

function ColumnMap({
  title, headers, cols, setCols,
}: {
  title: string; headers: string[]; cols: SideCols;
  setCols: React.Dispatch<React.SetStateAction<SideCols>>;
}) {
  if (!headers.length) return <div className="text-sm text-muted-foreground">{title}: 목록을 먼저 올리세요</div>;
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-foreground/70">{title}</div>
      <Field label="지출문서번호 열" required>
        <NativeSelect value={cols.key} onChange={(e) => setCols((c) => ({ ...c, key: e.target.value }))}>
          {headers.map((h) => <option key={h} value={h}>{h}</option>)}
        </NativeSelect>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="금액 열(선택)">
          <NativeSelect value={cols.amount ?? ""} onChange={(e) => setCols((c) => ({ ...c, amount: e.target.value || undefined }))}>
            <option value="">(없음)</option>
            {headers.map((h) => <option key={h} value={h}>{h}</option>)}
          </NativeSelect>
        </Field>
        <Field label="품명 열(선택)">
          <NativeSelect value={cols.name ?? ""} onChange={(e) => setCols((c) => ({ ...c, name: e.target.value || undefined }))}>
            <option value="">(없음)</option>
            {headers.map((h) => <option key={h} value={h}>{h}</option>)}
          </NativeSelect>
        </Field>
      </div>
    </div>
  );
}

function Results({ result }: { result: ReturnType<typeof reconcile> }) {
  const hasAmount = result.hasAmount;
  const exportRows = (list: KeyStat[], side: "erp" | "list" | "both") => {
    const headers = side === "both"
      ? ["지출문서번호", "품명", "ERP건수", "목록건수", ...(hasAmount ? ["ERP금액", "목록금액", "금액차이"] : [])]
      : ["지출문서번호", "품명", "건수", ...(hasAmount ? ["금액"] : [])];
    return { headers, rows: list.map((s) => rowFor(s, side, hasAmount)) };
  };
  const doExport = (name: string, list: KeyStat[], side: "erp" | "list" | "both") => {
    const { headers, rows } = exportRows(list, side);
    downloadCsv(name, toCsv(headers, rows));
  };

  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="일치" value={`${result.matchedOk.length}건`} sub="문서 기준" icon={CheckCircle2} tone="mint" />
        <StatCard label="건수·금액 불일치" value={`${result.mismatched.length}건`} sub="확인 필요" icon={AlertTriangle} tone="coral" />
        <StatCard label="ERP에만" value={`${result.onlyErp.length}건`} sub="목록 미등록 의심" icon={FileX} tone="apricot" />
        <StatCard label="목록에만" value={`${result.onlyList.length}건`} sub="ERP 미확인" icon={FileQuestion} tone="sky" />
      </div>

      <ResultSection
        title="ERP에만 있음 — 목록 미등록 의심"
        desc="ERP 구매내역엔 있으나 담당자 목록에 없는 지출문서"
        stats={result.onlyErp} side="erp" hasAmount={hasAmount}
        onExport={() => doExport("ERP에만-미등록의심.csv", result.onlyErp, "erp")}
      />
      <ResultSection
        title="목록에만 있음 — ERP 미확인"
        desc="담당자 목록엔 있으나 ERP 구매내역에 없는 지출문서"
        stats={result.onlyList} side="list" hasAmount={hasAmount}
        onExport={() => doExport("목록에만-ERP미확인.csv", result.onlyList, "list")}
      />
      <ResultSection
        title="건수·금액 불일치"
        desc="양쪽에 있으나 품목 수 또는 금액 합계가 다른 지출문서"
        stats={result.mismatched} side="both" hasAmount={hasAmount}
        onExport={() => doExport("불일치.csv", result.mismatched, "both")}
      />
    </>
  );
}

function rowFor(s: KeyStat, side: "erp" | "list" | "both", hasAmount: boolean): Record<string, string> {
  if (side === "both") {
    return {
      지출문서번호: s.key, 품명: s.erpName || s.listName,
      ERP건수: String(s.erpCount), 목록건수: String(s.listCount),
      ...(hasAmount ? { ERP금액: String(Math.round(s.erpSum)), 목록금액: String(Math.round(s.listSum)), 금액차이: String(Math.round(s.erpSum - s.listSum)) } : {}),
    };
  }
  const count = side === "erp" ? s.erpCount : s.listCount;
  const sum = side === "erp" ? s.erpSum : s.listSum;
  const nm = side === "erp" ? s.erpName : s.listName;
  return { 지출문서번호: s.key, 품명: nm, 건수: String(count), ...(hasAmount ? { 금액: String(Math.round(sum)) } : {}) };
}

function ResultSection({
  title, desc, stats, side, hasAmount, onExport,
}: {
  title: string; desc: string; stats: KeyStat[]; side: "erp" | "list" | "both";
  hasAmount: boolean; onExport: () => void;
}) {
  return (
    <SoftCard padded={false} className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 pt-5">
        <SoftCardHeader title={<span>{title} <span className="text-muted-foreground">({stats.length})</span></span>} description={desc} className="mb-0" />
        {stats.length > 0 && (
          <Button variant="outline" size="sm" onClick={onExport}><Download className="h-4 w-4" /> CSV</Button>
        )}
      </div>
      {stats.length === 0 ? (
        <p className="px-6 py-6 text-sm text-muted-foreground">해당 없음 👍</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-left text-xs text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">지출문서번호</th>
                <th className="px-5 py-2.5 font-medium">품명</th>
                {side === "both" ? (
                  <>
                    <th className="px-5 py-2.5 text-right font-medium">건수(ERP/목록)</th>
                    {hasAmount && <th className="px-5 py-2.5 text-right font-medium">금액(ERP/목록)</th>}
                  </>
                ) : (
                  <>
                    <th className="px-5 py-2.5 text-right font-medium">건수</th>
                    {hasAmount && <th className="px-5 py-2.5 text-right font-medium">금액</th>}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {stats.slice(0, 300).map((s) => (
                <tr key={s.key} className="border-b border-black/[0.04] hover:bg-accent/60">
                  <td className="whitespace-nowrap px-5 py-2.5 font-mono text-[13px] text-foreground/80">{s.key}</td>
                  <td className="px-5 py-2.5 text-foreground">{(side === "list" ? s.listName : s.erpName) || "—"}</td>
                  {side === "both" ? (
                    <>
                      <td className="whitespace-nowrap px-5 py-2.5 text-right tabular-nums">
                        <span className={s.countDiff ? "font-semibold text-pastel-coralInk" : ""}>{s.erpCount} / {s.listCount}</span>
                      </td>
                      {hasAmount && (
                        <td className="whitespace-nowrap px-5 py-2.5 text-right tabular-nums">
                          <span className={s.sumDiff ? "font-semibold text-pastel-coralInk" : ""}>{won(s.erpSum)} / {won(s.listSum)}</span>
                        </td>
                      )}
                    </>
                  ) : (
                    <>
                      <td className="whitespace-nowrap px-5 py-2.5 text-right tabular-nums">{side === "erp" ? s.erpCount : s.listCount}</td>
                      {hasAmount && <td className="whitespace-nowrap px-5 py-2.5 text-right tabular-nums">{won(side === "erp" ? s.erpSum : s.listSum)}</td>}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {stats.length > 300 && <p className="px-5 py-3 text-xs text-muted-foreground">상위 300건만 표시 — 전체는 CSV로 내보내세요.</p>}
        </div>
      )}
    </SoftCard>
  );
}
