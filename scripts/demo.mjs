// Builds the GitHub Pages site: the browser-only demo (next export) under
// `out/demo/` plus the static landing page from `site/` at `out/`.
//
//   node scripts/demo.mjs               full build
//   node scripts/demo.mjs --site-only   only copy + fill in the landing page
//   node scripts/demo.mjs --serve       serve out/ under the base path locally
//
// PAGES_BASE_PATH defaults to `/<repo slug>`, like a project page on GitHub.
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deployUrl, normaliseRepoUrl, repoSlug } from "./deploy-url.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "out");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const repo = normaliseRepoUrl(pkg.repository.url);
// Absolute, with a trailing slash: the OG image and canonical link need a full URL.
const homepage = `${pkg.homepage.replace(/\/+$/, "")}/`;
const basePath = (process.env.PAGES_BASE_PATH ?? `/${repoSlug(repo)}`).replace(/\/+$/, "");
const args = new Set(process.argv.slice(2));

function build() {
  rmSync(out, { recursive: true, force: true });
  const res = spawnSync("npx", ["--no-install", "next", "build"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_DEMO: "1", PAGES_BASE_PATH: basePath, NEXT_DIST_DIR: ".next-demo" },
  });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function* htmlFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* htmlFiles(p);
    else if (name.endsWith(".html")) yield p;
  }
}

function buildSite() {
  mkdirSync(out, { recursive: true });
  cpSync(join(root, "site"), out, { recursive: true });
  const media = join(root, "docs", "media");
  if (existsSync(media)) cpSync(media, join(out, "media"), { recursive: true });

  const values = {
    NAME: pkg.displayName ?? pkg.name,
    TAGLINE: pkg.description ?? "",
    REPO_URL: repo,
    DEPLOY_URL: deployUrl(repo),
    HOMEPAGE: homepage,
    OG_IMAGE: `${homepage}media/social.png`,
  };
  for (const file of htmlFiles(out)) {
    if (file.startsWith(join(out, "demo") + "/")) continue;
    const html = readFileSync(file, "utf8").replace(/\{\{([A-Z_]+)\}\}/g, (m, key) =>
      key in values ? escapeHtml(values[key]) : m,
    );
    writeFileSync(file, html);
  }
  writeFileSync(join(out, ".nojekyll"), "");
}

function serve() {
  if (!existsSync(out)) {
    console.error("out/ is missing: run `npm run demo:build` first.");
    process.exit(1);
  }
  const tmp = mkdtempSync(join(tmpdir(), "ironpage-demo-"));
  const link = join(tmp, basePath);
  mkdirSync(dirname(link), { recursive: true });
  symlinkSync(out, link, "dir");
  const port = process.env.PORT ?? "4173";
  console.log(`Serving out/ at http://localhost:${port}${basePath}/`);
  const child = spawn("python3", ["-m", "http.server", port, "-d", tmp], { stdio: "inherit" });
  const stop = () => {
    child.kill();
    rmSync(tmp, { recursive: true, force: true });
  };
  child.on("exit", () => {
    rmSync(tmp, { recursive: true, force: true });
    process.exit(0);
  });
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, stop);
}

if (args.has("--serve")) {
  serve();
} else {
  if (!args.has("--site-only")) build();
  buildSite();
  console.log(`Site written to ${out} (base path "${basePath}")`);
}
