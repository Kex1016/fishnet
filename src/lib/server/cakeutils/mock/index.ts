// Mock mode (PLAN §3.2): FISHNET_MOCK=fresh|busy makes the client answer from fixtures in-process,
// no network. `bun run mock` serves the same handler over HTTP for curl and e2e tests.
import type { World, Scenario } from "./world.ts";
import { handleMock } from "./handler.ts";
import busy from "./fixtures/busy.json" with { type: "json" };
import fresh from "./fixtures/fresh.json" with { type: "json" };

export type { Scenario, World };

export const SCENARIOS: readonly Scenario[] = ["fresh", "busy"] as const;

export function isScenario(s: string | undefined | null): s is Scenario {
  return s === "fresh" || s === "busy";
}

export function worldOf(scenario: Scenario): World {
  return (scenario === "busy" ? busy : fresh) as unknown as World;
}

/** A `fetch` that answers from the scenario, for the client's `fetchImpl`. */
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function mockFetch(scenario: Scenario): FetchLike {
  const world = worldOf(scenario);
  return (input, init) => handleMock(world, new Request(input, init));
}
