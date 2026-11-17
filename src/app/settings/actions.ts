"use server";

import { getAccounts, createAccount, updateAccount, deleteAccount } from "@/data";
import { hashPassword } from "@/lib/password";
import type { Role } from "@/lib/dummy";
import { revalidatePath } from "next/cache";
import { revalidateTag } from "next/cache";

function revalidateAccounts() {
  revalidateTag("sheets");
  revalidatePath("/settings");
}

const ROLES: Role[] = ["admin", "manager", "viewer"];
const normRole = (r: string): Role => (ROLES.includes(r as Role) ? (r as Role) : "viewer");

export async function createAccountAction(input: {
  username: string; password: string; role: string; name: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const username = input.username.trim();
    const password = input.password;
    const name = input.name.trim();
    if (!username || !password) return { ok: false, error: "아이디와 비밀번호는 필수입니다." };
    const existing = await getAccounts();
    if (existing.some((a) => a.username.toLowerCase() === username.toLowerCase())) {
      return { ok: false, error: "이미 있는 아이디입니다." };
    }
    await createAccount({ username, password: hashPassword(password), role: normRole(input.role), name: name || username });
    revalidateAccounts();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "계정 생성에 실패했습니다." };
  }
}

export async function updateAccountAction(id: string, input: {
  role?: string; name?: string; password?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!id) return { ok: false, error: "대상 계정이 없습니다." };
    const patch: { role?: Role; name?: string; password?: string } = {};
    if (input.role != null) patch.role = normRole(input.role);
    if (input.name != null) patch.name = input.name.trim();
    if (input.password) patch.password = hashPassword(input.password);
    // 마지막 관리자를 강등하지 않도록 보호
    if (patch.role && patch.role !== "admin") {
      const accounts = await getAccounts();
      const admins = accounts.filter((a) => a.role === "admin");
      if (admins.length <= 1 && admins[0]?.id === id) {
        return { ok: false, error: "마지막 관리자 계정의 권한은 바꿀 수 없습니다." };
      }
    }
    await updateAccount(id, patch);
    revalidateAccounts();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "수정에 실패했습니다." };
  }
}

export async function deleteAccountAction(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!id) return { ok: false, error: "대상 계정이 없습니다." };
    const accounts = await getAccounts();
    const target = accounts.find((a) => a.id === id);
    if (target?.role === "admin" && accounts.filter((a) => a.role === "admin").length <= 1) {
      return { ok: false, error: "마지막 관리자 계정은 삭제할 수 없습니다." };
    }
    await deleteAccount(id);
    revalidateAccounts();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "삭제에 실패했습니다." };
  }
}
