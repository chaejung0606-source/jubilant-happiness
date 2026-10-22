// 수정 전→후 변경내역 요약 + KST 오늘.
export interface FieldDef { key: string; label: string }

export const ASSET_DIFF_FIELDS: FieldDef[] = [
  { key: "mgmtNo", label: "관리번호" },
  { key: "tagNo", label: "태그번호" },
  { key: "itemName", label: "품명" },
  { key: "spec", label: "규격" },
  { key: "unitPrice", label: "단가" },
  { key: "acquiredAt", label: "취득일" },
  { key: "location", label: "위치" },
  { key: "status", label: "상태" },
];

/** 바뀐 필드만 "라벨 전→후" 로 요약. */
export function diffSummary<T extends object>(orig: T, next: T, fields: FieldDef[]): string {
  const o = orig as Record<string, unknown>;
  const n = next as Record<string, unknown>;
  const parts: string[] = [];
  for (const f of fields) {
    const a = String(o[f.key] ?? "").trim();
    const b = String(n[f.key] ?? "").trim();
    if (a !== b) parts.push(`${f.label} ${a || "∅"}→${b || "∅"}`);
  }
  return parts.join("; ");
}

export function todayKst(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
