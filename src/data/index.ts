// 데이터 접근 계층. 시트가 설정돼 있으면 Google Sheets, 아니면 더미.
// 읽기 실패 시에도 앱이 죽지 않도록 더미로 폴백한다.
import {
  ASSETS, LOANS, CONSUMABLES, PROMO,
  type AssetRow, type LoanRow, type ConsumableRow, type PromoRow,
} from "@/lib/dummy";
import { sheetsConfigured, sheetGet, sheetWrite } from "@/server/sheets";
import { toAssetRow, toLoanRow, toConsumableRow, toPromoRow } from "./map";

export { sheetsConfigured };

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
  itemName: string;
  category: string;
  status: string;
  user: string;
  location: string;
  unitPrice: number;
  acquiredAt: string;
  memo?: string;
}

/** 자산 1건 추가. 시트 미설정이면 에러를 던진다(폼에서 안내). */
export async function createAsset(input: AssetInput): Promise<void> {
  if (!sheetsConfigured()) {
    throw new Error("시트 연동이 아직 설정되지 않았습니다. 설정 > 데이터 연동을 참고하세요.");
  }
  await sheetWrite("assets", "append", { ...input });
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
