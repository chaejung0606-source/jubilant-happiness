"use server";

import { createAsset, createAssetsMany, updateAsset, deleteAsset, type AssetInput } from "@/data";
import { revalidatePath, revalidateTag } from "next/cache";

function revalidateAssets() {
  revalidateTag("sheets");
  revalidatePath("/assets");
  revalidatePath("/");
}

export async function createAssetAction(
  input: AssetInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    await createAsset(input);
    revalidateTag("sheets");
    revalidatePath("/assets");
    revalidatePath("/");
    return { ok: true };
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
