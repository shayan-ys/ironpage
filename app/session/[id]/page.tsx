import { notFound } from "next/navigation";
import { getProgram, getSession, listSessions } from "@/lib/store";
import { sessionProps } from "@/lib/page-data";
import { SessionClient } from "@/components/SessionClient";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, program, all] = await Promise.all([getSession(id), getProgram(), listSessions()]);
  if (!session) notFound();
  return <SessionClient initial={session} {...sessionProps(session, program, all)} />;
}
