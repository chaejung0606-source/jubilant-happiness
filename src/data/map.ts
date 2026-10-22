// 시트 행(문자열 맵) → 앱 타입 매핑 + 상태 톤 계산.
import type { AssetRow, LoanRow, ConsumableRow, PromoRow } from "@/lib/dummy";
import type { Tone } from "@/lib/status";

type Raw = Record<string, unknown>;

const s = (v: unknown) => String(v ?? "").trim();
const num = (v: unknown) => {
  const x = Number(String(v ?? "").replace(/[,\s₩]/g, ""));
  return Number.isFinite(x) ? x : 0;
};

export const ASSET_STATUS_OPTIONS = [
  "정상", "사용중", "보관중", "대여중", "점검필요", "수리중", "분실", "폐기예정",
] as const;

const ASSET_TONE: Record<string, Tone> = {
  정상: "mint", 보관중: "mint",
  사용중: "purple",
  대여중: "sky",
  점검필요: "apricot",
  수리중: "coral", 분실: "coral", 폐기예정: "coral", 폐기: "coral",
};
export function assetTone(status: string): Tone {
  return ASSET_TONE[status] ?? "slate";
}

/** KST 기준 오늘(YYYY-MM-DD). */
function todayKst(): string {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

export function toAssetRow(r: Raw): AssetRow {
  const status = s(r.status) || "정상";
  return {
    id: s(r.id) || undefined,
    mgmtNo: s(r.mgmtNo),
    tagNo: s(r.tagNo),
    spec: s(r.spec),
    itemName: s(r.itemName),
    category: s(r.category),
    status,
    statusTone: assetTone(status),
    user: s(r.user) || null,
    location: s(r.location),
    unitPrice: num(r.unitPrice),
    acquiredAt: s(r.acquiredAt),
  };
}

export function toLoanRow(r: Raw): LoanRow {
  const dueAt = s(r.dueAt);
  const returnedAt = s(r.returnedAt);
  const overdue = !returnedAt && !!dueAt && dueAt < todayKst();
  return {
    mgmtNo: s(r.mgmtNo),
    itemName: s(r.itemName),
    borrower: s(r.borrower),
    affiliation: s(r.affiliation),
    loanedAt: s(r.loanedAt),
    dueAt,
    overdue,
  };
}

export function toConsumableRow(r: Raw): ConsumableRow {
  const qty = num(r.qty);
  const safetyQty = num(r.safetyQty);
  const { status, tone } = stockState(qty, safetyQty, "소진");
  return {
    itemName: s(r.itemName),
    spec: s(r.spec),
    qty,
    safetyQty,
    unit: s(r.unit) || "개",
    status,
    statusTone: tone,
  };
}

export function toPromoRow(r: Raw): PromoRow {
  const qty = num(r.qty);
  const safetyQty = num(r.safetyQty);
  const { status, tone } = stockState(qty, safetyQty, "품절");
  return {
    code: s(r.code),
    name: s(r.name),
    qty,
    safetyQty,
    unit: s(r.unit) || "개",
    status,
    statusTone: tone,
  };
}

/** 수량 vs 안전재고 → 상태/톤. emptyLabel: 0일 때 라벨(소진/품절). */
function stockState(qty: number, safety: number, emptyLabel: string): { status: string; tone: Tone } {
  if (qty <= 0) return { status: emptyLabel, tone: "coral" };
  if (qty <= safety) return { status: emptyLabel === "품절" ? "재고 주의" : "부족", tone: "apricot" };
  return { status: "정상", tone: "mint" };
}
