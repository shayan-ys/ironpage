"use client";

import { Suspense } from "react";
import { notFound, useSearchParams } from "next/navigation";
import { sessionProps } from "@/lib/page-data";
import { getProgram, getSession, listSessions } from "@/lib/demo/store";
import { useDemoStore } from "@/lib/demo/use-demo-store";
import { SessionClient } from "@/components/SessionClient";

async function load(id: string) {
  const [session, program, all] = await Promise.all([getSession(id), getProgram(), listSessions()]);
  return session ? { session, ...sessionProps(session, program, all) } : null;
}

function DemoSession() {
  // A static export has no dynamic routes, so the id rides in the query
  // (`sessionHref` in lib/page-data.ts).
  const id = useSearchParams().get("id") ?? "";
  const data = useDemoStore(() => load(id), id);
  if (data === undefined) return <main className="wrap" />;
  if (data === null) notFound();
  const { session, ...props } = data;
  // SessionClient reads `initial` once on mount; the key gives each session its own.
  return <SessionClient key={session.id} initial={session} {...props} />;
}

/** The demo's session screen: app/session/[id]/page.tsx over the browser store. */
export default function DemoSessionPage() {
  return (
    <Suspense fallback={<main className="wrap" />}>
      <DemoSession />
    </Suspense>
  );
}
