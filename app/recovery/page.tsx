import { getOverview } from "@/lib/store";
import { recentDoses } from "@/lib/muscles";
import { recoveryBack } from "@/lib/page-data";
import { RecoveryClient } from "@/components/RecoveryClient";

export const dynamic = "force-dynamic";

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const [{ sessions }, { from }] = await Promise.all([getOverview(), searchParams]);
  return <RecoveryClient doses={recentDoses(sessions, Date.now())} back={recoveryBack(from)} />;
}
