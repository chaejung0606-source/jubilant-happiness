// 로컬 세션에서 만든 자산대사 결과 CSV를 자산관리 사이트(Google Sheets)에 반영.
//
// 사용:
//   node --experimental-strip-types scripts/apply-daesa.mts <결과CSV> [옵션]
//   npm run apply:daesa -- <결과CSV> [옵션]
//
// 옵션:
//   (기본)           자산번호가 있는 등재 자산만(보류 제외) — 겹침 없는 완전한 대장
//   --actionable     조치 필요 항목만(누락/미확인/불일치/오기)
//   --all            일치/참고/보류까지 전부
//   --chaebun        'A에만 있음'(정리본 누락) 신규 항목에 사업단 관리번호를 채번해 추가
//                    ※ src/lib/mgmtno.ts 의 MGMTNO_CONFIG 가 채워져야 실제 반영 가능
//   --commit         실제 반영(없으면 미리보기 dry-run)
//   --update         이미 있는 자산번호도 덮어씀(기본: 건너뜀)
//   --reason "사유"  수정사유 일괄 지정
//
// 환경변수(.env.local 또는 셸): SHEETS_API_URL, SHEETS_API_TOKEN (사이트와 동일)
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assignMgmtNos, MGMTNO_CONFIG } from "../src/lib/mgmtno.ts";

const here = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  try {
    const txt = readFileSync(path.join(process.cwd(), ".env.local"), "utf-8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  } catch { /* .env.local 없으면 셸 환경변수만 사용 */ }
  return env;
}

function readCsv(file: string) {
  const buf = readFileSync(file);
  let txt = new TextDecoder("utf-8").decode(buf);
  if ((txt.match(/�/g) || []).length > 2) {
    try { txt = new TextDecoder("euc-kr").decode(buf); } catch { /* keep utf-8 */ }
  }
  return txt.replace(/^﻿/, "");
}

function parseTable(text: string) {
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!s) return { headers: [] as string[], rows: [] as Record<string, string>[] };
  const first = s.split("\n", 1)[0] ?? "";
  const d = (first.match(/\t/g) || []).length >= (first.match(/,/g) || []).length ? "\t" : ",";
  const matrix: string[][] = [];
  let row: string[] = [], field = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === d) { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); matrix.push(row); row = []; field = ""; }
    else field += c;
  }
  row.push(field); matrix.push(row);
  const headers = matrix[0].map((h) => h.trim());
  const rows = matrix.slice(1)
    .filter((r) => !(r.length === 1 && r[0].trim() === ""))
    .map((cells) => Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? "").trim()])));
  return { headers, rows };
}

const pick = (r: Record<string, string>, ...keys: string[]) => { for (const k of keys) { const v = (r[k] ?? "").trim(); if (v) return v; } return ""; };
const isActionable = (detail: string) => /누락|미확인|불일치|오기/.test(detail);

interface Asset {
  mgmtNo: string; tagNo: string; itemName: string; spec: string; category: string;
  status: string; user: string; location: string; unitPrice: number; acquiredAt: string;
  memo: string; editReason: string; editDetail: string; editedAt: string;
  _detail: string; _group: string; _hasAssetNo: boolean; _schoolNo: string;
}

function toAsset(r: Record<string, string>, reason: string): Asset {
  const group = pick(r, "구분"), detail = pick(r, "세부");
  const assetNo = pick(r, "A 자산번호", "자산번호");
  return {
    mgmtNo: assetNo || pick(r, "B 지출문서", "지출문서"),
    tagNo: pick(r, "A RFID", "B RFID", "RFID", "태그번호", "자산태그번호"),
    itemName: pick(r, "A 품명", "B 품명", "품명"),
    spec: pick(r, "A 품목명", "B 규격", "품목명", "규격"),
    category: "",
    status: "정상",
    user: pick(r, "B 사용처", "사용처", "사용자"),
    location: pick(r, "A 사용위치", "B 위치", "사용위치", "위치"),
    unitPrice: Number(pick(r, "A 단가", "B 단가", "단가").replace(/[^\d.-]/g, "")) || 0,
    acquiredAt: pick(r, "A 취득일", "B 취득일", "취득일"),
    memo: [(group || detail) && `[${group}·${detail}]`, pick(r, "메모")].filter(Boolean).join(" / "),
    editReason: reason || "",
    editDetail: "",
    editedAt: reason ? new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10) : "",
    _detail: detail,
    _group: group,
    _hasAssetNo: !!assetNo,
    _schoolNo: assetNo,
  };
}

