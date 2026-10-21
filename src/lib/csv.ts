// CSV / 붙여넣기(TSV) 파서 + CSV 생성. 전부 브라우저에서 처리.
// 엑셀에서 셀 복사→붙여넣기(탭 구분)와 CSV 파일 업로드를 모두 지원한다.

export interface Table {
  headers: string[];
  rows: Record<string, string>[];
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  if (tabs >= commas && tabs >= semis) return "\t";
  if (semis > commas) return ";";
  return ",";
}

function parseMatrix(text: string, d: string): string[][] {
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === d) { row.push(field); field = ""; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += c;
  }
  row.push(field);
  rows.push(row);
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

export function parseTable(text: string): Table {
  const trimmed = text.replace(/^﻿/, "").trim();
  if (!trimmed) return { headers: [], rows: [] };
  const matrix = parseMatrix(trimmed, detectDelimiter(trimmed));
  if (matrix.length === 0) return { headers: [], rows: [] };
  const headers = matrix[0].map((h, i) => h.trim() || `열${i + 1}`);
  const rows = matrix.slice(1).map((cells) => {
    const o: Record<string, string> = {};
    headers.forEach((h, idx) => { o[h] = (cells[idx] ?? "").trim(); });
    return o;
  });
  return { headers, rows };
}

/** 업로드 파일 → 문자열. UTF-8 우선, 깨지면 EUC-KR(CP949, 엑셀 한글 CSV) 재시도. */
export async function readFileSmart(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  const bad = (utf8.match(/�/g) || []).length;
  if (bad > 2) {
    try {
      return new TextDecoder("euc-kr").decode(buf);
    } catch {
      return utf8;
    }
  }
  return utf8;
}

const CSV_ESC = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(headers: string[], rows: Record<string, string | number>[]): string {
  const lines = [headers.map(CSV_ESC).join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => CSV_ESC(String(r[h] ?? ""))).join(","));
  }
  return "﻿" + lines.join("\r\n"); // BOM: 엑셀에서 한글 깨짐 방지
}

/** 브라우저에서 CSV 다운로드(배포된 실제 웹앱에서 동작). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 금액 문자열 → 숫자. */
export function toAmount(v: string | undefined): number {
  const x = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(x) ? x : 0;
}

/** 헤더 후보 중 정규식에 맞는 첫 열 이름. */
export function guessColumn(headers: string[], re: RegExp): string {
  return headers.find((h) => re.test(h)) ?? "";
}
