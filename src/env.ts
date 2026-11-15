// Environment variables (SvelteKit 3: $app/env/private, read when the app starts, never inlined).
// PLAN §4. The token is private and never reaches the client bundle (scripts/leakcheck.ts checks).
import { defineEnvVars } from "@sveltejs/kit/env";

const str = (fallback: string) => (v: string | undefined) => (v === undefined || v === "" ? fallback : v);

export const variables = defineEnvVars({
  CAKEUTILS_API_URL: { schema: str("http://127.0.0.1:8085"), description: "The cakeutils v2 API (scheme://host:port)" },
  CAKEUTILS_API_TOKEN: { schema: str(""), description: "Bearer token with read:players read:stats; never logged" },
  CAKEUTILS_RATE: {
    schema: (v) => {
      const n = v ? Number(v) : 400;
      if (!Number.isInteger(n) || n < 1) throw new Error("CAKEUTILS_RATE must be a positive integer (requests per minute)");
      return n;
    },
    description: "Requests per minute the site allows itself"
  },
  CAKEUTILS_BURST: {
    schema: (v) => {
      const n = v ? Number(v) : 60;
      if (!Number.isInteger(n) || n < 1) throw new Error("CAKEUTILS_BURST must be a positive integer (requests)");
      return n;
    },
    description: "Requests the site may send back to back, below the token's burst"
  },
  CAKEUTILS_MAP_RATE: {
    schema: (v) => {
      const n = v ? Number(v) : 900;
      if (!Number.isInteger(n) || n < 1) throw new Error("CAKEUTILS_MAP_RATE must be a positive integer (requests per minute)");
      return n;
    },
    description: "Map requests per minute the site allows itself (tiles, positions, changes), below cakeutils' map bucket (1200)"
  },
  CAKEUTILS_MAP_BURST: {
    schema: (v) => {
      const n = v ? Number(v) : 200;
      if (!Number.isInteger(n) || n < 1) throw new Error("CAKEUTILS_MAP_BURST must be a positive integer (requests)");
      return n;
    },
    description: "Map requests the site may send back to back, below cakeutils' map burst (300)"
  },
  MAP_CACHE_MAX_MB: {
    schema: (v) => {
      const n = v ? Number(v) : 2048;
      if (!Number.isInteger(n) || n < 1) throw new Error("MAP_CACHE_MAX_MB must be a positive integer (MiB)");
      return n;
    },
    description: "Disk the map tile cache may use under FISHNET_DATA_DIR/map, in MiB"
  },
  MAP_SSE_MAX: {
    schema: (v) => {
      const n = v ? Number(v) : 500;
      if (!Number.isInteger(n) || n < 1) throw new Error("MAP_SSE_MAX must be a positive integer (streams)");
      return n;
    },
    description: "Live map streams open at once, all visitors together"
  },
  ORIGIN: { schema: str("http://localhost:3000"), description: "Public origin" },
  FISHNET_DATA_DIR: { schema: str("data"), description: "Recorder SQLite file and caches" },
  HIDDEN_PLAYERS_FILE: { schema: str("data/hidden-players.txt"), description: "Opted-out players, one per line" },
  HIDDEN_SERVERS_FILE: { schema: str("data/hidden-servers.txt"), description: "Servers the site never shows, one id per line" },
  FISHNET_ADMIN_TOKEN: {
    schema: str(""),
    description: "Site-side admin secret (not the cakeutils token), at least 24 characters; unset = no /admin; never logged"
  },
  FISHNET_MOCK: {
    schema: (v) => {
      const m = v?.trim();
      if (!m || m === "0" || m === "false") return null;
      if (m === "1" || m === "true" || m === "busy") return "busy" as const;
      if (m === "fresh") return "fresh" as const;
      throw new Error(`FISHNET_MOCK must be fresh or busy, not "${m}"`);
    },
    description: "Answer from fixtures instead of cakeutils (development only)"
  },
  FISHNET_ALLOW_MOCK: { schema: (v) => v === "1", description: "Let a production build run in mock mode (tests only)" },
  NODE_ENV: { schema: str(""), description: "Node's environment name" }
});
