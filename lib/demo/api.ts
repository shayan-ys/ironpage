import type { ExportBundle, Session } from "../types";
import { newSession, resolveIncoming } from "../defaults";
import { validateProgram } from "../program-validate";
import * as store from "./store";

/**
 * The demo's `/api`: the app's own requests (`fetch("/api/…")` in DayCard,
 * `lib/localsync.ts`, settings) answered from the browser store instead of a
 * server. Each branch mirrors one route in `app/api/` and calls the same lib
 * functions; keep the two in step. There is nothing to authenticate, so the
 * secret checks are left out.
 */

const BASE_PATH = process.env.GYM_BASE_PATH ?? "";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/** Answer one `/api/…` request; `path` has the base path removed. */
export async function handleDemoApi(method: string, path: string, body: () => Promise<unknown>): Promise<Response> {
  if (path === "/api/session") {
    if (method === "GET") return json((await store.getOverview()).active);
    if (method === "POST") {
      const { dayId } = (await body()) as { dayId?: string };
      const program = await store.getProgram();
      if (!program) return json({ error: "no program" }, 409);
      const day = program.days.find((d) => d.id === dayId);
      if (!day) return json({ error: "unknown day" }, 400);
      const session = newSession(day, await store.listSessions(), program.unit);
      await store.putSession(session);
      return json(session);
    }
  }

  const sessionPath = /^\/api\/session\/([^/]+)$/.exec(path);
  if (sessionPath) {
    const id = decodeURIComponent(sessionPath[1]);
    if (method === "GET") {
      const session = await store.getSession(id);
      return session ? json(session) : json({ error: "not found" }, 404);
    }
    if (method === "PATCH") {
      const existing = await store.getSession(id);
      if (!existing) return json({ error: "not found" }, 404);
      const incoming = (await body()) as Session;
      if (incoming.id !== id) return json({ error: "id mismatch" }, 400);
      const merged = resolveIncoming(existing, incoming);
      await store.putSession(merged);
      return json(merged);
    }
    if (method === "DELETE") {
      await store.deleteSession(id);
      return json({ ok: true });
    }
  }

  if (path === "/api/program") {
    if (method === "GET") {
      const program = await store.getProgram();
      return program ? json(program) : json({ error: "no program" }, 404);
    }
    if (method === "PUT") {
      const result = validateProgram(await body());
      if (!result.ok) return json({ error: "invalid program", errors: result.errors }, 400);
      await store.putProgram(result.program);
      return json({ ok: true });
    }
  }

  if (path === "/api/export" && method === "GET") {
    const [program, sessions] = await Promise.all([store.getProgram(), store.listSessions()]);
    const bundle: ExportBundle = { program, sessions, generatedAt: new Date().toISOString() };
    return json(bundle);
  }
  if (path === "/api/version" && method === "GET") return json({ buildId: process.env.GYM_BUILD_ID ?? "" });
  if (path === "/api/login" && method === "POST") return json({ ok: true });

  return json({ error: "not found" }, 404);
}

/**
 * Route this page's same-origin `/api/…` requests (with or without the base
 * path) to `handleDemoApi`; everything else goes to the network. Idempotent.
 */
export function installDemoApi(): void {
  const original = window.fetch as typeof window.fetch & { demo?: true };
  if (original.demo) return;
  const shim = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request ? request.url : String(input), window.location.href);
    let path = url.pathname;
    if (BASE_PATH && path.startsWith(`${BASE_PATH}/`)) path = path.slice(BASE_PATH.length);
    if (url.origin !== window.location.origin || !path.startsWith("/api/")) return original(input, init);

    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    const body = async () => {
      const raw = init?.body ?? (request ? await request.text() : null);
      return typeof raw === "string" && raw !== "" ? JSON.parse(raw) : {};
    };
    return handleDemoApi(method, path.replace(/\/+$/, ""), body);
  };
  window.fetch = Object.assign(shim, { demo: true as const });
}
