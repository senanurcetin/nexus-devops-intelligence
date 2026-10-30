#!/usr/bin/env bash
# Install NEXUS DevOps Intelligence as a systemd *user* service (no root, no sudo).
#   ops/linux/install-user-service.sh [--port 3000]
# Remove with ops/linux/uninstall-user-service.sh. Logs: journalctl --user -u nexus-devops
set -euo pipefail

PORT=3000
while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,5p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 64 ;;
  esac
done
case "$PORT" in ''|*[!0-9]*) echo "--port must be a number" >&2; exit 64 ;; esac
if [ "$PORT" -lt 1024 ] || [ "$PORT" -gt 65535 ]; then echo "--port must be 1024-65535" >&2; exit 64; fi

command -v systemctl >/dev/null 2>&1 || { echo "systemctl not found (systemd is required)" >&2; exit 69; }
NODE="$(command -v node || true)"
[ -n "$NODE" ] || { echo "node was not found in PATH" >&2; exit 69; }
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
START="$REPO_ROOT/ops/linux/start-nexus-devops.sh"
chmod +x "$START"

UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT="$UNIT_DIR/nexus-devops.service"
mkdir -p "$UNIT_DIR"
cat > "$UNIT" <<EOF
[Unit]
Description=NEXUS DevOps Intelligence (Community, loopback only)
After=network.target
StartLimitIntervalSec=600
StartLimitBurst=8

[Service]
Type=simple
WorkingDirectory=$REPO_ROOT
Environment=NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 NEXUS_DEVOPS_PORT=$PORT NEXUS_DEVOPS_NODE=$NODE
ExecStart=$START
Restart=on-failure
RestartSec=5
NoNewPrivileges=true

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now nexus-devops.service
echo "installed: $UNIT (127.0.0.1:$PORT only)"
echo "status:    systemctl --user status nexus-devops"
echo "logs:      journalctl --user -u nexus-devops -f"
if command -v loginctl >/dev/null 2>&1 && [ "$(loginctl show-user "$USER" -p Linger --value 2>/dev/null || echo no)" != "yes" ]; then
  echo "note: the service stops when you log out. To keep it running after logout an administrator can run:"
  echo "      sudo loginctl enable-linger $USER   (not run by this script)"
fi
