import { getLoans, getAssets } from "@/data";
import { LoansClient } from "@/components/loans/loans-client";

export default async function LoansPage() {
  const [loans, assets] = await Promise.all([getLoans(), getAssets()]);
  const assetLite = assets.map((a) => ({ mgmtNo: a.mgmtNo, itemName: a.itemName }));
  return <LoansClient loans={loans} assets={assetLite} />;
}
