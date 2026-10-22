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

// 대장에서 실제 쓰는 건축물코드(L열 장소 → N열). 로컬 세션 확인값.
//  ※ 코드는 건물 단위까지만. 호실(이용자교육실 401-1 등)은 M열에 따로 적고 번호엔 안 들어간다.
export const BUILDING_CODES: Record<string, string> = {
  "집현관(제2도서관)": "B0000142",
  "서암관(서암디지털미디어센터)": "B0000031",
  "한빛관 및 보듬관(청정산업신기술지원센터)": "B0000038",
  "공과대학 4호관": "B0000123",
  "공과대학 6호관": "B0000125",
  "공과대학 5호관": "B0000124",
  "60주년 기념관(종합강의동)": "B0000025",
  "미래관": "B0000047",
  "중앙도서관": "B0000044", // 아직 대장에 자산 없음 — 누락 9건이 들어갈 자리
};

// 분류코드(F): 품명/중분류 → 코드. Excel 중분류 조회표가 원본이라 확인된 것만.
// TODO(로컬세션 확인): 컴퓨터서버·인터랙티브화이트보드 등 미확인 품명의 분류코드.
export const CATEGORY_CODES: Record<string, string> = {
  "데스크톱컴퓨터": "501", // 확인됨(예시: 501=컴퓨터)
  // 컴퓨터서버·인터랙티브화이트보드및액세서리 등은 중분류 조회표 확인 전까지 비워 둔다(추측 금지).
};

export interface MgmtNoConfig {
  /** 새로 채번할 때 시작 연번(A열). 대장 마지막 연번 +1. 확인값: 906 → 907. */
  nextYeonbeon: number;
  buildingCodes: Record<string, string>;
  categoryCodes: Record<string, string>;
}

export const MGMTNO_CONFIG: MgmtNoConfig = {
  nextYeonbeon: 907,
  buildingCodes: BUILDING_CODES,
  categoryCodes: CATEGORY_CODES,
};

/** 장소 문자열 → 건축물코드. 호실/슬래시 차이를 흡수해 건물명만 매칭. */
export function buildingCodeFor(location: string, cfg: MgmtNoConfig = MGMTNO_CONFIG): string {
  const norm = (s: string) => s.replace(/[\s/]+/g, "");
  const target = norm(location);
  if (cfg.buildingCodes[location.trim()]) return cfg.buildingCodes[location.trim()];
  for (const [k, v] of Object.entries(cfg.buildingCodes)) {
    const nk = norm(k);
    if (nk === target || target.startsWith(nk) || target.includes(nk)) return v;
  }
  return "";
}

/** 품명 → 분류코드. 조회표에 없으면 "" (호출부에서 채번 보류). */
export function categoryCodeFor(itemName: string, cfg: MgmtNoConfig = MGMTNO_CONFIG): string {
  const name = itemName.trim();
  if (cfg.categoryCodes[name]) return cfg.categoryCodes[name];
  for (const [k, v] of Object.entries(cfg.categoryCodes)) {
    if (name.includes(k)) return v;
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
