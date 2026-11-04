// Regenerates the committed mock fixtures from the generators (deterministic). Run: bun run fixtures
import { writeFileSync } from "node:fs";
import { generateBusy, generateFresh } from "../src/lib/server/cakeutils/mock/world.ts";

const dir = "src/lib/server/cakeutils/mock/fixtures";
writeFileSync(`${dir}/fresh.json`, JSON.stringify(generateFresh(), null, 1) + "\n");
writeFileSync(`${dir}/busy.json`, JSON.stringify(generateBusy(), null, 1) + "\n");
console.log(`wrote ${dir}/fresh.json and ${dir}/busy.json`);
