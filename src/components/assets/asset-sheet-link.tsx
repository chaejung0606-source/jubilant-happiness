import Link from "next/link";
import { Sheet, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

/** 자산 헤더의 구글시트 바로가기.
 * 주소는 연결된 시트에서 자동으로 받는다(Apps Script `meta`) — 코드·화면에 직접 적지 않는다.
 * 주소를 못 받으면(미연동·구버전 Code.gs) 설정 > 데이터 연동 안내로 보낸다. */
export function AssetSheetLink({ url }: { url: string | null }) {
  if (url) {
    return (
      <Button asChild variant="outline" size="sm">
        <a href={url} target="_blank" rel="noopener noreferrer" title="자산 구글시트 열기 (새 탭)">
          <Sheet className="h-4 w-4" /> 구글시트 <ExternalLink className="opacity-60" />
        </a>
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" size="sm">
      <Link href="/settings" title="설정 > 데이터 연동에서 시트 연결 상태를 확인하세요">
        <Sheet className="h-4 w-4" /> 구글시트 연결
      </Link>
    </Button>
  );
}
