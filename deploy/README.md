# Deploying fishnet

fishnet runs as one Docker container on the host, bound to `127.0.0.1:3000`. Caddy on the host
terminates TLS and proxies to it. A systemd timer polls `origin/main` every minute and redeploys when it
moves. Nothing listens for webhooks and no port is opened for the watcher.

| File | What |
|---|---|
| `deploy.sh` | one deploy: build, smoke test, swap, health check, roll back on failure |
| `watch.sh` | one watcher pass (what the timer runs) |
| `fishnet-watch.service`, `fishnet-watch.timer` | systemd units |
| `Caddyfile.example` | the Caddy block |

The host needs Docker with the compose plugin, `git`, `curl`, `flock` (util-linux) and systemd. Bun and
Node are not needed on the host; the image builds with Bun and runs Node 24.

## 1. First install

Use a dedicated user in the `docker` group (the examples say `fishnet` and `/opt/fishnet`).

```sh
sudo useradd --system --create-home --shell /bin/bash --groups docker fishnet
sudo -iu fishnet
```

**Deploy key (the repo is private).** Make a key only this host uses and add its public half in
GitHub under Kex1016/fishnet, Settings, Deploy keys, **without** write access:

```sh
ssh-keygen -t ed25519 -N '' -C fishnet-deploy -f ~/.ssh/fishnet_deploy
cat ~/.ssh/fishnet_deploy.pub
ssh-keyscan github.com >> ~/.ssh/known_hosts
```

**Checkout.** `/opt/fishnet` is a deploy checkout: the scripts check out detached commits there, so
do not edit it.

```sh
sudo install -d -o fishnet -g fishnet /opt/fishnet      # once, as root
git clone git@github.com:Kex1016/fishnet.git /opt/fishnet
cd /opt/fishnet
git config core.sshCommand 'ssh -i ~/.ssh/fishnet_deploy -o IdentitiesOnly=yes'
git fetch origin main                                   # proves the key works
```

(Clone with the same `-c core.sshCommand=...` if the first clone cannot see the key; or use
`GIT_SSH_COMMAND` once and set the config after.)

**Token and `.env`.** On the Velocity proxy, create a read-only token (PLAN §8):

```sh
cakectl token create fishnet read:players read:stats --rate 600/120
```

Then on the host:

```sh
cd /opt/fishnet
cp .env.example .env
chmod 600 .env
$EDITOR .env    # CAKEUTILS_API_URL, CAKEUTILS_API_TOKEN; leave FISHNET_MOCK unset
```

`ORIGIN` stays `https://fishnet.haiiro.moe`. `CAKEUTILS_RATE` (requests per minute, default 400) and
`CAKEUTILS_BURST` (requests back to back, default 60) are the site's own limits; keep both below the
token's `--rate 600/120`. The token lives only in `.env` on the host and in the
container's environment; it is never in the image, the repo or the logs.

**First deploy**, by hand so you see the output:

```sh
deploy/deploy.sh
# deploy: building 3a90a9f95e14
# deploy: OK deployed 3a90a9f95e14 (was none) in 71s
curl -s http://127.0.0.1:3000/healthz        # {"status":"ok","cakeutils":{"reachable":true,...},"recordingSince":...}
```

`/healthz` answers 200 whenever the site runs (the health check must not flap with cakeutils); the
body says whether cakeutils is reachable, since when it is not, when it rate-limited the site, and when
the recorder started.

When the site shows "rate limited" notices or broken icons, the body says where the rejections come from:

```sh
curl -s http://127.0.0.1:3000/healthz | jq '.cakeutils.throttle, .faces'
```

- `cakeutils.throttle.upstream429` counts `429` answers from cakeutils. `tokenLimit` is the token's own
  per-minute rate (cakeutils' `RateLimit-Limit`); the site paces itself at 90 % of it when
  `CAKEUTILS_RATE` is higher (`ratePerMinute`, logged once). A `tokenLimit` of 120 means the token was
  created without `--rate`: `cakectl token update <id> --rate 600/120` (the `cu_<id>` the site logs at start) and set
  `CAKEUTILS_BURST` below the burst.
- `localRefused` counts pages the site's own bucket turned away before asking cakeutils (a busy
  minute); `refreshSkipped` counts background refreshes it skipped, serving the cached answer instead.
