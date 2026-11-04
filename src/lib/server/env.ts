// Runtime configuration (PLAN §4), from src/env.ts through $app/env/private: read when the app starts,
// nothing baked into the build. The token is never logged or exported: only its public id
// (`cu_<id>`) leaves this module.
import {
  CAKEUTILS_API_TOKEN, CAKEUTILS_API_URL, CAKEUTILS_BURST, CAKEUTILS_RATE, FISHNET_ALLOW_MOCK, FISHNET_DATA_DIR, FISHNET_MOCK, HIDDEN_PLAYERS_FILE, NODE_ENV, ORIGIN
} from "$app/env/private";
import { building, dev } from "$app/env";
import type { Scenario } from "./cakeutils/mock/index.ts";

export { displayUrl, tokenId } from "./cakeutils/redact.ts";

export type Config = {
  apiUrl: string;
  /** mock scenario in use; null against a real cakeutils */
  mock: Scenario | null;
  /** requests per minute the site allows itself, below the token's own limit */
  ratePerMinute: number;
  /** how many requests may go out back to back (the bucket's size), below the token's burst */
  burst: number;
  origin: string;
  dataDir: string;
  hiddenPlayersFile: string;
  production: boolean;
};

let cached: Config | null = null;

export function config(): Config {
  if (cached) return cached;
  const production = !dev && NODE_ENV !== "test" && !FISHNET_ALLOW_MOCK;
  // PLAN §3.2: the production server refuses to start in mock mode.
  if (FISHNET_MOCK && production && !building) throw new Error("fishnet is NOT running: FISHNET_MOCK is set on a production build");
  cached = {
    apiUrl: CAKEUTILS_API_URL.replace(/\/+$/, ""),
    mock: FISHNET_MOCK,
    ratePerMinute: CAKEUTILS_RATE,
    burst: CAKEUTILS_BURST,
    origin: ORIGIN,
    dataDir: FISHNET_DATA_DIR,
    hiddenPlayersFile: HIDDEN_PLAYERS_FILE,
    production
  };
  return cached;
}

/** The bearer token, only for the client. Empty in mock mode is fine. */
export function apiToken(): string {
  return CAKEUTILS_API_TOKEN;
}
