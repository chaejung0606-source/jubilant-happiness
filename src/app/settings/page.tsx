import { Settings, Database, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SoftCard, SoftCardHeader } from "@/components/cards/soft-card";
import { StatusBadge } from "@/components/badges/status-badge";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="설정" description="계정·권한·데이터 연동" icon={<Settings className="h-6 w-6" />} />

      <div className="grid gap-4 lg:grid-cols-2">
        <SoftCard>
          <SoftCardHeader
            title="데이터 연동"
            description="현재 더미 데이터로 동작 중"
            action={<Database className="h-5 w-5 text-pastel-skyInk" />}
          />
          <p className="text-sm leading-relaxed text-muted-foreground">
            화면을 먼저 완성하는 단계입니다. 다음 단계에서 <b className="text-foreground">Supabase</b> 를 연결하면
            데스크톱·갤럭시 태블릿 등 모든 기기에서 같은 데이터를 보고 실시간으로 동기화됩니다.
          </p>
          <div className="mt-4">
            <StatusBadge label="연동 대기 (더미)" tone="apricot" />
          </div>
        </SoftCard>

        <SoftCard>
          <SoftCardHeader
            title="계정 · 권한"
            description="메뉴별 접근 권한 관리"
            action={<ShieldCheck className="h-5 w-5 text-pastel-mintInk" />}
          />
          <ul className="flex flex-col gap-2.5 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-foreground">관리자</span>
              <StatusBadge label="전체 메뉴" tone="mint" />
            </li>
            <li className="flex items-center justify-between">
              <span className="text-foreground">자산담당자</span>
              <StatusBadge label="설정 제외" tone="sky" />
            </li>
            <li className="flex items-center justify-between">
              <span className="text-foreground">조회자</span>
              <StatusBadge label="읽기 전용" tone="slate" />
            </li>
          </ul>
        </SoftCard>
      </div>
    </>
  );
}
