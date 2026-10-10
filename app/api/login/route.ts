import { NextResponse } from "next/server";
import { AUTH_COOKIE, sha256Hex } from "@/lib/token";

export const dynamic = "force-dynamic";

// POST /api/login { password } -> sets the auth cookie when it matches GYM_SECRET.
export async function POST(req: Request) {
  const secret = process.env.GYM_SECRET;
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };

  // Local dev with no secret: nothing to guard, accept anything.
  if (!secret) return NextResponse.json({ ok: true });

  if (password !== secret) {
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }

  // `Secure` only over HTTPS (directly or behind a TLS proxy): a browser drops
  // a Secure cookie set over plain HTTP, which would lock out a LAN self-host.
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? new URL(req.url).protocol.replace(":", "");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await sha256Hex(secret), {
    httpOnly: true,
    secure: proto === "https",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // a year — this is a phone kept logged in
  });
  return res;
}
