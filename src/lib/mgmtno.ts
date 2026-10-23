// 채번 조회표(건축물코드 238·중분류 분류코드 36)는 mgmtno-tables.ts 에 분리.
//  ※ 건축물코드는 건물 단위까지만. 호실은 location 의 호실 부분(M열)에 따로 적고 번호엔 안 들어간다.
import { BUILDING_CODES, CATEGORY_CODES } from "./mgmtno-tables";
export { BUILDING_CODES, CATEGORY_CODES };

// 사업단 자산관리번호(관리번호) 생성 규칙.
//
// 자산관리대장 Excel 의 O열 "관리번호(수식)" 을 코드로 재현한다.
//   O2: ="["&A2&"]"&TEXT(G2,"yyyymmdd")&F2&K2&N2
//
//   예) [1]202407315011B0000142
//        │   │        │  │└ N열 건축물코드(B+7, L열 장소에서 자동조회)
//        │   │        │  └ K열 번호(같은 건 안의 순번, 1~2자리·최대 46)
//        │   │        └ F열 분류코드(중분류 자동조회, 예 501=컴퓨터) — 가변 자리수
//        │   └ G열 취득일 TEXT(,"yyyymmdd")
//        └ A열 연번
//   → 501 + 1 = "5011" 처럼 붙어 보이지만 분류코드+번호가 이어진 것.
//
// ── 중요 원칙 ───────────────────────────────────────────────
// • 이미 대장에 있는 자산은 스티커가 붙어 있어 **번호를 바꾸지 않는다**.
//   채번은 오직 '누락'(학교대장엔 있으나 정리본에 없는) 신규 항목에만 한다.
// • 분류코드(F)·건축물코드(N)는 Excel 의 별도 조회표에서 자동 산출된다.
//   건축물코드는 대장에서 실제 쓰는 값을 아래에 넣어 두었고,
//   분류코드(품명→중분류)는 조회표가 있어야 정확하다 → 미확인이면 해당 건은 보류한다.

/** "2026-09-30" | "2026/09/30" | Date → "20260930" */
export function yyyymmdd(acquiredAt: string): string {
  const d = acquiredAt.replace(/[^\d]/g, "");
  if (d.length >= 8) return d.slice(0, 8);
  return "";
}

export interface MgmtNoConfig {
  /** 새로 채번할 때 시작 연번(A열). 대장 마지막 연번 +1. 확인값: 906 → 907. */
  nextYeonbeon: number;
  buildingCodes: Record<string, string>;
  categoryCodes: Record<string, string>;
}

export const MGMTNO_CONFIG: MgmtNoConfig = {
  nextYeonbeon: 916, // 대장 최대 연번 915 다음(실제로는 시트 데이터에서 동적 산출)
  buildingCodes: BUILDING_CODES,
  categoryCodes: CATEGORY_CODES,
};

/**
 * 장소 문자열 → 건축물코드. 건물명이 장소의 접두어로 일치하면 채택하되,
 * 여러 건물이 접두어로 맞으면 **가장 긴(구체적인) 건물명**을 고른다
 * (예: '우사비가림시설'을 '우사'로 오매칭하지 않도록).
 */
export function buildingCodeFor(location: string, cfg: MgmtNoConfig = MGMTNO_CONFIG): string {
  const norm = (s: string) => s.replace(/[\s/]+/g, "");
  const loc = location.trim();
  if (cfg.buildingCodes[loc]) return cfg.buildingCodes[loc];
  const target = norm(loc);
  let best = "", bestLen = -1;
  for (const [k, v] of Object.entries(cfg.buildingCodes)) {
    const nk = norm(k);
    if (nk && (target === nk || target.startsWith(nk)) && nk.length > bestLen) {
      bestLen = nk.length;
      best = v;
    }
  }
  return best;
}

/** 중분류 → 분류코드. 조회표에 없으면 "" (호출부에서 채번 보류). */
export function categoryCodeFor(categoryMid: string, cfg: MgmtNoConfig = MGMTNO_CONFIG): string {
  const name = categoryMid.trim();
  if (cfg.categoryCodes[name]) return cfg.categoryCodes[name];
  for (const [k, v] of Object.entries(cfg.categoryCodes)) {
    if (name && name.includes(k)) return v;
  }
  return "";
}

export interface MgmtNoParts {
  yeonbeon: number;
  acquiredAt: string;   // 취득일
  categoryCode: string; // F
  seqInDoc: number;     // K 번호
  buildingCode: string; // N
}

/** 구성요소 → 관리번호 한 건. O열 수식과 동일한 결합. */
export function buildMgmtNo(p: MgmtNoParts): string {
  return `[${p.yeonbeon}]${yyyymmdd(p.acquiredAt)}${p.categoryCode}${p.seqInDoc}${p.buildingCode}`;
}

