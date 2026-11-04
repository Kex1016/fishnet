# fishnet

The Fishplex network website: who is on, the servers, players and their stats, leaderboards and
milestones, from the cakeutils v2 API. Public, read-only, server-rendered (SvelteKit + Node), with its
own recorder for charts over time. Spec: `docs/PLAN.md`. Engineering notes: `CLAUDE.md`.

## Run it

```sh
bun install
FISHNET_MOCK=busy bun run dev      # against fixtures; FISHNET_MOCK=fresh for an empty network
cp .env.example .env               # then set CAKEUTILS_API_URL and CAKEUTILS_API_TOKEN
bun run build && node build/index.js
```

Docker: `docker compose up -d --build` serves on `127.0.0.1:3000` for Caddy (`deploy/`, W9, and the
operator docs, W9b, are on their way).
