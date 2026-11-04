#!/usr/bin/env bash
# One watcher pass, run every 60 s by fishnet-watch.timer: if origin/main is not what runs now,
# run deploy.sh. Polling needs no open port and no webhook secret. Logs go to stdout (the journal).
#
# Failures back off 1, 5, then 15 minutes. After three failures on the same commit it stops trying
# until main moves to a new commit (or someone runs `deploy/deploy.sh --force`).
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
REMOTE="${FISHNET_REMOTE:-origin}"
BRANCH="${FISHNET_BRANCH:-main}"
STATE="$ROOT/.deploy"
BACKOFF_MIN=(1 5 15)

mkdir -p "$STATE"
exec 8>"$STATE/watch.lock"
flock -n 8 || exit 0   # a previous pass (a long build) is still running

now=$(date +%s)
fails=0; until=0; fail_sha=""
[ -f "$STATE/backoff" ] && read -r fails until fail_sha <"$STATE/backoff" || true

if ! remote_sha="$(timeout 30 git ls-remote "$REMOTE" "refs/heads/$BRANCH" | cut -f1)" || [ -z "$remote_sha" ]; then
  echo "watch: cannot read $REMOTE/$BRANCH (network or deploy key)"
  exit 0   # not a deploy failure; the next tick tries again
fi

deployed="$(cat "$STATE/current" 2>/dev/null || true)"
if [ "$remote_sha" = "$deployed" ]; then
  rm -f "$STATE/backoff"
  exit 0
fi

# A new commit resets the backoff.
if [ "$remote_sha" != "$fail_sha" ]; then fails=0; until=0; fi
if [ "$fails" -ge "${#BACKOFF_MIN[@]}" ]; then exit 0; fi
if [ "$now" -lt "$until" ]; then exit 0; fi

echo "watch: ${remote_sha:0:12} on $REMOTE/$BRANCH, running ${deployed:0:12}; deploying"
if "$ROOT/deploy/deploy.sh"; then
  rm -f "$STATE/backoff"
else
  code=$?
  fails=$((fails + 1))
  wait_min="${BACKOFF_MIN[$((fails - 1))]:-15}"
  echo "$fails $((now + wait_min * 60)) $remote_sha" >"$STATE/backoff"
  if [ "$fails" -ge "${#BACKOFF_MIN[@]}" ]; then
    echo "watch: deploy of ${remote_sha:0:12} failed $fails times (exit $code); giving up until main changes"
  else
    echo "watch: deploy failed (exit $code); next try in ${wait_min} min"
  fi
  exit 0   # the failure is logged; the unit itself stays green so the timer keeps ticking
fi
