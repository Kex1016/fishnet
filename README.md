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
| `CAKEUTILS_API_TOKEN` | Bearer token with `read:players read:stats read:onesoul read:map` (One Soul section; without `read:onesoul` it is hidden; without `read:map` the map is off); never logged, never sent to a browser | none |
| `CAKEUTILS_RATE` | Requests per minute the site allows itself, below the token's own limit | `400` |
| `CAKEUTILS_BURST` | Requests the site may send back to back, below the token's burst | `60` |
| `CAKEUTILS_MAP_RATE` | Map requests per minute (tiles, positions, changes), below cakeutils' map bucket of 1200 | `900` |
| `CAKEUTILS_MAP_BURST` | Map requests the site may send back to back, below cakeutils' map burst of 300 | `200` |
| `MAP_CACHE_MAX_MB` | Disk the map tile cache may use under `FISHNET_DATA_DIR/map`, in MiB; the oldest tiles go first | `2048` |
| `MAP_SSE_MAX` | Live map streams open at once, all visitors together (4 per client: an IPv4 address or an IPv6 /64) | `500` |
| `ORIGIN` | The public origin, for absolute links and the origin check | `http://localhost:3000` |
| `FISHNET_DATA_DIR` | Recorder database and caches | `data` |
| `HIDDEN_PLAYERS_FILE` | Players who opted out, one UUID or name per line | `data/hidden-players.txt` |
| `HIDDEN_SERVERS_FILE` | Servers the site never shows, one cakeutils server id per line (below) | `data/hidden-servers.txt` |
| `FISHNET_ADMIN_TOKEN` | Site-side admin secret for `/admin` (below), at least 24 characters; not the cakeutils token; never logged | none: `/admin` is a 404 |

### Map (`/map`)

The live map draws squaremap's tiles, with players and the layers each server shows, read through cakeutils
`/v2/map`. It needs the token scope `read:map` (`read` includes it). Round maps of finished One Soul rounds
also need `read:onesoul`; without it those maps are hidden, and the rest of the map still works.

```sh
cakectl token create fishnet read:players read:stats read:onesoul read:map --rate 600/120
```

**Markers** (points and areas with titles) are made only in game, by players with cakeutils' `cakeutils.map.marker.*`
permissions (`/cakemap marker`). The site only reads them, with the same `read:map` token: there is no new scope and
no new environment variable, and the site never edits them. A hidden server's markers never show. They refresh within
about 30 seconds without a reload, and `?marker=<id>` links open the map on one marker.

- **Tile cache**: tiles are kept on disk under `FISHNET_DATA_DIR/map` (in Docker, `./data/map` on the same
  volume as the database). It is capped by `MAP_CACHE_MAX_MB`; the oldest tiles go first. Deleting it only costs
  re-downloads.
- **Live streams**: each open map keeps one stream (SSE) for players and tile changes. At most 4 streams per
  client and `MAP_SSE_MAX` in all; past that the site answers `503` with `Retry-After` and the page polls
  `/map/<server>/players.json` every 5 s instead, so the map keeps working. A client is an IPv4 address or an
  IPv6 /64 (one IPv6 host owns a whole /64). A stream closes after 30 minutes and the browser reconnects. Behind
  Caddy, the `/map/<server>/live` path must not be buffered or compressed: see `deploy/Caddyfile.example`.
- **Behind Caddy, set `ADDRESS_HEADER=X-Forwarded-For` and `XFF_DEPTH=1`** (they are in `.env.example`). Without
  them every visitor looks like Caddy, so the whole site shares 4 streams and everyone else polls. The site says
  so once in its log (`map live: requests come through a proxy but ADDRESS_HEADER is not set`), and
  `curl /healthz` shows the open streams under `map`.
- **Map requests** have their own rate bucket (`CAKEUTILS_MAP_RATE`, `CAKEUTILS_MAP_BURST`), so a busy map
  does not use up the budget for the rest of the site.
- Map tiles are rendered by squaremap; the about page credits it.

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

### One Soul

One Soul at a Time has its own section at `/one-soul`, with its own look. The rest of the site never shows
it. Servers that cakeutils marks `standalone` in `/v2/network`, and the servers `/v2/onesoul` lists, are
hidden everywhere outside that section, the same way as the hide list. If cakeutils is too old to keep them
out of network figures itself, the site asks for network figures with `exclude=` instead. The section shows
up only when the proxy has `/v2/onesoul` and the token has `read:onesoul`. Newer routes, such as the live
card, rounds and maps, are found by probing: a widget whose route answers 404 is left out.

Create the token on the proxy with the read scopes and the rate the site uses:

```sh
cakectl token create fishnet read:players read:stats read:onesoul --rate 600/120
```

Journals are drawn as the game's book with the book texture, page arrows and bitmap font from the
Minecraft client jar, which David allowed bundling. They live in `static/mc/`, and the glyph advances are in
`src/lib/onesoul/book/glyphs.json`. To refresh both from a newer jar, or to swap in a resource pack's book,
run `python3 -I scripts/mc-assets.py <client.jar>` (it needs Pillow). Characters that are not in the bitmap
fonts come from GNU Unifont, as in the game (the client jar does not ship it): `static/mc/unifont/` holds one
glyph sheet per 256 code points, and `src/lib/server/onesoul/unifont-data.ts` the ink box of
each glyph, which sets its advance. The server sends a journal page only the metrics for characters it uses.
To refresh them from a newer Unifont, run `python3 -I scripts/unifont.py <unifont.otf>` (it needs Pillow and
fontTools). The bundled build is Unifont 15.0.01 (GPL 2+ with the font embedding exception, or SIL OFL 1.1).

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
- Players who opt out are removed from every page and from the recorder. The One Soul section is the
  exception: it shows every soul of a round as they played.
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
