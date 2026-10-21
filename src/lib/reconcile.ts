// 자산 대사 로직 — ERP 구매내역 ↔ 담당자 자산목록을 '지출문서번호'로 묶어 비교.
// 한 문서번호에 여러 품목이 있을 수 있으므로 키별로 건수·금액 합계를 비교한다.
import { toAmount, type Table } from "./csv";

export interface SideCols {
  key: string;        // 지출문서번호 열 (필수)
  amount?: string;    // 금액 열 (선택)
  name?: string;      // 품명 열 (선택)
}

export interface KeyStat {
  key: string;
  erpCount: number;
  listCount: number;
  erpSum: number;
  listSum: number;
  erpName: string;
  listName: string;
  countDiff: boolean;
  sumDiff: boolean;
}

export interface ReconResult {
  matchedOk: KeyStat[];
  onlyErp: KeyStat[];
  onlyList: KeyStat[];
  mismatched: KeyStat[];
  hasAmount: boolean;
  totalErp: number;
  totalList: number;
}

const normKey = (v: string) => (v ?? "").replace(/\s+/g, "").trim();

function groupByKey(rows: Record<string, string>[], key: string): Map<string, Record<string, string>[]> {
  const m = new Map<string, Record<string, string>[]>();
  for (const r of rows) {
    const k = normKey(r[key]);
    if (!k) continue;
    const arr = m.get(k);
    if (arr) arr.push(r);
    else m.set(k, [r]);
  }
  return m;
}

export function reconcile(erp: Table, list: Table, erpCols: SideCols, listCols: SideCols): ReconResult {
  const hasAmount = !!(erpCols.amount && listCols.amount);
  const eg = groupByKey(erp.rows, erpCols.key);
  const lg = groupByKey(list.rows, listCols.key);
  const keys = new Set<string>([...eg.keys(), ...lg.keys()]);

  const onlyErp: KeyStat[] = [];
  const onlyList: KeyStat[] = [];
  const matchedOk: KeyStat[] = [];
  const mismatched: KeyStat[] = [];

  for (const k of keys) {
    const er = eg.get(k) ?? [];
    const lr = lg.get(k) ?? [];
    const stat: KeyStat = {
      key: k,
      erpCount: er.length,
      listCount: lr.length,
      erpSum: erpCols.amount ? er.reduce((s, r) => s + toAmount(r[erpCols.amount!]), 0) : 0,
      listSum: listCols.amount ? lr.reduce((s, r) => s + toAmount(r[listCols.amount!]), 0) : 0,
      erpName: erpCols.name && er[0] ? er[0][erpCols.name] ?? "" : "",
      listName: listCols.name && lr[0] ? lr[0][listCols.name] ?? "" : "",
      countDiff: false,
      sumDiff: false,
    };

    if (er.length && !lr.length) { onlyErp.push(stat); continue; }
    if (!er.length && lr.length) { onlyList.push(stat); continue; }

    stat.countDiff = er.length !== lr.length;
    stat.sumDiff = hasAmount && Math.round(stat.erpSum) !== Math.round(stat.listSum);
    if (stat.countDiff || stat.sumDiff) mismatched.push(stat);
    else matchedOk.push(stat);
  }

  const byKey = (a: KeyStat, b: KeyStat) => a.key.localeCompare(b.key, "ko");
  return {
    matchedOk: matchedOk.sort(byKey),
    onlyErp: onlyErp.sort(byKey),
    onlyList: onlyList.sort(byKey),
    mismatched: mismatched.sort(byKey),
    hasAmount,
    totalErp: eg.size,
    totalList: lg.size,
  };
}
