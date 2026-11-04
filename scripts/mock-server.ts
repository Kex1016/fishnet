// The fixture server over HTTP: bun run mock [fresh|busy] [port]. Point CAKEUTILS_API_URL at it, or
// curl it with any token that looks like one (Authorization: Bearer cu_mock_mock).
import { handleMock } from "../src/lib/server/cakeutils/mock/handler.ts";
import { isScenario, worldOf } from "../src/lib/server/cakeutils/mock/index.ts";

const scenario = process.argv[2] ?? process.env.FISHNET_MOCK ?? "busy";
if (!isScenario(scenario)) {
  console.error(`unknown scenario ${scenario}: fresh or busy`);
  process.exit(2);
}
const port = Number(process.argv[3] ?? process.env.MOCK_PORT ?? 8085);
const world = worldOf(scenario);
Bun.serve({ port, fetch: (req) => handleMock(world, req) });
console.log(`cakeutils mock (${scenario}) on http://127.0.0.1:${port}/v2  (token: cu_mock_mock)`);
