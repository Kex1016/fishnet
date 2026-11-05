# fishnet

Fishnet, the website for the Fishplex network: who is on, the servers, players and their stats, leaderboards,
milestones and advancements, from the cakeutils v2 API. Public, read-only, server-rendered (SvelteKit + Node), with its
own recorder for charts over time.

- `docs/PLAN.md`: the spec (architecture, work units, deploy, privacy).
- `CLAUDE.md`: engineering notes for working on the code.
- `deploy/README.md`: operator guide for the host (first install, token, Caddy, watcher, rollback).

## Run it locally

Needs [Bun](https://bun.sh) and Node 24 for production (`node:sqlite` for the recorder).

```sh
bun install
FISHNET_MOCK=busy bun run dev      # against fixtures; FISHNET_MOCK=fresh for an empty network
bun test
bun run check
bun run build && node build/index.js
```

`FISHNET_MOCK` answers from fixtures instead of cakeutils. The production server refuses to start with
it set, unless the build was made with `FISHNET_ALLOW_MOCK=1` (tests only).

## Configuration

Copy `.env.example` to `.env` and set the values. `.env` is never committed.

| Variable | What it does | Default |
|---|---|---|
| `CAKEUTILS_API_URL` | The cakeutils v2 API, `scheme://host:port` | `http://127.0.0.1:8085` |
| `CAKEUTILS_API_TOKEN` | Bearer token with `read:players read:stats`; never logged, never sent to a browser | none |
| `CAKEUTILS_RATE` | Requests per minute the site allows itself, below the token's own limit | `400` |
| `ORIGIN` | The public origin, for absolute links and the origin check | `http://localhost:3000` |
| `FISHNET_DATA_DIR` | Recorder database and caches | `data` |
| `HIDDEN_PLAYERS_FILE` | Players who opted out, one UUID or name per line | `data/hidden-players.txt` |
| `HIDDEN_SERVERS_FILE` | Servers the site never shows, one cakeutils server id per line (below) | `data/hidden-servers.txt` |
| `FISHNET_ADMIN_TOKEN` | Site-side admin secret for `/admin` (below), at least 24 characters; not the cakeutils token; never logged | none: `/admin` is a 404 |

### Editing the site (`/admin`)

With `FISHNET_ADMIN_TOKEN` set (make one with `openssl rand -base64 32`), `/admin` asks for that token and
then lets you change three things; everyone else still sees a read-only site:

- **Names**: what the site calls each stat type (label, title, milestone phrase) and single stats, on top
  of the site's own words (`src/lib/format/labels.ts`). Stored in `data/admin.db`; pages use them on the
  next view.
- **Hidden servers** and **hidden players**: adds and removes lines in the two files below, keeping your
  own comments. Hand edits to the files still work.

The token is checked in constant time; 5 failed tries per address (20 overall) in 10 minutes lock sign-in
for the rest of the window. A sign-in lasts 12 hours in an httpOnly, SameSite=Strict, Secure
`__Host-` cookie held in memory (a restart signs you out). Every change needs the session's own form token
on top of SvelteKit's origin check. Failed tries are logged with the address, never the token. Behind Caddy
the per-address limit only sees Caddy unless `ADDRESS_HEADER=X-Forwarded-For` and `XFF_DEPTH=1` are set;
without them every client shares the one limit. Remove the variable to switch `/admin` off; the saved
names stay in use.

### Hiding a server

Put the server's id (its `velocity.toml` key, as cakeutils names it) on its own line in
`data/hidden-servers.txt`; `#` starts a comment. Within a minute, without a restart, the server leaves
every page, scope switch, feed, board and the recorder, `/servers/<id>` and `?scope=server:<id>` answer
404, and players on it read as offline. Network totals leave it out too: the site asks cakeutils for
network figures with `exclude=<ids>` (cakeutils D-113), which subtracts that server's own figures from
the network's (exact, never a sum of the other servers). Two things cannot leave it out, and the site
says so where they show:

- network milestones (first to a stat threshold) are recorded when they happen, across every server;
  their sections carry a line saying they count every server;
- a cakeutils older than D-113 ignores `exclude`; every page then shows a notice that network totals
  still include unlisted servers (playtime is corrected on the site, stats cannot be).

History the recorder took before the server was hidden is kept but no longer shown for that server;
network charts from before then still count its players.

Create the token on the proxy with the read scopes and the rate the site uses:

```sh
cakectl token create fishnet read:players read:stats --rate 600/120
```

## Docker

```sh
docker compose up -d --build
```

The service listens on `127.0.0.1:3000` only, so a reverse proxy on the same host (Caddy in the
operator guide) is the one way in. `./data` is mounted as a volume, which holds the recorder's
database. Deleting the database loses history, never anything from cakeutils.

`GET /healthz` answers `200` whenever the server is up, whether or not cakeutils is reachable.

## Data and privacy

- Every number comes from the cakeutils API or from the site's own recorder. Nothing is made up.
- When cakeutils is down, pages show the last good data with the time it was taken.
- Players who opt out are removed from every page and from the recorder.
- Stats for a network are never added together with those of a server; a server's numbers include
  its mini-servers, and breakdowns are not summed.

The about page (`/about`) shows the same status: whether cakeutils is reachable, whether milestones and
advancements are on, and the date recording began.

Advancements (cakeutils D-111) are who completed each advancement first, per server and for the network:
`/advancements` (feed, most firsts, most completed), `/advancements/<id>` (network and per-server firsts), the
"First to complete" section of a profile, and short feeds on the home and server pages. They have their
own feature check (`/v2/milestones/advancements` answering 404 hides every section) and no mini-server
scope. A row tagged "Imported" was completed before live tracking; its time comes from the operator's
one-time `cakectl advancements import`.
