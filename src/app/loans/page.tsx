import { ArrowLeftRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SoftCard } from "@/components/cards/soft-card";
import { StatusBadge } from "@/components/badges/status-badge";
import { getLoans } from "@/data";

export default async function LoansPage() {
  const LOANS = await getLoans();
  return (
    <>
      <PageHeader title="대여" description="노트북·자산 대여 현황" icon={<ArrowLeftRight className="h-6 w-6" />} />
      <SoftCard padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">관리번호</th>
                <th className="px-5 py-3 font-medium">품명</th>
                <th className="px-5 py-3 font-medium">대여자</th>
                <th className="px-5 py-3 font-medium">소속</th>
                <th className="px-5 py-3 font-medium">반납예정</th>
                <th className="px-5 py-3 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {LOANS.map((l) => (
                <tr key={l.mgmtNo + l.borrower} className="border-b border-black/[0.04] hover:bg-accent/60">
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-[13px] text-foreground/80">{l.mgmtNo}</td>
                  <td className="px-5 py-3 font-medium text-foreground">{l.itemName}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-foreground/80">{l.borrower}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{l.affiliation}</td>
                  <td className="whitespace-nowrap px-5 py-3 tabular-nums text-muted-foreground">{l.dueAt}</td>
                  <td className="px-5 py-3"><StatusBadge label={l.overdue ? "연체" : "대여중"} tone={l.overdue ? "coral" : "sky"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SoftCard>
    </>
  );
}