- `faces.mojang429` counts Mojang's `429`s on skin lookups (those only cost a default head, never a page).
- `faces.reasons` says why heads fell back to the default: `noSkin` (the player has no skin of their own,
  so the default is right), `noProfile` (Mojang has no such account), `offlineUuid` (an offline-mode
  server's UUID, never asked), `error` (network, HTTP or a bad answer; `faces.lastError` says which, e.g.
  `profile: ENOTFOUND` when the container cannot reach Mojang). An error is retried after 5 minutes, a
  missing skin after an hour, and the browser keeps a default-head redirect 5 minutes, so a fallback
  never sticks.

Faces are cached in `data/cache/faces/` (`<uuid>.png` heads, `<uuid>.miss` markers). To check that the
container reaches Mojang and to start over:

```sh
docker exec fishnet node -e "fetch('https://sessionserver.mojang.com/session/minecraft/profile/069a79f444e94726a5befca90e38aaf5').then(r => console.log(r.status), e => console.log(e.cause?.code ?? e.message))"
rm -f /opt/fishnet/data/cache/faces/*.miss     # forget fallbacks; heads (*.png) stay
```

Once Caddy is in front, the browser checks in `tests/e2e/` run against the live
site from any machine with Bun and Playwright: `bun run e2e --base https://fishnet.haiiro.moe`.

`./data` (the recorder's SQLite and the player opt-out list `data/hidden-players.txt`) is created
next to the checkout and owned by the deploy user. Back it up if you care about the history; the
site works without it, the charts then say "Recording since" a later date.

## 2. Caddy

Add `Caddyfile.example` to the host's Caddyfile and reload (it also gives the few files in `static/`
a one-day browser cache; the Node server leaves them without one):

```sh
sudo caddy reload --config /etc/caddy/Caddyfile
```

If Caddy runs in Docker, put it and the fishnet container on one network and use
`reverse_proxy fishnet:3000`.

## 3. The watcher

As root, copy the units and set the user and path if yours differ:

```sh
sudo cp /opt/fishnet/deploy/fishnet-watch.{service,timer} /etc/systemd/system/
sudo $EDITOR /etc/systemd/system/fishnet-watch.service     # User=, WorkingDirectory=, ExecStart=
sudo systemctl daemon-reload
sudo systemctl enable --now fishnet-watch.timer
```

Watch it:

```sh
systemctl list-timers fishnet-watch.timer
journalctl -u fishnet-watch.service -f
```

A quiet pass (nothing changed) logs nothing. When main moves you see `watch: <new> on origin/main,
running <old>; deploying` followed by deploy.sh's result line.

Behaviour worth knowing:

- Passes never overlap (a lock), so a long build is not started twice.
- Failed deploys back off 1, then 5, then 15 minutes. After three failures on the same commit the
  watcher stops until main moves to a new commit; `deploy/deploy.sh --force` tries again by hand.
- Not being able to reach GitHub is logged and retried on the next tick; it does not count as a
  failed deploy.
- Pause the watcher with `sudo systemctl stop fishnet-watch.timer`.

## 4. What a deploy does, and rollback

1. `git fetch origin main`, then check out that commit (detached).
2. Build `fishnet:<12-char commit>`. A failed build (this includes the token leak check at the end of
   `bun run build`) stops here; the running site is untouched.
3. Start the new image as `fishnet-candidate` on `127.0.0.1:3199` with a throwaway data directory and
   wait for `/healthz`. A broken start stops here; the running site is untouched.
4. `docker compose up -d` with the new tag, then wait up to 90 s for `/healthz` on `:3000`.
5. If that fails, bring the previous tag back (it is kept), check out its commit, and exit 1. If there
   was no previous image the site is down and the script says so.
6. Old images beyond the newest three are removed.

State is in `.deploy/` (git-ignored): `current` is the commit that runs, `failed` the last commit that
did not deploy, `build.log` the last build output.

**By hand:**

```sh
deploy/deploy.sh --ref <commit>     # go back to (or forward to) a commit origin has
deploy/deploy.sh --force            # rebuild and redeploy origin/main
docker logs --tail 100 fishnet
docker images fishnet               # the tags still on the host
```

If you roll back by hand, stop the watcher first, or it will deploy main again within a minute.
To keep a bad commit off the site, revert it on main; the watcher then deploys the revert.

## 5. Settings

Environment overrides for the scripts (rarely needed): `FISHNET_HEALTH_URL` (default
`http://127.0.0.1:3000/healthz`), `FISHNET_HEALTH_TIMEOUT` (90), `FISHNET_KEEP_IMAGES` (3),
`FISHNET_CANDIDATE_PORT` (3199), `FISHNET_REMOTE` (origin), `FISHNET_BRANCH` (main).
Site settings are in `.env` (see `.env.example`).
