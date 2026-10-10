"use client";

import { overviewData } from "@/lib/page-data";
import { getOverview, getProgram } from "@/lib/demo/store";
import { useDemoStore } from "@/lib/demo/use-demo-store";
import { Overview } from "@/components/Overview";

async function load() {
  const [program, { active, sessions }] = await Promise.all([getProgram(), getOverview()]);
  return { program, active, ...overviewData(sessions, Date.now()) };
}

/** The demo's overview: app/page.tsx over the browser store. */
export default function DemoOverviewPage() {
  const data = useDemoStore(load);
  return data ? <Overview {...data} /> : <main className="wrap" />;
}
