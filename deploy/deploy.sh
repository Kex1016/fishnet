#!/usr/bin/env bash
# Deploy origin/main of this checkout (PLAN §4).
#
#   deploy/deploy.sh            deploy origin/main if it differs from what runs now
#   deploy/deploy.sh --force    rebuild and redeploy even if the commit is unchanged or failed before
#   deploy/deploy.sh --ref SHA  deploy a specific commit that origin has (e.g. to go back by hand)
#
# Steps: fetch, build an image tagged with the commit, smoke-test it on a spare port with a throwaway
# data dir (so a broken build never touches the running site), swap it in with `docker compose up`,
# wait for /healthz, and roll back to the previous image if it does not come up.
# Prints one result line. Exit 0: deployed or already current. Exit 1: failed (the previous version,
# if any, is running). Exit 2: could not start (lock held, bad setup).
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REMOTE="${FISHNET_REMOTE:-origin}"
BRANCH="${FISHNET_BRANCH:-main}"
HEALTH_URL="${FISHNET_HEALTH_URL:-http://127.0.0.1:7777/healthz}"
HEALTH_TIMEOUT="${FISHNET_HEALTH_TIMEOUT:-90}"   # seconds to wait for a container to answer
KEEP_IMAGES="${FISHNET_KEEP_IMAGES:-3}"
CANDIDATE_PORT="${FISHNET_CANDIDATE_PORT:-3199}"
STATE="$ROOT/.deploy"
START=$SECONDS

FORCE=0
REF=""
while [ $# -gt 0 ]; do
  case "$1" in
    --force) FORCE=1 ;;
    --ref) REF="${2:?--ref needs a commit}"; shift ;;
    -h|--help) sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "deploy: unknown argument $1" >&2; exit 2 ;;
  esac
  shift
done

say() { printf 'deploy: %s\n' "$*"; }
die() { printf 'deploy: FAILED: %s\n' "$*" >&2; exit "${2:-1}"; }

for tool in git docker curl flock; do
  command -v "$tool" >/dev/null || die "$tool is not installed" 2
done
docker compose version >/dev/null 2>&1 || die "the docker compose plugin is not installed" 2

mkdir -p "$STATE"
exec 9>"$STATE/deploy.lock"
flock -n 9 || die "another deploy is running" 2

[ -f .env ] || die ".env is missing: cp .env.example .env and fill in CAKEUTILS_API_TOKEN (deploy/README.md)" 2
grep -Eq '^CAKEUTILS_API_TOKEN=.+' .env || die "CAKEUTILS_API_TOKEN is empty in .env" 2
if grep -Eq '^FISHNET_MOCK=' .env; then die "FISHNET_MOCK is set in .env; the production server refuses it" 2; fi

export FISHNET_UID FISHNET_GID
FISHNET_UID="$(id -u)"; FISHNET_GID="$(id -g)"
mkdir -p data

compose() { docker compose "$@"; }

# Wait until /healthz answers 200 and the container (if named) has not exited.
wait_healthy() { # url container
  local url="$1" name="${2:-}" deadline=$((SECONDS + HEALTH_TIMEOUT))
  while [ $SECONDS -lt $deadline ]; do
    if [ -n "$name" ] && [ "$(docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null || echo false)" != "true" ]; then
      return 1
    fi
    if curl -fsS -o /dev/null --max-time 3 "$url" 2>/dev/null; then return 0; fi
    sleep 2
  done
  return 1
}

record_failure() { echo "$1" >"$STATE/failed"; }

CANDIDATE=""
cleanup() { [ -n "$CANDIDATE" ] && docker rm -f "$CANDIDATE" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# 1. Which commit.
git fetch --quiet "$REMOTE" "$BRANCH" || die "git fetch $REMOTE $BRANCH failed (network or deploy key)"
if [ -n "$REF" ]; then
  NEW="$(git rev-parse --verify --quiet "$REF^{commit}")" || die "unknown commit $REF"
else
  NEW="$(git rev-parse "$REMOTE/$BRANCH")"
fi
SHORT="${NEW:0:12}"
OLD="$(cat "$STATE/current" 2>/dev/null || true)"
OLD_SHORT="${OLD:0:12}"

RUNNING="$(docker inspect -f '{{.State.Running}}' fishnet 2>/dev/null || echo false)"
if [ "$NEW" = "$OLD" ] && [ "$FORCE" = 0 ] && [ "$RUNNING" = true ]; then
  say "already running ${SHORT}"
  exit 0
fi

# 2. Source and image.
git diff --quiet HEAD -- 2>/dev/null || die "the checkout has local changes; this directory is for deploying, not editing"
git checkout --quiet --detach "$NEW"
say "building ${SHORT}"
if ! docker build --quiet --build-arg "COMMIT=$NEW" -t "fishnet:$SHORT" . >"$STATE/build.log" 2>&1; then
  tail -n 25 "$STATE/build.log" >&2
  record_failure "$NEW"
  die "build of ${SHORT} failed (log: .deploy/build.log); still running ${OLD_SHORT:-nothing}"
fi

# 3. Smoke test on a spare port, own data dir, never the live one.
CANDIDATE="fishnet-candidate"
docker rm -f "$CANDIDATE" >/dev/null 2>&1 || true
docker run -d --name "$CANDIDATE" --user "$FISHNET_UID:$FISHNET_GID" --read-only --tmpfs /tmp \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --env-file .env -e FISHNET_DATA_DIR=/tmp/data -p "127.0.0.1:$CANDIDATE_PORT:3000" \
  "fishnet:$SHORT" >/dev/null
if ! wait_healthy "http://127.0.0.1:$CANDIDATE_PORT/healthz" "$CANDIDATE"; then
  docker logs --tail 25 "$CANDIDATE" >&2 || true
  record_failure "$NEW"
  die "${SHORT} did not start on the spare port; still running ${OLD_SHORT:-nothing}"
fi
cleanup; CANDIDATE=""

# 4. Swap.
export FISHNET_TAG="$SHORT"
compose up -d --no-build --remove-orphans >/dev/null
if wait_healthy "$HEALTH_URL" fishnet; then
  echo "$NEW" >"$STATE/current"
  rm -f "$STATE/failed"
  # Keep the newest KEEP_IMAGES tags (the running one and the rollback target are among them).
  docker images fishnet --format '{{.Tag}}' | grep -E '^[0-9a-f]{12}$' | tail -n +"$((KEEP_IMAGES + 1))" |
    while read -r tag; do [ "$tag" != "$SHORT" ] && [ "$tag" != "$OLD_SHORT" ] && docker rmi "fishnet:$tag" >/dev/null 2>&1 || true; done
  say "OK deployed ${SHORT} (was ${OLD_SHORT:-none}) in $((SECONDS - START))s"
  exit 0
fi

# 5. Roll back.
docker logs --tail 25 fishnet >&2 || true
record_failure "$NEW"
if [ -n "$OLD_SHORT" ] && docker image inspect "fishnet:$OLD_SHORT" >/dev/null 2>&1; then
  export FISHNET_TAG="$OLD_SHORT"
  compose up -d --no-build >/dev/null
  if wait_healthy "$HEALTH_URL" fishnet; then
    git checkout --quiet --detach "$OLD"
    die "${SHORT} unhealthy after the swap; ROLLED BACK to ${OLD_SHORT} in $((SECONDS - START))s"
  fi
  die "${SHORT} unhealthy and the rollback to ${OLD_SHORT} is unhealthy too: the site is down, check 'docker logs fishnet'"
fi
compose down >/dev/null 2>&1 || true
die "${SHORT} unhealthy and there is no previous image to roll back to: the site is down"
