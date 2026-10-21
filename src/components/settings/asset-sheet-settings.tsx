"use client";

import * as React from "react";
import { FileSpreadsheet, Check, ExternalLink } from "lucide-react";
import { SoftCard, SoftCardHeader } from "@/components/cards/soft-card";
import { StatusBadge } from "@/components/badges/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form-controls";
import { normalizeSheetUrl, saveAssetSheetUrl, useAssetSheetUrl } from "@/lib/asset-sheet";
import { cn } from "@/lib/utils";

/** 설정 > 구글시트 바로가기 — 자산 화면 [구글시트] 버튼이 열 주소를 이 브라우저에 저장한다. */
export function AssetSheetSettings() {
  const saved = useAssetSheetUrl();
  return (
    <SoftCard>
      <SoftCardHeader
        title="구글시트 바로가기"
        description="자산 화면의 [구글시트] 버튼이 여는 주소"
        action={<FileSpreadsheet className="h-5 w-5 text-pastel-mintInk" />}
      />
      {/* 저장값은 브라우저에서만 알 수 있으므로 하이드레이션 후에 폼을 그린다. */}
      {saved === undefined ? <div className="h-[132px]" /> : <SheetUrlForm saved={saved} />}
    </SoftCard>
  );
}

function SheetUrlForm({ saved }: { saved: string | null }) {
  const [value, setValue] = React.useState(saved ?? "");
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const url = normalizeSheetUrl(value);
    if (!url) {
      setMsg({ ok: false, text: "https://docs.google.com/… 로 시작하는 구글시트 주소를 입력하세요." });
      return;
    }
    if (!saveAssetSheetUrl(url)) {
      setMsg({ ok: false, text: "이 브라우저에서는 저장할 수 없습니다(사생활 보호 모드 등)." });
      return;
    }
    setValue(url);
    setMsg({ ok: true, text: "저장했습니다. 자산 화면의 [구글시트] 버튼으로 열 수 있습니다." });
  }

  function clear() {
    saveAssetSheetUrl(null);
    setValue("");
    setMsg({ ok: true, text: "주소를 지웠습니다." });
  }

  return (
    <form onSubmit={save}>
      <div className="mb-3">
        {saved
          ? <StatusBadge label="설정됨" tone="mint" />
          : <StatusBadge label="미설정" tone="apricot" />}
      </div>
      <Field label="시트 주소">
        <Input
          value={value}
          onChange={(e) => { setValue(e.target.value); setMsg(null); }}
          placeholder="https://docs.google.com/spreadsheets/d/…"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      {msg && (
        <p role="status" className={cn("mt-2 text-xs", msg.ok ? "text-pastel-mintInk" : "text-pastel-coralInk")}>{msg.text}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm"><Check className="h-4 w-4" /> 저장</Button>
        {saved && (
          <>
            <Button asChild variant="outline" size="sm">
              <a href={saved} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> 열어보기</a>
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clear}>지우기</Button>
          </>
        )}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        주소는 <b className="text-foreground">지금 쓰는 브라우저(기기)에만</b> 저장됩니다. PC·태블릿에서 각각 한 번씩 입력하세요.
        로그인 없는 공개 사이트라 서버에는 보관하지 않습니다.
      </p>
    </form>
  );
}
