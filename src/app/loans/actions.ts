"use server";

import { createLoan, returnLoan, updateLoan, deleteLoan, type LoanInput } from "@/data";
import { revalidatePath, revalidateTag } from "next/cache";

function revalidateLoans() {
  revalidateTag("sheets");
  revalidatePath("/loans");
  revalidatePath("/");
}

export async function createLoanAction(input: LoanInput): Promise<{ ok: boolean; error?: string }> {
  try {
    await createLoan(input);
    revalidateLoans();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "대여 처리에 실패했습니다." };
  }
}

export async function returnLoanAction(id: string, returnedAt: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!id) throw new Error("대여 식별자(id)가 없어 반납 처리를 할 수 없습니다.");
    await returnLoan(id, returnedAt);
    revalidateLoans();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "반납 처리에 실패했습니다." };
  }
}

export async function updateLoanAction(id: string, input: LoanInput): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!id) throw new Error("대여 식별자(id)가 없습니다.");
    await updateLoan(id, input);
    revalidateLoans();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "수정에 실패했습니다." };
  }
}

export async function deleteLoanAction(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!id) throw new Error("대여 식별자(id)가 없습니다.");
    await deleteLoan(id);
    revalidateLoans();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "삭제에 실패했습니다." };
  }
}
