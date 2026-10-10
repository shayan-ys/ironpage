"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { recentDoses } from "@/lib/muscles";
import { recoveryBack } from "@/lib/page-data";
import { getOverview } from "@/lib/demo/store";
import { useDemoStore } from "@/lib/demo/use-demo-store";
import { RecoveryClient } from "@/components/RecoveryClient";

function DemoRecovery() {
  const back = recoveryBack(useSearchParams().get("from"));
  const doses = useDemoStore(async () => recentDoses((await getOverview()).sessions, Date.now()));
  return doses ? <RecoveryClient doses={doses} back={back} /> : <main className="wrap" />;
}

/** The demo's readiness page: app/recovery/page.tsx over the browser store. */
export default function DemoRecoveryPage() {
  return (
    <Suspense fallback={<main className="wrap" />}>
      <DemoRecovery />
    </Suspense>
  );
}
