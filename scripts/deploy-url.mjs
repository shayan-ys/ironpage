// Builds the "Deploy to Vercel" clone URL for this repository.
// `npm run deploy-url` prints it; scripts/demo.mjs puts it on the landing page.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** `git+https://github.com/o/r.git` -> `https://github.com/o/r`. */
export function normaliseRepoUrl(url) {
  return String(url)
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
}

/** Last path segment of the repository URL, e.g. `ironpage`. */
export function repoSlug(url) {
  return normaliseRepoUrl(url).split("/").pop();
}

/** @param {string} repoUrl a repository URL (normalised or not) */
export function deployUrl(repoUrl) {
  const repo = normaliseRepoUrl(repoUrl);
  const slug = repoSlug(repo);
  const enc = encodeURIComponent;
  return (
    "https://vercel.com/new/clone" +
    `?repository-url=${enc(repo)}` +
    `&project-name=${enc(slug)}` +
    `&repository-name=${enc(slug)}` +
    "&env=GYM_SECRET" +
    `&envDescription=${enc("Password for the app login screen and the x-gym-secret API header.")}` +
    `&envLink=${enc(`${repo}#configuration`)}` +
    `&stores=${enc(JSON.stringify([{ type: "blob", access: "private" }]))}`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  console.log(deployUrl(pkg.repository.url));
}
