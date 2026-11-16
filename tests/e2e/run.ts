// End-to-end checks in a real browser (PLAN §7, W10). Not part of `bun test`: it needs the production
// build and Playwright with Chromium on the machine (the cloud container has both; Playwright is not
// a dependency of the site).
//
//   bun run build
//   bun run e2e                                   # boots build/ on the busy and the fresh fixtures, runs every check
//   bun run e2e --scenario fresh                  # one scenario
//   bun run e2e --base https://fishnet.haiiro.moe # the live site: only the checks that hold on any real network
//   bun run e2e --base http://127.0.0.1:3101 --scenario busy   # a server you started yourself
//   bun run e2e --only map                        # the checks whose name contains "map"
//   bun run e2e --base https://fishnet.haiiro.moe --only "map markers" --hidden staff   # the markers checks on the live site (map-markers.ts)
//   bun run e2e --base https://fishnet.haiiro.moe --hidden quietgill,staff   # names that must never show there
//   bun run e2e --base https://fishnet.haiiro.moe --abuse     # also opens 600 streams from this host (map.ts)
//
// Prints one line per check and a PASS/FAIL summary; exit 1 on any failure. The scenario servers run
// on ports 3111 (busy) and 3112 (fresh) with a throwaway data directory; --port changes the first. Some map
// checks start a site of their own (other limits, the fixture server over HTTP) on the ports after those.
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CHECKS as SITE_CHECKS } from "./checks.ts";
import { MAP_CHECKS } from "./map.ts";
import { MARKER_CHECKS } from "./map-markers.ts";
import { CheckError, Ctx, type Boot, type Booted, type Browser, type Scenario } from "./ctx.ts";

const CHECKS = [...SITE_CHECKS, ...MAP_CHECKS, ...MARKER_CHECKS];

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

type Server = { proc: ReturnType<typeof Bun.spawn>; dir: string; base: string; logs: () => string };

/**
 * Starts the production build: on a mock scenario's fixtures, or (mock null) on whatever `env` points it at.
 * `files` are written into its data directory first (the hide lists, read when the site starts).
 */
async function start(mock: Scenario | null, port: number, env: Record<string, string> = {}, files: Record<string, string> = {}): Promise<Server> {
  const dir = mkdtempSync(join(tmpdir(), `fishnet-e2e-${mock ?? "wire"}-`));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  const base: Record<string, string | undefined> = { ...process.env, PORT: String(port), HOST: "127.0.0.1", FISHNET_DATA_DIR: dir, HIDDEN_PLAYERS_FILE: join(dir, "hidden.txt"), HIDDEN_SERVERS_FILE: join(dir, "hidden-servers.txt") };
  if (mock) Object.assign(base, { FISHNET_MOCK: mock, FISHNET_ALLOW_MOCK: "1" });
  else {
    delete base.FISHNET_MOCK;
    delete base.FISHNET_ALLOW_MOCK;
  }
  Object.assign(base, env);
  const proc = Bun.spawn(["node", "build/index.js"], { env: base, stdout: "pipe", stderr: "pipe" });
  // the output is read as it comes (a full pipe would stop the site) and kept for the checks that read the log
  let out = "";
  const drain = async (stream: ReadableStream<Uint8Array>) => {
    const dec = new TextDecoder();
    const reader = stream.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        out += dec.decode(value, { stream: true });
      }
    } catch {
      /* the process went away */
    }
  };
  void drain(proc.stdout as ReadableStream<Uint8Array>);
  void drain(proc.stderr as ReadableStream<Uint8Array>);
  const url = `http://127.0.0.1:${port}`;
  const until = Date.now() + 30_000;
  while (Date.now() < until) {
    try {
      if ((await fetch(`${url}/healthz`)).ok) return { proc, dir, base: url, logs: () => out };
    } catch {
      /* not up yet */
    }
    if (proc.exitCode !== null) break;
    await Bun.sleep(250);
  }
  proc.kill();
  rmSync(dir, { recursive: true, force: true });
  throw new Error(`the ${mock ?? "wire"} server did not come up on ${url}\n${out.slice(-2000)}`);
}

async function stop(s: Server) {
  s.proc.kill();
  await s.proc.exited;
  rmSync(s.dir, { recursive: true, force: true });
}

// sites a check starts for itself: the ports after the scenarios', stopped by the check (and here, if it forgot)
let nextPort = firstPort + 10;
const extras = new Set<Server>();
const boot: Boot = async (env, opt = {}): Promise<Booted> => {
  const s = await start(opt.mock === undefined ? "busy" : opt.mock, nextPort++, env, opt.files);
  extras.add(s);
  return {
    base: s.base,
    dir: s.dir,
    logs: s.logs,
    stop: async () => {
      if (extras.delete(s)) await stop(s);
    }
  };
};

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
    const names = opt("hidden")?.split(",").map((n) => n.trim()).filter(Boolean) ?? [];
    const hidden = names.length ? new RegExp(names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i") : undefined;
    const ctx = new Ctx(siteBase, scenario, browser, base ? null : boot, hidden, { abuse: args.includes("--abuse") });
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
      for (const s of [...extras]) {
        extras.delete(s);
        await stop(s);
      }
      if (server) await stop(server);
    }
  }
} finally {
  await browser.close();
}

console.log(`\ne2e ${failed ? "FAIL" : "PASS"}: ${passed} passed, ${failed} failed, scenarios ${scenarios.join(", ")}`);
for (const l of lines) console.log(`  - ${l}`);
process.exit(failed ? 1 : 0);
