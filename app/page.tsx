import { getOverview, getProgram } from "@/lib/store";
import { overviewData } from "@/lib/page-data";
import { Overview } from "@/components/Overview";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [program, { active, sessions }] = await Promise.all([getProgram(), getOverview()]);
  return <Overview program={program} active={active} {...overviewData(sessions, Date.now())} />;
}
