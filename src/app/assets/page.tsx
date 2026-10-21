import { getAssets, sheetsConfigured } from "@/data";
import { AssetsClient } from "@/components/assets/assets-client";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const assets = await getAssets();
  return <AssetsClient initial={assets} configured={sheetsConfigured()} />;
}
