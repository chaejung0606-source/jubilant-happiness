import { Settings, Database, ShieldCheck, Sheet, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SoftCard, SoftCardHeader } from "@/components/cards/soft-card";
import { StatusBadge } from "@/components/badges/status-badge";
import { Button } from "@/components/ui/button";
import { getSheetUrl, sheetsConfigured } from "@/data";

export default async function SettingsPage() {
  const connected = sheetsConfigured();
  const sheetUrl = await getSheetUrl();
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
            아래 <b className="text-foreground">구글시트 바로가기</b>로 원본 시트를 열어
            <b className="text-foreground"> 로우데이터(실제 저장 형태·탭별 행)</b>가 어떻게 정리되는지 직접 확인할 수 있습니다.
            연결 정보(웹앱 URL·토큰)는 보안상 이 화면이 아니라 Vercel 환경변수로 등록합니다.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {connected
              ? <StatusBadge label="연동됨 (Google Sheets)" tone="mint" />
              : <StatusBadge label="연동 대기 (더미)" tone="apricot" />}
            {sheetUrl && (
              <Button asChild variant="outline" size="sm">
                <a href={sheetUrl} target="_blank" rel="noopener noreferrer" title="연결된 구글시트 원본 데이터 열기 (새 탭)">
                  <Sheet className="h-4 w-4" /> 구글시트 바로가기 <ExternalLink className="opacity-60" />
                </a>
              </Button>
            )}
          </div>
          {connected && !sheetUrl && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              시트 바로가기를 쓰려면 Apps Script 에 최신 <span className="font-mono">apps-script/Code.gs</span> 를 붙여넣고
              <b className="text-foreground"> 배포 → 배포 관리 → 수정 → 새 버전</b>으로 다시 배포하세요(웹앱 URL 은 그대로).
            </p>
          )}
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
