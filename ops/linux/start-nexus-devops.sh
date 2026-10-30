#!/usr/bin/env bash
# NEXUS DevOps Intelligence - Linux per-user start wrapper (Community, loopback only).
#
# - Binds 127.0.0.1 only; there is no option to change the bind address.
# - Exits 0 without starting a second copy when the port already answers.
# - Refuses (exit 3) when the port is used by something that is not this service.
# - Builds once if no production build exists, then runs `next start` in the foreground
#   so systemd (or any supervisor) owns the process.
# - No network access, no secrets, no sudo.
set -euo pipefail

PORT="${NEXUS_DEVOPS_PORT:-3000}"
case "$PORT" in
  ''|*[!0-9]*) echo "NEXUS_DEVOPS_PORT must be a number" >&2; exit 64 ;;
esac
if [ "$PORT" -lt 1024 ] || [ "$PORT" -gt 65535 ]; then
  echo "NEXUS_DEVOPS_PORT must be 1024-65535" >&2; exit 64
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NODE="${NEXUS_DEVOPS_NODE:-$(command -v node || true)}"
if [ -z "$NODE" ] || [ ! -x "$NODE" ]; then
  echo "node was not found; set NEXUS_DEVOPS_NODE to an absolute node path" >&2; exit 69
fi
NEXT="$REPO_ROOT/node_modules/next/dist/bin/next"
if [ ! -f "$NEXT" ]; then
  echo "dependencies are missing; run: npm ci --ignore-scripts (in $REPO_ROOT)" >&2; exit 66
fi

export NEXT_TELEMETRY_DISABLED=1
export NODE_ENV=production

healthy() {
  "$NODE" -e '
    const http = require("node:http");
    const req = http.get({ host: "127.0.0.1", port: Number(process.argv[1]), path: "/", timeout: 3000 },
      (res) => { res.resume(); process.exit(res.statusCode === 200 ? 0 : 1); });
    req.on("timeout", () => { req.destroy(); process.exit(1); });
    req.on("error", () => process.exit(1));
  ' "$PORT" >/dev/null 2>&1
}

listening() {
  if command -v ss >/dev/null 2>&1; then
    [ -n "$(ss -H -ltn "sport = :$PORT" 2>/dev/null)" ]
  else
    (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null
  fi
}

if healthy; then
  echo "already healthy on 127.0.0.1:$PORT; not starting a second copy"; exit 0
fi
if listening; then
  echo "port $PORT is in use by something that is not a healthy NEXUS service; refusing to start" >&2; exit 3
fi

cd "$REPO_ROOT"
if [ ! -f ".next/BUILD_ID" ]; then
  echo "no production build found; running next build once"
  "$NODE" "$NEXT" build
fi
exec "$NODE" "$NEXT" start -H 127.0.0.1 -p "$PORT"
