import { NextResponse, type NextRequest } from "next/server";
import { checkSecretOrSession } from "@/lib/auth";
import { getProgram, listSessions } from "@/lib/store";
import type { ExportBundle } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/export -> everything in one call: scripts and AI assistants with the
// header secret, or the settings page with the login cookie (same origin only).
export async function GET(req: NextRequest) {
  if (!(await checkSecretOrSession(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [program, sessions] = await Promise.all([getProgram(), listSessions()]);
  const bundle: ExportBundle = { program, sessions, generatedAt: new Date().toISOString() };
  return NextResponse.json(bundle);
}
