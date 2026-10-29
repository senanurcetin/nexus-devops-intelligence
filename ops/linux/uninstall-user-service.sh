#!/usr/bin/env bash
# Remove the NEXUS DevOps Intelligence systemd user service. Does not touch the repository or its build.
set -euo pipefail
UNIT="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/nexus-devops.service"
if command -v systemctl >/dev/null 2>&1; then
  systemctl --user disable --now nexus-devops.service 2>/dev/null || true
fi
rm -f "$UNIT"
if command -v systemctl >/dev/null 2>&1; then
  systemctl --user daemon-reload
  systemctl --user reset-failed nexus-devops.service 2>/dev/null || true
fi
echo "removed: $UNIT"
