// End-to-end checks in a real browser (PLAN §7, W10). Not part of `bun test`: it needs the production
// build and Playwright with Chromium on the machine (the cloud container has both; Playwright is not
// a dependency of the site).
//
//   bun run build
//   bun run e2e                                   # boots build/ on the busy and the fresh fixtures, runs every check
//   bun run e2e --scenario fresh                  # one scenario
//   bun run e2e --base https://fishnet.haiiro.moe # the live site: only the checks that hold on any real network
//   bun run e2e --base http://127.0.0.1:3101 --scenario busy   # a server you started yourself
//
// Prints one line per check and a PASS/FAIL summary; exit 1 on any failure. The scenario servers run
// on ports 3111 (busy) and 3112 (fresh) with a throwaway data directory; --port changes the first.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CHECKS } from "./checks.ts";
import { CheckError, Ctx, type Browser, type Scenario } from "./ctx.ts";

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const base = opt("base");
const firstPort = Number(opt("port") ?? 3111);
const only = opt("only");
const scenarios = (opt("scenario")?.split(",") ?? (base ? ["live"] : ["busy", "fresh"])) as Scenario[];
for (const s of scenarios) if (!["busy", "fresh", "live"].includes(s)) throw new Error(`unknown scenario ${s}`);
if (!base && !existsSync("build/index.js")) {
  console.error("e2e: build/index.js is missing; run `bun run build` first");
  process.exit(2);
}

type Server = { proc: ReturnType<typeof Bun.spawn>; dir: string; base: string };

async function start(scenario: Scenario, port: number): Promise<Server> {
  const dir = mkdtempSync(join(tmpdir(), `fishnet-e2e-${scenario}-`));
  const proc = Bun.spawn(["node", "build/index.js"], {
    env: { ...process.env, FISHNET_MOCK: scenario, FISHNET_ALLOW_MOCK: "1", PORT: String(port), HOST: "127.0.0.1", FISHNET_DATA_DIR: dir, HIDDEN_PLAYERS_FILE: join(dir, "hidden.txt") },
    stdout: "pipe",
    stderr: "pipe"
  });
  const url = `http://127.0.0.1:${port}`;
  const until = Date.now() + 30_000;
  while (Date.now() < until) {
    try {
      if ((await fetch(`${url}/healthz`)).ok) return { proc, dir, base: url };
    } catch {
      /* not up yet */
    }
    if (proc.exitCode !== null) break;
    await Bun.sleep(250);
  }
  const err = await new Response(proc.stderr as ReadableStream).text();
  proc.kill();
  throw new Error(`the ${scenario} server did not come up on ${url}\n${err.slice(-2000)}`);
}

async function stop(s: Server) {
  s.proc.kill();
  await s.proc.exited;
  rmSync(s.dir, { recursive: true, force: true });
}

// Playwright is resolved at run time only (not a dependency; svelte-check must not look for it).
const playwright = "playwright";
const { chromium } = (await import(playwright)) as { chromium: { launch(): Promise<Browser> } };
const browser = await chromium.launch();

let failed = 0;
let passed = 0;
const lines: string[] = [];
try {
  for (const scenario of scenarios) {
    let server: Server | null = null;
    const siteBase = base ?? (server = await start(scenario, firstPort + scenarios.indexOf(scenario))).base;
    const ctx = new Ctx(siteBase, scenario, browser);
    console.log(`\n${scenario} at ${siteBase}`);
    try {
      for (const check of CHECKS) {
        if (!check.on.includes(scenario)) continue;
        if (only && !check.name.includes(only)) continue;
        const t0 = performance.now();
        try {
          const note = await check.run(ctx);
          passed++;
          console.log(`  ok    ${check.name}${note ? `  (${note})` : ""}  ${Math.round(performance.now() - t0)} ms`);
        } catch (e) {
          failed++;
          const msg = e instanceof CheckError ? e.message : `threw: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`;
          console.log(`  FAIL  ${check.name}: ${msg}`);
          lines.push(`${scenario}: ${check.name}: ${msg.split("\n")[0]}`);
        }
      }
    } finally {
      if (server) await stop(server);
    }
  }
} finally {
  await browser.close();
}

console.log(`\ne2e ${failed ? "FAIL" : "PASS"}: ${passed} passed, ${failed} failed, scenarios ${scenarios.join(", ")}`);
for (const l of lines) console.log(`  - ${l}`);
process.exit(failed ? 1 : 0);
