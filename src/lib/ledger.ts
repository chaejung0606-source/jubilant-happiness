// 대사 결과(로컬 세션 산출 CSV) 한 행 → 관리대장 반영용 초안(Draft) 변환.
// 로컬 세션 결과의 열 이름(구분/세부/A …/B …/메모)에 맞춰 매핑한다.
import type { Table } from "./csv";
import type { AssetInput } from "@/data";

export interface Draft {
  id: string;
  include: boolean;
  group: string;   // 구분 (읽기전용)
  detail: string;  // 세부 (읽기전용)
  mgmtNo: string;  // 자산번호 or 지출문서
  itemName: string;
  tagNo: string;   // 자산태그번호 (대사 파일의 RFID 열)
  spec: string;
  acquiredAt: string;
  unitPrice: string; // 편집 위해 문자열
  location: string;
  user: string;
  status: string;
  note: string;    // 메모 (편집 가능)
}

const pick = (r: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) {
    const v = (r[k] ?? "").trim();
    if (v) return v;
  }
  return "";
};

/** 대사 결과 CSV인지(구분/세부 + A·B 열) 판별. */
export function looksLikeDaesa(headers: string[]): boolean {
  const h = headers.join("|");
  return /구분/.test(h) && /세부/.test(h) && /(A |B )/.test(h);
}

/** 조치가 필요한(기본 포함) 세부 구분. */
export function isActionable(detail: string): boolean {
  return /누락|미확인|불일치|오기/.test(detail);
}

export function draftsFromDaesa(table: Table): Draft[] {
  return table.rows.map((r, i) => {
    const detail = pick(r, "세부");
    return {
      id: "d" + i,
      include: isActionable(detail),
      group: pick(r, "구분"),
      detail,
      mgmtNo: pick(r, "A 자산번호", "B 지출문서", "자산번호", "지출문서"),
      itemName: pick(r, "A 품명", "B 품명", "품명"),
      tagNo: pick(r, "A RFID", "B RFID", "RFID", "태그번호", "자산태그번호"),
      spec: pick(r, "A 품목명", "B 규격", "품목명", "규격"),
      acquiredAt: pick(r, "A 취득일", "B 취득일", "취득일"),
      unitPrice: pick(r, "A 단가", "B 단가", "단가"),
      location: pick(r, "A 사용위치", "B 위치", "사용위치", "위치"),
      user: pick(r, "B 사용처", "사용처", "사용자"),
      status: "정상",
      note: pick(r, "메모"),
    };
  });
}

/** 관리대장(assets) 입력으로 변환. RFID·규격은 전용 열, 구분·메모는 메모 열. */
export function draftToAssetInput(d: Draft): AssetInput {
  const memo = [
    (d.group || d.detail) && `[${d.group}·${d.detail}]`,
    d.note,
  ].filter(Boolean).join(" / ");
  return {
    mgmtNo: d.mgmtNo,
    tagNo: d.tagNo,
    spec: d.spec,
    itemName: d.itemName,
    category: "",
    status: d.status || "정상",
    user: d.user,
    location: d.location,
    unitPrice: Number(String(d.unitPrice).replace(/[^\d.-]/g, "")) || 0,
    acquiredAt: d.acquiredAt,
    memo,
  };
}

export const LEDGER_CSV_HEADERS = [
  "자산번호", "품명", "태그번호", "규격", "취득일", "단가", "위치", "사용자", "상태", "구분", "세부", "메모",
];

export function draftToCsvRow(d: Draft): Record<string, string> {
  return {
    자산번호: d.mgmtNo, 품명: d.itemName, 태그번호: d.tagNo, 규격: d.spec,
    취득일: d.acquiredAt, 단가: d.unitPrice, 위치: d.location, 사용자: d.user,
    상태: d.status, 구분: d.group, 세부: d.detail, 메모: d.note,
  };
}
