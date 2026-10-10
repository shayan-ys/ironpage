import { NextResponse, type NextRequest } from "next/server";
import { checkSecretOrSession } from "@/lib/auth";
import { getProgram, putProgram } from "@/lib/store";
import { validateProgram } from "@/lib/program-validate";

export const dynamic = "force-dynamic";

// GET /api/program -> the plan (used by the overview screen).
export async function GET() {
  const program = await getProgram();
  if (!program) return NextResponse.json({ error: "no program" }, { status: 404 });
  return NextResponse.json(program);
}

// PUT /api/program -> replace the plan: scripts or an AI assistant with the
// header secret, or the settings page with the login cookie (same origin only).
// The body must pass `validateProgram`; a 400 lists every problem by path.
export async function PUT(req: NextRequest) {
  if (!(await checkSecretOrSession(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body: unknown = await req.json().catch(() => undefined);
  if (body === undefined) {
    return NextResponse.json({ error: "invalid program", errors: ["body: not valid JSON"] }, { status: 400 });
  }
  const result = validateProgram(body);
  if (!result.ok) {
    return NextResponse.json({ error: "invalid program", errors: result.errors }, { status: 400 });
  }
  await putProgram(result.program);
  return NextResponse.json({ ok: true });
}
