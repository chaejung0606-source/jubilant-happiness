import { getAssets, getSheetUrl, sheetsConfigured } from "@/data";
import { AssetsClient } from "@/components/assets/assets-client";

export default async function AssetsPage() {
  const [assets, sheetUrl] = await Promise.all([getAssets(), getSheetUrl("assets")]);
  return <AssetsClient initial={assets} configured={sheetsConfigured()} sheetUrl={sheetUrl} />;
}
