import "server-only";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, sha256Hex } from "./token";

/**
 * Guards the external endpoints scripts or an AI assistant use: the
 * `x-gym-secret` header must equal GYM_SECRET. Session mutation endpoints stay
 * open for same-origin UI use; this is a single-user app and the secret only
 * fences the analyze/edit surface.
 *
 * If GYM_SECRET is unset (local dev), the guard is a no-op for convenience.
 */
export function checkSecret(req: Request): boolean {
  const expected = process.env.GYM_SECRET;
  if (!expected) return true;
  return req.headers.get("x-gym-secret") === expected;
}

/**
 * `checkSecret`, or the login cookie on a same-origin request: what the
 * settings page uses for `PUT /api/program` and `GET /api/export`. The origin
 * check keeps a page on another origin that the browser sends the cookie for
 * (a sibling subdomain is same-site, so SameSite=Lax still sends it) from
 * replacing the program or reading every workout.
 */
export async function checkSecretOrSession(req: NextRequest): Promise<boolean> {
  const secret = process.env.GYM_SECRET;
  if (!secret || req.headers.get("x-gym-secret") === secret) return true;
  return req.cookies.get(AUTH_COOKIE)?.value === (await sha256Hex(secret)) && isSameOrigin(req);
}

/**
 * Same-origin by `Sec-Fetch-Site` when the browser sends it, otherwise by an
 * `Origin` matching the host the request reached. A request carrying neither
 * is not from a browser page and must use the header secret.
 */
function isSameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  try {
    return new URL(origin).host === host.split(",")[0].trim();
  } catch {
    return false;
  }
}

