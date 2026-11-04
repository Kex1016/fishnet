// Refreshes the committed openapi.json (PLAN §2.1) from cakeutils, then regenerates
// src/lib/api/schema.d.ts. Two sources:
//
//   bun run openapi                               # GET $CAKEUTILS_API_URL/v2/openapi.json with $CAKEUTILS_API_TOKEN
//   bun run openapi --from ../cakeutils/v2/openapi.yaml   # a cakeutils checkout (YAML or JSON)
//   add --check to only report the difference (exit 1 when there is one)
//
// The token is sent as a header and never printed; the URL is printed as scheme://host:port.
// schema.d.ts is a frozen contract: run this when the coordinator asks, and review the diff.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import YAML from "yaml";
import { displayUrl, tokenId } from "../src/lib/server/cakeutils/redact.ts";

const args = process.argv.slice(2);
const fromIdx = args.indexOf("--from");
const from = fromIdx >= 0 ? args[fromIdx + 1] : null;
const checkOnly = args.includes("--check");

type Doc = { info?: { version?: string }; paths?: Record<string, Record<string, unknown>>; components?: { schemas?: Record<string, unknown> } };

async function load(): Promise<Doc> {
  if (from) {
    const text = readFileSync(from, "utf8");
    return (from.endsWith(".json") ? JSON.parse(text) : YAML.parse(text)) as Doc;
  }
  const base = (process.env.CAKEUTILS_API_URL ?? "").replace(/\/+$/, "");
  const token = process.env.CAKEUTILS_API_TOKEN ?? "";
  if (!base || !token) {
    console.error("set CAKEUTILS_API_URL and CAKEUTILS_API_TOKEN, or pass --from <path to openapi.yaml|json>");
    process.exit(2);
  }
  console.log(`fetching openapi.json from ${displayUrl(base)} as ${tokenId(token)}`);
  const res = await fetch(`${base}/v2/openapi.json`, { headers: { authorization: `Bearer ${token}`, accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    console.error(`cakeutils answered ${res.status}`);
    process.exit(1);
  }
  return (await res.json()) as Doc;
}

const next = await load();
if (!next.paths || typeof next.paths !== "object") {
  console.error("not an OpenAPI document (no paths)");
  process.exit(1);
}
const prev = JSON.parse(readFileSync("openapi.json", "utf8")) as Doc;

const ops = (d: Doc) => new Set(Object.entries(d.paths ?? {}).flatMap(([p, m]) => Object.keys(m).filter((k) => !k.startsWith("x-") && k !== "parameters").map((k) => `${k.toUpperCase()} ${p}`)));
const schemas = (d: Doc) => d.components?.schemas ?? {};
const a = ops(prev);
const b = ops(next);
const added = [...b].filter((x) => !a.has(x));
const removed = [...a].filter((x) => !b.has(x));
const sa = schemas(prev);
const sb = schemas(next);
const schemaAdded = Object.keys(sb).filter((k) => !(k in sa));
const schemaRemoved = Object.keys(sa).filter((k) => !(k in sb));
const schemaChanged = Object.keys(sb).filter((k) => k in sa && JSON.stringify(sa[k]) !== JSON.stringify(sb[k]));

const lines = [
  `version ${prev.info?.version ?? "?"} → ${next.info?.version ?? "?"}`,
  ...added.map((x) => `+ ${x}`),
  ...removed.map((x) => `- ${x}`),
  ...schemaAdded.map((x) => `+ schema ${x}`),
  ...schemaRemoved.map((x) => `- schema ${x}`),
  ...schemaChanged.map((x) => `~ schema ${x}`)
];
const text = JSON.stringify(next, null, 2) + "\n";
const same = text === readFileSync("openapi.json", "utf8");
console.log(same ? "openapi.json is up to date" : lines.join("\n"));
if (checkOnly) process.exit(same ? 0 : 1);
if (!same) {
  writeFileSync("openapi.json", text);
  console.log("wrote openapi.json");
  const r = spawnSync("bun", ["scripts/gen-types.ts"], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
  console.log("review the diff of openapi.json and src/lib/api/schema.d.ts before committing");
}
