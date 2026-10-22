// 사업단 자산관리번호(관리번호) 채번 규칙.
//
// 자산관리대장 Excel 의 "관리번호(수식)" 열이 만드는 번호를 코드로 재현한다.
// 예) 202409275011B0000142
//        └등록일자┘└일련┘└─ 건물·실 코드 ─┘
//        20240927   5011   B0000142
//
// ── 중요 원칙 ───────────────────────────────────────────────
// • 이미 대장에 있는 자산은 스티커가 붙어 있어 **번호를 바꾸지 않는다**.
//   채번은 오직 '누락'(학교대장엔 있으나 정리본에 없는) 신규 항목에만 한다.
// • 아래 CONFIG 세 값은 실제 Excel 에서만 확인되는 값이라 로컬 세션이 채운다.
//   확인 전에는 isChaebunReady() 가 false → CLI/UI 가 실제 반영(commit)을 막는다.
//   (검증 안 된 번호가 운영 시트에 들어가는 사고 방지)

export interface MgmtNoConfig {
  /** 등록일자 8자리(YYYYMMDD). 예시 번호의 20240927 — 취득일이 아니라 대장 최초 등록일. */
  regDate: string;
  /** 일련번호 시작값(= 현재 대장 최대 일련번호 + 1). 예시의 5011 이후가 이어짐. */
  nextSeq: number;
  /** 일련번호 자리수(예시는 4자리: 5011). */
  seqWidth: number;
  /** 건물·실 → 코드(B+7자리) 매핑. 예: "중앙도서관 401-1": "B0000142". */
  buildingCodes: Record<string, string>;
}

// TODO(로컬세션 확인): 아래 세 값은 자산관리대장 Excel 의 "관리번호(수식)" 에서 추출.
//   1) regDate       — 수식이 고정일(20240927)을 쓰는지, 셀 참조인지
//   2) nextSeq       — 기존 일련번호 최대값 +1
//   3) buildingCodes — 건물·실별 B코드 (누락 9건은 전부 "중앙도서관 이용자교육실 401-1")
export const MGMTNO_CONFIG: MgmtNoConfig = {
  regDate: "",
  nextSeq: 0,
  seqWidth: 4,
  buildingCodes: {},
};

/** CONFIG 가 실제 채번 가능한 상태로 채워졌는지. */
export function isChaebunReady(cfg: MgmtNoConfig = MGMTNO_CONFIG): boolean {
  return /^\d{8}$/.test(cfg.regDate) && cfg.nextSeq > 0 && cfg.seqWidth > 0;
}

/** 위치 문자열을 건물·실 코드로. 매핑에 없으면 "" (호출부에서 채번 보류). */
export function buildingCodeFor(location: string, cfg: MgmtNoConfig = MGMTNO_CONFIG): string {
  const loc = location.trim();
  if (cfg.buildingCodes[loc]) return cfg.buildingCodes[loc];
  // 느슨한 매칭: 공백/슬래시 차이를 흡수.
  const norm = (s: string) => s.replace(/[\s/]+/g, "");
  const target = norm(loc);
  for (const [k, v] of Object.entries(cfg.buildingCodes)) {
    if (norm(k) === target) return v;
  }
  return "";
}

/** 등록일자 + 일련번호 + 건물코드 → 관리번호 한 건. */
export function buildMgmtNo(seq: number, buildingCode: string, cfg: MgmtNoConfig = MGMTNO_CONFIG): string {
  const s = String(seq).padStart(cfg.seqWidth, "0");
  return `${cfg.regDate}${s}${buildingCode}`;
}

export interface ChaebunInput {
  /** 식별용(순번 등). 결과 매핑에 되돌려준다. */
  key: string;
  location: string;
}
export interface ChaebunResult {
  key: string;
  mgmtNo: string;
  seq: number;
  buildingCode: string;
}

/**
 * 누락 신규 항목들에 관리번호를 순차 채번.
 * - buildingCodes 에 없는 위치는 skipped 로 분리(틀린 번호 생성 방지).
 * - 기존 대장 번호는 건드리지 않는다(여기엔 신규만 넘긴다).
 */
export function assignMgmtNos(
  items: ChaebunInput[],
  cfg: MgmtNoConfig = MGMTNO_CONFIG,
): { assigned: ChaebunResult[]; skipped: { key: string; location: string; reason: string }[] } {
  const assigned: ChaebunResult[] = [];
  const skipped: { key: string; location: string; reason: string }[] = [];
  if (!isChaebunReady(cfg)) {
    return { assigned, skipped: items.map((it) => ({ ...it, reason: "채번 설정(CONFIG) 미완료" })) };
  }
  let seq = cfg.nextSeq;
  for (const it of items) {
    const code = buildingCodeFor(it.location, cfg);
    if (!code) {
      skipped.push({ key: it.key, location: it.location, reason: "건물·실 코드 매핑 없음" });
      continue;
    }
    assigned.push({ key: it.key, mgmtNo: buildMgmtNo(seq, code, cfg), seq, buildingCode: code });
    seq += 1;
  }
  return { assigned, skipped };
}
