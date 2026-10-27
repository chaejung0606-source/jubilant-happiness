// 데이터 접근 계층. 시트가 설정돼 있으면 Google Sheets, 아니면 더미.
// 읽기 실패 시에도 앱이 죽지 않도록 더미로 폴백한다.
import {
  ASSETS, LOANS, CONSUMABLES, PROMO,
  type AssetRow, type LoanRow, type ConsumableRow, type PromoRow,
} from "@/lib/dummy";
import { sheetsConfigured, sheetGet, sheetWrite, sheetMeta, type SheetTab } from "@/server/sheets";
import { toAssetRow, toLoanRow, toConsumableRow, toPromoRow } from "./map";

export { sheetsConfigured };

/**
 * 연결된 구글시트의 주소(새 탭 바로가기용). tab 을 주면 그 탭(#gid)으로 바로 연다.
 * 미설정·구버전 Code.gs·읽기 실패면 null — 화면은 설정 > 데이터 연동 안내로 대신한다.
 */
export async function getSheetUrl(tab?: SheetTab): Promise<string | null> {
  if (!sheetsConfigured()) return null;
  try {
    const meta = await sheetMeta();
    // 구글 문서 주소만 링크로 쓴다(응답이 오염돼도 임의 주소·javascript: 로 보내지 않도록)
    if (!meta || !/^https:\/\/docs\.google\.com\//.test(meta.url)) return null;
    const base = meta.url.split("#")[0];
    const gid = tab ? meta.gids[tab] : undefined;
    return Number.isInteger(gid) ? `${base}#gid=${gid}` : base;
  } catch (e) {
    console.warn("[data] getSheetUrl 실패:", e);
    return null;
  }
}

export async function getAssets(): Promise<AssetRow[]> {
  if (!sheetsConfigured()) return ASSETS;
  try {
    return (await sheetGet("assets")).map(toAssetRow);
  } catch (e) {
    console.warn("[data] getAssets 폴백(더미):", e);
    return ASSETS;
  }
}

export async function getLoans(): Promise<LoanRow[]> {
  if (!sheetsConfigured()) return LOANS;
  try {
    return (await sheetGet("loans")).map(toLoanRow);
  } catch (e) {
    console.warn("[data] getLoans 폴백(더미):", e);
    return LOANS;
  }
}

export async function getConsumables(): Promise<ConsumableRow[]> {
  if (!sheetsConfigured()) return CONSUMABLES;
  try {
    return (await sheetGet("consumables")).map(toConsumableRow);
  } catch (e) {
    console.warn("[data] getConsumables 폴백(더미):", e);
    return CONSUMABLES;
  }
}

export async function getPromo(): Promise<PromoRow[]> {
  if (!sheetsConfigured()) return PROMO;
  try {
    return (await sheetGet("promo")).map(toPromoRow);
  } catch (e) {
    console.warn("[data] getPromo 폴백(더미):", e);
    return PROMO;
  }
}

export interface AssetInput {
  mgmtNo: string;
  tagNo?: string;
  spec?: string;
  itemName: string;
  category: string;
  status: string;
  user: string;
  location: string;
  unitPrice: number;
  acquiredAt: string;
  memo?: string;
  // 대장 우측 수정기록 열
  editedAt?: string;
  editReason?: string;
  editDetail?: string;
}

/** 자산 1건 추가. 시트 미설정이면 에러를 던진다(폼에서 안내). */
export async function createAsset(input: AssetInput): Promise<void> {
  if (!sheetsConfigured()) {
    throw new Error("시트 연동이 아직 설정되지 않았습니다. 설정 > 데이터 연동을 참고하세요.");
  }
  await sheetWrite("assets", "append", { ...input });
}

/** 자산 1건 수정(id 기준). */
export async function updateAsset(id: string, input: AssetInput): Promise<void> {
  if (!sheetsConfigured()) {
    throw new Error("시트 연동이 아직 설정되지 않았습니다.");
  }
  await sheetWrite("assets", "update", { id, ...input });
}

/** 자산 1건 삭제(id 기준). */
export async function deleteAsset(id: string): Promise<void> {
  if (!sheetsConfigured()) {
    throw new Error("시트 연동이 아직 설정되지 않았습니다.");
  }
  await sheetWrite("assets", "delete", { id });
}

/** 여러 자산을 순차 추가(대사 결과 일괄 반영). 실패는 집계만 하고 계속 진행. */
export async function createAssetsMany(
  inputs: AssetInput[]
): Promise<{ ok: number; fail: number; errors: string[] }> {
  if (!sheetsConfigured()) {
    throw new Error("시트 연동이 아직 설정되지 않았습니다. 설정 > 데이터 연동을 참고하세요.");
  }
  let ok = 0;
  let fail = 0;
  const errors: string[] = [];
  for (const inp of inputs) {
    try {
      await sheetWrite("assets", "append", { ...inp });
      ok++;
    } catch (e) {
      fail++;
      if (errors.length < 5) errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { ok, fail, errors };
}

// ── 대여(loans) ───────────────────────────────────────────────
export interface LoanInput {
  mgmtNo: string;
  itemName: string;
  borrower: string;
  idNo?: string;
  affiliation?: string;
  phone?: string;
  reason?: string;
  signature?: string;
  loanedAt: string;
  lendBy?: string;
  dueAt: string;
  returnedAt?: string;
  returnBy?: string;
  status?: string;
}

const LOANS_NOT_READY = "시트 연동이 아직 설정되지 않았습니다. 설정 > 데이터 연동을 참고하세요.";

/** 대여 처리(새 대여 1건 추가). */
export async function createLoan(input: LoanInput): Promise<void> {
  if (!sheetsConfigured()) throw new Error(LOANS_NOT_READY);
  await sheetWrite("loans", "append", { ...input, status: input.status || "대여중" });
}

/** 반납 처리(반납일·반납 확인자 기록 + 상태 반납완료). */
export async function returnLoan(id: string, returnedAt: string, returnBy?: string): Promise<void> {
  if (!sheetsConfigured()) throw new Error(LOANS_NOT_READY);
  await sheetWrite("loans", "update", { id, returnedAt, returnBy: returnBy || "", status: "반납완료" });
}

/** 대여 1건 수정(id 기준). */
export async function updateLoan(id: string, input: LoanInput): Promise<void> {
  if (!sheetsConfigured()) throw new Error(LOANS_NOT_READY);
  await sheetWrite("loans", "update", { id, ...input });
}

/** 대여 1건 삭제(id 기준). */
export async function deleteLoan(id: string): Promise<void> {
  if (!sheetsConfigured()) throw new Error(LOANS_NOT_READY);
  await sheetWrite("loans", "delete", { id });
}
