"use server";

import { createAsset, type AssetInput } from "@/data";
import { revalidatePath, revalidateTag } from "next/cache";

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
