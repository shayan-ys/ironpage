import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/version -> the deployed build's id, compared by lib/appupdate.ts
// with the id compiled into the running client.
export function GET() {
  return NextResponse.json(
    { buildId: process.env.GYM_BUILD_ID ?? "" },
    { headers: { "cache-control": "no-store" } },
  );
}
