#!/usr/bin/env bash
set -Eeuo pipefail

BASE=/opt/cashcompass-deploy
SOURCE=/root/cashcompass
BRANCH=main
export PATH="$BASE/node/bin:$PATH"
exec 9>"$BASE/deploy.lock"
flock -n 9 || exit 0
export GIT_TERMINAL_PROMPT=0
export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS=--max-old-space-size=1536

git -C "$SOURCE" fetch origin "$BRANCH"
commit=$(git -C "$SOURCE" rev-parse "origin/$BRANCH")
deployed=$(cat "$BASE/deployed-commit" 2>/dev/null || true)
if [[ "$commit" == "$deployed" && "${FORCE_DEPLOY:-0}" != 1 ]]; then
  echo "Already deployed $commit"
  exit 0
fi

failed=$(cat "$BASE/failed-commit" 2>/dev/null || true)
if [[ "$commit" == "$failed" && "${FORCE_DEPLOY:-0}" != 1 ]]; then
  echo "Commit $commit previously failed; waiting for a new commit or FORCE_DEPLOY=1"
  exit 0
fi
available_kb=$(df -Pk "$BASE" | awk 'NR==2 {print $4}')
if (( available_kb < 4194304 )); then
  echo "Less than 4 GiB free; remove obsolete releases before deploying" >&2
  exit 1
fi

# Best-effort pre-deploy snapshot via the Vultr API. Skips cleanly without
# VULTR_API_KEY/VULTR_INSTANCE_ID (unset by default) and never blocks a
# deploy on failure — this is a safety net, not a dependency. A snapshot
# covers the whole disk; the PM2/release rollback below only covers the app.
#
# This script's own shell environment never has these set (systemd doesn't
# export them, and nothing sources .env files into bash) — the values live
# in SOURCE's env files for Next.js to read at runtime. So: prefer an
# explicit shell env var if one happens to be set, otherwise read the same
# env files the release itself gets (same precedence as the copy loop
# below), and only skip if neither has it.
read_env_value() {
  local key=$1 file
  for file in .env.production.local .env.production .env.local .env; do
    if [[ -f "$SOURCE/$file" ]]; then
      local value
      value=$(grep -m1 "^${key}=" "$SOURCE/$file" 2>/dev/null | cut -d= -f2- | xargs || true)
      [[ -n "$value" ]] && { printf '%s' "$value"; return 0; }
    fi
  done
  return 1
}

snapshot_before_deploy() {
  local vultr_key="${VULTR_API_KEY:-}" vultr_instance="${VULTR_INSTANCE_ID:-}"
  [[ -z "$vultr_key" ]] && vultr_key=$(read_env_value VULTR_API_KEY || true)
  [[ -z "$vultr_instance" ]] && vultr_instance=$(read_env_value VULTR_INSTANCE_ID || true)

  if [[ -z "$vultr_key" || -z "$vultr_instance" ]]; then
    echo "VULTR_API_KEY/VULTR_INSTANCE_ID not set; skipping pre-deploy snapshot"
    return 0
  fi
  local description="pre-deploy-${commit:0:12}-$(date -u +%Y%m%dT%H%M%SZ)"
  local http_code
  http_code=$(curl --max-time 15 -s -o /dev/null -w '%{http_code}' \
    -X POST "https://api.vultr.com/v2/snapshots" \
    -H "Authorization: Bearer $vultr_key" \
    -H "Content-Type: application/json" \
    -d "{\"instance_id\":\"$vultr_instance\",\"description\":\"$description\"}" \
    2>/dev/null) || { echo "Pre-deploy snapshot request failed; continuing deploy" >&2; return 0; }
  if [[ "$http_code" =~ ^2[0-9][0-9]$ ]]; then
    echo "Requested pre-deploy snapshot: $description"
  else
    echo "Pre-deploy snapshot returned HTTP $http_code; continuing deploy" >&2
  fi
  return 0
}
snapshot_before_deploy

on_exit() {
  status=$?
  if (( status != 0 )); then printf '%s\n' "$commit" >"$BASE/failed-commit"; fi
  if [[ -n "${candidate:-}" ]]; then cleanup_candidate; fi
}
trap on_exit EXIT

release="$BASE/releases/$(date -u +%Y%m%dT%H%M%SZ)-${commit:0:12}"
mkdir -p "$release"
git -C "$SOURCE" archive "$commit" | tar -x -C "$release"
for envfile in .env .env.local .env.production .env.production.local; do
  if [[ -f "$SOURCE/$envfile" ]]; then
    install -m 600 "$SOURCE/$envfile" "$release/$envfile"
  fi
done
cd "$release"
export CASHCOMPASS_BUILD_SHA="$commit"
npm ci --legacy-peer-deps --no-audit --no-fund
NODE_ENV=production node scripts/check-environment.mjs --core-only
npm run test --if-present
npm run build

healthy() {
  local port=$1 code
  for attempt in $(seq 1 30); do
    code=$(curl --max-time 12 -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/api/public/health" || true)
    if [[ "$code" == 200 ]]; then return 0; fi
    sleep 2
  done
  return 1
}

# Check the new server without disturbing the live port or PM2 process.
setsid npm run start -- --hostname 127.0.0.1 -p 8001 >"$BASE/candidate.log" 2>&1 &
candidate=$!
cleanup_candidate() {
  kill -TERM -- "-$candidate" 2>/dev/null || true
  wait "$candidate" 2>/dev/null || true
}
if ! healthy 8001; then
  echo "Candidate failed health check; live app unchanged" >&2
  exit 1
fi
cleanup_candidate
candidate=

previous=$(readlink -f "$BASE/current")
previous_app=$(cat "$BASE/current-app" 2>/dev/null || printf cashcompass)
app="cashcompass-$(basename "$release")"
node - "$release" "$BASE" "$app" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const [release, base, name] = process.argv.slice(2);
const config = { apps: [{
  name, cwd: release,
  script: path.join(release, 'node_modules/next/dist/bin/next'),
  interpreter: path.join(base, 'node/bin/node'),
  args: ['start', '--hostname', '127.0.0.1', '-p', '8000'],
  env: { NODE_ENV: 'production', PATH: process.env.PATH, CASHCOMPASS_BUILD_SHA: process.env.CASHCOMPASS_BUILD_SHA },
}] };
fs.writeFileSync(path.join(release, 'ecosystem.config.cjs'), 'module.exports = ' + JSON.stringify(config) + ';\n');
NODE
pm2 stop "$previous_app"
if pm2 start "$release/ecosystem.config.cjs" && healthy 8000; then
  ln -sfn "$previous" "$BASE/previous"
  ln -sfn "$release" "$BASE/current"
  printf '%s\n' "$commit" >"$BASE/deployed-commit"
  printf '%s\n' "$app" >"$BASE/current-app"
  printf '%s\n' "$previous_app" >"$BASE/previous-app"
  : >"$BASE/failed-commit"
  pm2 save
  echo "Deployed $commit from $release"
else
  echo "Live health check failed; restoring $previous" >&2
  pm2 stop "$app" || true
  pm2 restart "$previous_app"
  pm2 save
  exit 1
fi
