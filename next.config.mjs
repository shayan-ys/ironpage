import { randomUUID } from "node:crypto";
import { PHASE_PRODUCTION_BUILD } from "next/constants.js";

// One id per build, shared by the server (`/api/version`) and the client
// bundle so the app can tell when a newer build is deployed (lib/appupdate.ts).
// Stored on process.env because `next build` re-reads this file in its worker
// processes, which inherit the parent's environment; a fresh id per read would
// split one build into several ids and make every page look out of date.
process.env.GYM_BUILD_ID ||= randomUUID();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Separate build directories let two `next` processes share one checkout.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  generateBuildId: () => process.env.GYM_BUILD_ID,
  env: { GYM_BUILD_ID: process.env.GYM_BUILD_ID, GYM_BASE_PATH: "" },
};

/**
 * The browser-only demo (`npm run demo:build`, see scripts/demo.mjs and
 * lib/demo/). Only `*.demo.tsx` files are routes in this mode, so the server
 * pages, the API routes and the middleware are left out and the production
 * build never sees the demo routes. It is served at `<PAGES_BASE_PATH>/demo/`,
 * under the landing page in site/.
 *
 * @param {string} phase
 * @returns {import('next').NextConfig}
 */
function demoConfig(phase) {
  const basePath = `${(process.env.PAGES_BASE_PATH ?? "").replace(/\/+$/, "")}/demo`;
  return {
    ...nextConfig,
    output: "export",
    pageExtensions: ["demo.tsx", "demo.ts"],
    basePath,
    trailingSlash: true,
    // With `output: "export"`, a custom distDir is where Next writes the
    // static site, and the build itself always goes to `.next`. `next dev`
    // keeps the usual per-process build directory.
    distDir: phase === PHASE_PRODUCTION_BUILD ? "out/demo" : nextConfig.distDir,
    env: { ...nextConfig.env, GYM_BASE_PATH: basePath },
  };
}

/** @param {string} phase */
export default function config(phase) {
  return process.env.NEXT_PUBLIC_DEMO === "1" ? demoConfig(phase) : nextConfig;
}
