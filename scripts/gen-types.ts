// Regenerates src/lib/api/schema.d.ts from the committed openapi.json (PLAN §2.1, §3.2).
// W1's sync script refreshes openapi.json from a live proxy (GET /v2/openapi.json); this only
// turns the committed copy into TypeScript. Run: bun run types
import openapiTS, { astToString } from "openapi-typescript";
import { readFileSync, writeFileSync } from "node:fs";

const spec = JSON.parse(readFileSync("openapi.json", "utf8"));
const ast = await openapiTS(spec, { alphabetize: false, defaultNonNullable: true });
const header =
  "// Generated from openapi.json by scripts/gen-types.ts. Do not edit by hand: bun run types\n" +
  "// Milestones (cakeutils D-109) are not in the document yet; their types are hand-written in types.ts.\n\n";
writeFileSync("src/lib/api/schema.d.ts", header + astToString(ast));
console.log("wrote src/lib/api/schema.d.ts");
