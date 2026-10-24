#!/usr/bin/env node
/**
 * Usage: node packages/security-lab/dist/cli.js <reports-dir> <out.json>
 *
 * Reads the raw runner output in <reports-dir> (see scripts/security-report.sh), writes the
 * Security Lab report, prints a summary, and exits 1 if any test failed or was missing.
 * In GitHub Actions the report names the run and commit; elsewhere it is marked as a local run.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { arch, platform } from "node:os";
import { dirname, join } from "node:path";

import type { SecurityReport } from "@spact/shared";

import { buildReport } from "./report.js";

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch {
    return null;
  }
}

function source(env: NodeJS.ProcessEnv): SecurityReport["source"] {
  const commit = env.SPACT_COMMIT || env.GITHUB_SHA || git(["rev-parse", "HEAD"]);
  const sha = commit && /^[0-9a-f]{40}$/.test(commit) ? commit : null;
  if (env.GITHUB_ACTIONS === "true" && env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID) {
    const repo = `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}`;
    return {
      kind: "ci",
      commit: sha,
      commit_url: sha ? `${repo}/commit/${sha}` : null,
      run_url: `${repo}/actions/runs/${env.GITHUB_RUN_ID}`,
      runner: `GitHub Actions, ${env.RUNNER_OS ?? "unknown OS"} ${env.RUNNER_ARCH ?? ""}`.trim(),
    };
  }
  // tracked files that differ from the commit: the commit alone is not what was tested
  const dirty = git(["status", "--porcelain", "--untracked-files=no"]) !== null;
  const remote = git(["remote", "get-url", "origin"]);
  const github = remote ? /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(remote) : null;
  return {
    kind: "local",
    commit: sha,
    commit_url: sha && github ? `https://github.com/${github[1]}/commit/${sha}` : null,
    run_url: null,
    runner: `local run on ${platform()} ${arch()}${dirty ? ", with uncommitted changes" : ""}`,
  };
}

const [dir, out] = process.argv.slice(2);
if (!dir || !out) {
  console.error("usage: cli.js <reports-dir> <out.json>");
  process.exit(2);
}

const files = new Map<string, string>();
if (existsSync(dir)) for (const name of readdirSync(dir)) files.set(name, readFileSync(join(dir, name), "utf8"));

const toolchain: Record<string, string> = { node: process.version };
const rustc = files.get("rustc-version.txt")?.trim();
if (rustc) toolchain.rustc = rustc.replace(/^rustc /, "").slice(0, 200);

const { report, problems } = buildReport(files, { now: new Date(), source: source(process.env), toolchain });
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);

for (const c of report.cases) console.log(`${c.id}  ${c.status.padEnd(16)}  ${c.attack}`);
console.log(`\nwrote ${out} (${report.source.kind} run, commit ${report.source.commit ?? "unknown"})`);
if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