async function sheetGet(base: string, token: string, tab: string) {
  const res = await fetch(`${base}?token=${encodeURIComponent(token)}&tab=${encodeURIComponent(tab)}`);
  if (!res.ok) throw new Error(`GET ${tab} HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(data?.error || "시트 응답 오류");
  return data as Record<string, string>[];
}
async function sheetPost(base: string, token: string, body: Record<string, unknown>) {
  const res = await fetch(base, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) throw new Error(data?.error || `POST HTTP ${res.status}`);
  return data;
}

// 'A에만 있음'(정리본 누락) 신규 항목에 사업단 관리번호를 채번.
// 기존 대장 항목은 여기에 들어오지 않는다(신규만) → 스티커 붙은 번호는 안전.
function runChaebun(items: Asset[]) {
  const targets = items.filter((a) => a._group === "A에만 있음");
  const { assigned, skipped } = assignMgmtNos(
    targets.map((a) => ({ key: a._schoolNo || a.itemName, itemName: a.itemName, acquiredAt: a.acquiredAt, location: a.location })),
    MGMTNO_CONFIG,
  );
  const byKey = new Map(assigned.map((r) => [r.key, r]));
  const out: Asset[] = [];
  for (const a of targets) {
    const r = byKey.get(a._schoolNo || a.itemName);
    if (!r) continue;
    out.push({
      ...a,
      mgmtNo: r.mgmtNo, // 새 사업단 관리번호
      memo: [a.memo, a._schoolNo && `학교자산번호 ${a._schoolNo}`].filter(Boolean).join(" / "),
    });
  }
  return { out, skipped, total: targets.length };
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const commit = args.includes("--commit");
  const all = args.includes("--all");
  const actionable = args.includes("--actionable");
  const chaebun = args.includes("--chaebun");
  const update = args.includes("--update");
  const ri = args.indexOf("--reason");
  const reason = ri >= 0 ? args[ri + 1] : "";
  void here;

  if (!file) { console.error("사용: npm run apply:daesa -- <결과CSV> [--chaebun --commit --all --update --reason \"사유\"]"); process.exit(1); }

  const env = loadEnv();
  const base = env.SHEETS_API_URL, token = env.SHEETS_API_TOKEN;
  if (!base || !token) { console.error("SHEETS_API_URL / SHEETS_API_TOKEN 가 필요합니다 (.env.local 또는 환경변수)."); process.exit(1); }

  const { headers, rows } = parseTable(readCsv(file));
  if (!headers.includes("구분")) { console.error("대사 결과 형식이 아닙니다(구분/세부 열 필요)."); process.exit(1); }

  const parsed = rows.map((r) => toAsset(r, reason));

  let items: Asset[];
  let label: string;
  if (chaebun) {
    const { out, skipped, total } = runChaebun(parsed);
    items = out;
    label = `채번(누락 신규) ${out.length}/${total}건`;
    if (out.length) {
      console.log("생성된 관리번호:");
      for (const a of out) console.log(`  ${a.mgmtNo}  ${a.itemName}`);
    }
    if (skipped.length) {
      console.log(`\n채번 보류 ${skipped.length}건(분류코드 등 미확인 — 시트에 쓰지 않음):`);
      for (const s of skipped.slice(0, 20)) console.log(`  - ${s.key} — ${s.reason}`);
      console.log("  → src/lib/mgmtno.ts 의 CATEGORY_CODES 에 해당 품명 분류코드를 넣으면 채번됩니다.");
    }
    if (commit) console.log("\n주의: 생성 번호는 반드시 자산관리대장 Excel O열 수식 결과와 일치하는지 확인 후 반영하세요.");
  } else {
    items = parsed.filter((a) => a.mgmtNo);
    if (all) {
      label = "전체";
    } else if (actionable) {
      items = items.filter((a) => isActionable(a._detail));
      label = "조치 필요만";
    } else {
      items = items.filter((a) => a._hasAssetNo && a._group !== "보류");
      label = "등재자산(자산번호 있음)";
    }
  }

  console.log(`대상: ${items.length}건 (${label})  모드: ${commit ? "반영(commit)" : "미리보기(dry-run)"}`);

  const existing = await sheetGet(base, token, "assets");
  const idByKey = new Map(existing.map((e) => [String(e.mgmtNo || "").trim(), String(e.id || "")]).filter(([k]) => k));

  let appended = 0, updated = 0, skipped = 0, failed = 0;
  for (const a of items) {
    const { _detail, _group, _hasAssetNo, _schoolNo, ...payload } = a;
    void _detail; void _group; void _hasAssetNo; void _schoolNo;
    const id = idByKey.get(a.mgmtNo.trim());
    try {
      if (id) {
        if (!update) { skipped++; continue; }
        if (commit) await sheetPost(base, token, { tab: "assets", action: "update", row: { id, ...payload } });
        updated++;
      } else {
        if (commit) await sheetPost(base, token, { tab: "assets", action: "append", row: payload });
        appended++;
      }
    } catch (e) {
      failed++;
      if (failed <= 5) console.error(`  실패 ${a.mgmtNo}: ${(e as Error).message}`);
    }
  }

  console.log(`\n${commit ? "반영" : "예상"} — 추가 ${appended} · 수정 ${updated} · 건너뜀(이미있음) ${skipped}${failed ? ` · 실패 ${failed}` : ""}`);
  if (!commit) console.log("실제 반영하려면 --commit 을 붙이세요.");
}

main().catch((e) => { console.error(e); process.exit(1); });