/** 관리번호 앞머리 [연번] 파싱. 없으면 null. */
export function parseYeonbeon(mgmtNo: string): number | null {
  const m = String(mgmtNo).match(/^\[(\d+)\]/);
  return m ? Number(m[1]) : null;
}

/** 기존 관리번호들에서 다음 연번(A열) 산출 = 최대 연번 + 1. */
export function nextYeonbeonFrom(existingMgmtNos: string[], cfg: MgmtNoConfig = MGMTNO_CONFIG): number {
  let max = cfg.nextYeonbeon - 1;
  for (const s of existingMgmtNos) {
    const y = parseYeonbeon(s);
    if (y != null && y > max) max = y;
  }
  return max + 1;
}

/**
 * 웹에서 추가하는 새 자산 1건의 관리번호를 생성.
 * - 연번: 기존 최대 +1
 * - 번호(K): 같은 취득일+건축물코드 묶음 안의 기존 건수 +1
 * - 분류/건축물코드를 못 찾으면 mgmtNo="" 로 두고 missing 사유를 돌려준다(보류·수기 입력).
 */
export function generateOneMgmtNo(
  item: { categoryMid: string; acquiredAt: string; location: string },
  existingMgmtNos: string[],
  cfg: MgmtNoConfig = MGMTNO_CONFIG,
): { mgmtNo: string; yeonbeon: number; missing: string[] } {
  const yeonbeon = nextYeonbeonFrom(existingMgmtNos, cfg);
  const buildingCode = buildingCodeFor(item.location, cfg);
  const categoryCode = categoryCodeFor(item.categoryMid, cfg);
  const day = yyyymmdd(item.acquiredAt);
  const missing: string[] = [];
  if (!day) missing.push("취득일");
  if (!categoryCode) missing.push(`분류코드(중분류 '${item.categoryMid}')`);
  if (!buildingCode) missing.push(`건축물코드(장소 '${item.location}')`);
  if (missing.length) return { mgmtNo: "", yeonbeon, missing };
  const seqInDoc =
    existingMgmtNos.filter((s) => s.includes(day) && s.endsWith(buildingCode)).length + 1;
  return { mgmtNo: buildMgmtNo({ yeonbeon, acquiredAt: item.acquiredAt, categoryCode, seqInDoc, buildingCode }), yeonbeon, missing: [] };
}

export interface ChaebunInput {
  key: string;        // 식별용(학교자산번호 등)
  itemName: string;
  acquiredAt: string;
  location: string;
}
export interface ChaebunResult {
  key: string; mgmtNo: string; yeonbeon: number;
  categoryCode: string; seqInDoc: number; buildingCode: string;
}

/**
 * 누락 신규 항목들에 관리번호를 순차 채번.
 * - 연번은 nextYeonbeon 부터 1씩.
 * - K 번호(같은 건 안의 순번)는 '같은 취득일+장소' 묶음 안에서 1부터.
 * - 분류코드/건축물코드를 못 찾으면 skipped (틀린 번호 생성 방지).
 * - 기존 대장 항목은 여기에 넘기지 않는다(스티커 번호 불변).
 */
export function assignMgmtNos(
  items: ChaebunInput[],
  cfg: MgmtNoConfig = MGMTNO_CONFIG,
): { assigned: ChaebunResult[]; skipped: { key: string; reason: string }[] } {
  const assigned: ChaebunResult[] = [];
  const skipped: { key: string; reason: string }[] = [];
  let yeonbeon = cfg.nextYeonbeon;
  const seqByGroup = new Map<string, number>();
  for (const it of items) {
    const buildingCode = buildingCodeFor(it.location, cfg);
    const categoryCode = categoryCodeFor(it.itemName, cfg);
    const miss: string[] = [];
    if (!buildingCode) miss.push("건축물코드");
    if (!categoryCode) miss.push(`분류코드(${it.itemName})`);
    if (!yyyymmdd(it.acquiredAt)) miss.push("취득일");
    if (miss.length) { skipped.push({ key: it.key, reason: `미확인: ${miss.join("·")}` }); continue; }
    const gkey = `${yyyymmdd(it.acquiredAt)}|${buildingCode}`;
    const seqInDoc = (seqByGroup.get(gkey) ?? 0) + 1;
    seqByGroup.set(gkey, seqInDoc);
    assigned.push({
      key: it.key,
      mgmtNo: buildMgmtNo({ yeonbeon, acquiredAt: it.acquiredAt, categoryCode, seqInDoc, buildingCode }),
      yeonbeon, categoryCode, seqInDoc, buildingCode,
    });
    yeonbeon += 1;
  }
  return { assigned, skipped };
}
