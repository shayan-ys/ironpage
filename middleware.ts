import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, sha256Hex } from "@/lib/token";

/**
 * Single-user password gate. The whole app sits behind one cookie whose value
 * is sha256(GYM_SECRET); /login sets it after checking the password. Scripts
 * and AI assistants still reach the API with the `x-gym-secret` header, so both the
 * browser (cookie) and the tooling (header) pass. If GYM_SECRET is unset (local
 * dev) the gate is a no-op, matching the API's existing convenience behaviour.
 *
 * Offline note: once authed, the service worker serves cached pages directly —
 * middleware only runs when the network (and thus the server) is reachable.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // The read-only secret must never fall through to full-secret or cookie auth.
  const readSecret = process.env.GYM_READ_SECRET;
  if (readSecret && req.headers.get("x-gym-secret") === readSecret) {
    const readOnlyRoute =
      req.method === "GET" &&
      (pathname === "/api/program" || /^\/api\/session\/[^/]+$/.test(pathname));
    if (readOnlyRoute) return NextResponse.next();
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const secret = process.env.GYM_SECRET;
  if (!secret) return NextResponse.next();

  // Always-open surface: the login flow itself and the PWA shell assets.
  if (
    pathname === "/login" ||
    pathname === "/api/login" ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/icon") ||
    pathname === "/program.schema.json" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Header auth for scripts (export / program edits / session deletes).
  if (req.headers.get("x-gym-secret") === secret) return NextResponse.next();

  const expected = await sha256Hex(secret);
  if (req.cookies.get(AUTH_COOKIE)?.value === expected) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next's static output (handled fast, no auth needed).
  matcher: ["/((?!_next/static|_next/image).*)"],
};
