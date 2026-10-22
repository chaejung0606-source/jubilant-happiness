"use server";

import { createAsset, createAssetsMany, updateAsset, deleteAsset, getAssets, type AssetInput } from "@/data";
import { generateOneMgmtNo } from "@/lib/mgmtno";
import { revalidatePath, revalidateTag } from "next/cache";

function revalidateAssets() {
  revalidateTag("sheets");
  revalidatePath("/assets");
  revalidatePath("/");
}

export async function createAssetAction(
  input: AssetInput
): Promise<{ ok: boolean; error?: string; mgmtNo?: string; note?: string }> {
  try {
    let note: string | undefined;
    const payload = { ...input };
    // 관리번호가 비어 있으면 앱이 자동 채번(기존 번호는 절대 건드리지 않음).
    if (!payload.mgmtNo?.trim()) {
      const existing = await getAssets();
      const nos = existing.map((a) => String(a.mgmtNo || "")).filter(Boolean);
      const gen = generateOneMgmtNo(
        { itemName: payload.itemName, acquiredAt: payload.acquiredAt, location: payload.location },
        nos,
      );
      if (gen.mgmtNo) payload.mgmtNo = gen.mgmtNo;
      else note = `자동 채번 보류(${gen.missing.join("·")} 조회표 미비) — 관리번호 없이 저장됨`;
    }
    await createAsset(payload);
    revalidateTag("sheets");
    revalidatePath("/assets");
    revalidatePath("/");
    return { ok: true, mgmtNo: payload.mgmtNo, note };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "저장에 실패했습니다." };
  }
}

export async function updateAssetAction(
  id: string,
  input: AssetInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    await updateAsset(id, input);
    revalidateAssets();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "수정에 실패했습니다." };
  }
}

export async function deleteAssetAction(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await deleteAsset(id);
    revalidateAssets();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "삭제에 실패했습니다." };
  }
}

/** 대사 결과 선택 항목을 관리대장(assets)에 일괄 반영. */
export async function applyLedgerAction(
  inputs: AssetInput[]
): Promise<{ ok: number; fail: number; error?: string }> {
  try {
    const r = await createAssetsMany(inputs);
    revalidateTag("sheets");
    revalidatePath("/assets");
    revalidatePath("/");
    return { ok: r.ok, fail: r.fail, error: r.errors[0] };
  } catch (e) {
    return { ok: 0, fail: inputs.length, error: e instanceof Error ? e.message : "반영에 실패했습니다." };
  }
}
