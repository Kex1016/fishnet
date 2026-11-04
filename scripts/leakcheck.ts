// The token leak check (PLAN §5): fails the build when a token, the token's env name or the fixture
// server's pretend token can be found in anything the browser gets (build/client/). Runs at the end
// of `bun run build`; also: bun run leakcheck
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ?? "build/client";
const needles = ["CAKEUTILS_API_TOKEN", "cu_mock_mock", "Bearer cu_"];
const token = process.env.CAKEUTILS_API_TOKEN;
if (token && token.length >= 8) needles.push(token);
const pattern = /\bcu_[A-Za-z0-9]{2,}_[A-Za-z0-9_-]{8,}/;

let files = 0;
const hits: string[] = [];
function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (/\.(js|mjs|css|html|json|txt|map|svg|webmanifest)$/.test(name)) {
      files++;
      const text = readFileSync(p, "utf8");
      for (const n of needles) if (text.includes(n)) hits.push(`${p}: contains ${n === token ? "the API token" : JSON.stringify(n)}`);
      const m = pattern.exec(text);
      if (m) hits.push(`${p}: looks like a token (${m[0].slice(0, 12)}…)`);
      if (name.endsWith(".map")) hits.push(`${p}: a source map is shipped to the client`);
    }
  }
}
try {
  walk(root);
} catch (e) {
  console.error(`leakcheck: cannot read ${root}: ${(e as Error).message}`);
  process.exit(2);
}
if (hits.length) {
  console.error(`leakcheck FAIL (${files} files):\n  ${hits.join("\n  ")}`);
  process.exit(1);
}
console.log(`leakcheck PASS: ${files} client files, no token`);
