import { NextResponse } from "next/server";
import { checkSecret } from "@/lib/auth";
import { resolveIncoming } from "@/lib/defaults";
import { deleteSession, getSession, putSession } from "@/lib/store";
import type { Session } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/session/:id
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(session);
}

// PATCH /api/session/:id -> client sends the full session state; we persist it.
// The one thing the client cannot dictate is reopening: `resolveIncoming` keeps
// a closure the server already made while accepting the client's set data, so a
// write queued offline for days cannot resurrect a session that has since been
// finished or timed out. The stored result comes back in the response, which is
// how the device learns to free its local copy.
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const existing = await getSession(id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const incoming = (await req.json()) as Session;
  if (incoming.id !== id) {
    return NextResponse.json({ error: "id mismatch" }, { status: 400 });
  }
  const merged = resolveIncoming(existing, incoming);
  await putSession(merged);
  return NextResponse.json(merged);
}

// DELETE /api/session/:id -> remove a session entirely (revert/discard). Secret-gated.
export async function DELETE(req: Request, { params }: Ctx) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await deleteSession(id);
  return NextResponse.json({ ok: true });
}
