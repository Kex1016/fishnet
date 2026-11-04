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

`ORIGIN` stays `https://fishnet.haiiro.moe`. The token lives only in `.env` on the host and in the
container's environment; it is never in the image, the repo or the logs.

**First deploy**, by hand so you see the output:

```sh
deploy/deploy.sh
# deploy: building 3a90a9f95e14
# deploy: OK deployed 3a90a9f95e14 (was none) in 71s
curl -s http://127.0.0.1:3000/healthz        # {"status":"ok"}
```

`./data` (the recorder's SQLite and the player opt-out list `data/hidden-players.txt`) is created
next to the checkout and owned by the deploy user. Back it up if you care about the history; the
site works without it, the charts then say "Recording since" a later date.

## 2. Caddy

Add `Caddyfile.example` to the host's Caddyfile and reload:

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
