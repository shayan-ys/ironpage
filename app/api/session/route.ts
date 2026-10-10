import { NextResponse } from "next/server";
import { newSession } from "@/lib/defaults";
import { getOverview, getProgram, listSessions, putSession } from "@/lib/store";

export const dynamic = "force-dynamic";

// GET /api/session -> the current unfinished session, or null. Reading this also
// retires any session that has been idle past ABANDON_AFTER_MS (see getOverview).
export async function GET() {
  return NextResponse.json((await getOverview()).active);
}

// POST /api/session { dayId } -> start a session from a program day.
export async function POST(req: Request) {
  const { dayId } = (await req.json()) as { dayId?: string };
  const program = await getProgram();
  if (!program) return NextResponse.json({ error: "no program" }, { status: 409 });
  const day = program.days.find((d) => d.id === dayId);
  if (!day) return NextResponse.json({ error: "unknown day" }, { status: 400 });

  const session = newSession(day, await listSessions(), program.unit);
  await putSession(session);
  return NextResponse.json(session);
}
