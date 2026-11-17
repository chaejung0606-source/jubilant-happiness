"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Check, Loader2, Trash2, KeyRound, X } from "lucide-react";
import { StatusBadge } from "@/components/badges/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/ui/form-controls";
import { createAccountAction, updateAccountAction, deleteAccountAction } from "@/app/settings/actions";
import type { AccountRow, Role } from "@/lib/dummy";
import type { Tone } from "@/lib/status";

const ROLES: { value: Role; label: string; desc: string; tone: Tone }[] = [
  { value: "admin", label: "관리자", desc: "전체 메뉴", tone: "mint" },
  { value: "manager", label: "자산담당자", desc: "설정 제외", tone: "sky" },
  { value: "viewer", label: "조회자", desc: "읽기 전용", tone: "slate" },
];
const roleMeta = (r: Role) => ROLES.find((x) => x.value === r) ?? ROLES[2];

export function AccountsManager({ accounts, connected }: { accounts: AccountRow[]; connected: boolean }) {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState<Role>("manager");
  const [busy, setBusy] = React.useState("");
  const [error, setError] = React.useState("");
  const [pwId, setPwId] = React.useState("");
  const [pwVal, setPwVal] = React.useState("");
  const [confirmId, setConfirmId] = React.useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) { setError("아이디와 비밀번호를 입력하세요."); return; }
    setBusy("new");
    const r = await createAccountAction({ username, password, role, name });
    setBusy("");
    if (!r.ok) { setError(r.error || "생성 실패"); return; }
    setUsername(""); setPassword(""); setName(""); setRole("manager");
    router.refresh();
  }

  async function changeRole(a: AccountRow, next: Role) {
    if (!a.id || next === a.role) return;
    setError(""); setBusy(a.id);
    const r = await updateAccountAction(a.id, { role: next });
    setBusy("");
    if (!r.ok) { setError(r.error || "변경 실패"); return; }
    router.refresh();
  }

  async function resetPw(a: AccountRow) {
    if (!a.id || !pwVal) return;
    setError(""); setBusy(a.id);
    const r = await updateAccountAction(a.id, { password: pwVal });
    setBusy("");
    if (!r.ok) { setError(r.error || "재설정 실패"); return; }
    setPwId(""); setPwVal("");
    router.refresh();
  }

  async function remove(a: AccountRow) {
    if (!a.id) return;
    setError(""); setBusy(a.id);
    const r = await deleteAccountAction(a.id);
    setBusy("");
    setConfirmId("");
    if (!r.ok) { setError(r.error || "삭제 실패"); return; }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {!connected && (
        <p className="rounded-xl bg-pastel-apricot/40 px-3 py-2 text-xs text-pastel-apricotInk">
          시트 연동 후 계정이 실제로 저장됩니다. (현재는 미리보기)
        </p>
      )}

      {/* 생성 폼 */}
      <form onSubmit={add} className="grid gap-3 rounded-2xl bg-muted/30 p-3 ring-1 ring-black/[0.04] sm:grid-cols-2">
        <Field label="아이디" required>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="로그인 아이디" autoComplete="off" />
        </Field>
        <Field label="비밀번호" required>
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="형식 제한 없음" autoComplete="new-password" />
        </Field>
        <Field label="이름">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="표시 이름(선택)" />
        </Field>
        <Field label="권한">
          <NativeSelect value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label} · {r.desc}</option>)}
          </NativeSelect>
        </Field>
        <div className="sm:col-span-2 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">비밀번호는 해시로 저장됩니다(평문 미저장).</span>
          <Button type="submit" size="sm" disabled={busy === "new"}>
            {busy === "new" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}계정 추가
          </Button>
        </div>
      </form>

      {error && <p className="text-sm text-pastel-coralInk">{error}</p>}

      {/* 목록 */}
      <ul className="divide-y divide-black/[0.05]">
        {accounts.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">등록된 계정이 없습니다.</li>}
        {accounts.map((a) => {
          const rowBusy = !!a.id && busy === a.id;
          const meta = roleMeta(a.role);
          return (
            <li key={a.id || a.username} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{a.username}</span>
                  {a.name && a.name !== a.username && <span className="text-sm text-muted-foreground">· {a.name}</span>}
                </div>
                {a.updatedAt && <div className="text-[11px] text-muted-foreground">수정 {a.updatedAt.slice(0, 10)}</div>}
              </div>

              {pwId === a.id ? (
                <div className="flex items-center gap-1.5">
                  <Input autoFocus value={pwVal} onChange={(e) => setPwVal(e.target.value)} placeholder="새 비밀번호" className="h-9 w-40" />
                  <Button size="sm" disabled={rowBusy} onClick={() => resetPw(a)}>{rowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}저장</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setPwId(""); setPwVal(""); }}><X className="h-4 w-4" /></Button>
                </div>
              ) : confirmId === a.id ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-pastel-coralInk">삭제?</span>
                  <Button size="sm" variant="destructive" disabled={rowBusy} onClick={() => remove(a)}>예</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmId("")}>아니오</Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <NativeSelect
                    value={a.role}
                    onChange={(e) => changeRole(a, e.target.value as Role)}
                    disabled={rowBusy || !a.id}
                    className="h-9 w-36"
                    title="권한 변경"
                  >
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </NativeSelect>
                  <StatusBadge label={meta.desc} tone={meta.tone} />
                  <Button size="sm" variant="ghost" disabled={!a.id} onClick={() => { setPwId(a.id || ""); setPwVal(""); setError(""); }} title="비밀번호 재설정">
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!a.id} onClick={() => setConfirmId(a.id || "")} title="삭제">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
