import { Settings, Database, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SoftCard, SoftCardHeader } from "@/components/cards/soft-card";
import { StatusBadge } from "@/components/badges/status-badge";
import { sheetsConfigured } from "@/data";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const connected = sheetsConfigured();
  return (
    <>
      <PageHeader title="설정" description="계정·권한·데이터 연동" icon={<Settings className="h-6 w-6" />} />

      <div className="grid gap-4 lg:grid-cols-2">
        <SoftCard>
          <SoftCardHeader
            title="데이터 연동"
            description={connected ? "Google Sheets 연결됨" : "현재 더미 데이터로 동작 중"}
            action={<Database className="h-5 w-5 text-pastel-skyInk" />}
          />
          <p className="text-sm leading-relaxed text-muted-foreground">
            <b className="text-foreground">Google Sheets</b> 를 백엔드로 사용합니다. 시트를 연결하면
            데스크톱·갤럭시 태블릿 등 모든 기기에서 같은 데이터를 보고 동기화됩니다.
            설정 방법은 저장소의 <span className="font-mono text-xs">SHEETS-SETUP.md</span> 를 참고하세요.
          </p>
          <div className="mt-4">
            {connected
              ? <StatusBadge label="연동됨 (Google Sheets)" tone="mint" />
              : <StatusBadge label="연동 대기 (더미)" tone="apricot" />}
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
