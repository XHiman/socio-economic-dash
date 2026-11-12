#!/usr/bin/env bash
# Update the running site on the VM from the checked-out repo. Run from anywhere:   bash deploy/deploy.sh
#
# `npm run build` alone only writes frontend/dist and backend/dist inside the checkout; nothing serves those.
# The site shows new code only after (1) the frontend build is copied to the web root and
# (2) the API service is restarted on the new backend build. This script does both and then checks.
#
# Override paths if yours differ:  APP_DIR=/opt/socioecon WEB_DIR=/var/www/socioecon-site/Dashboard/Socio-Economic bash deploy/deploy.sh
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${APP_DIR:-/opt/socioecon}"
WEB_DIR="${WEB_DIR:-/var/www/socioecon-site/Dashboard/Socio-Economic}"
SERVICE="${SERVICE:-socioecon-api}"
API_PORT="${API_PORT:-3005}"
# `rsync --delete` empties its target: never let a mistyped variable point it at something broad.
for v in APP_DIR WEB_DIR; do
  d="${!v}"
  case "$d" in /*) ;; *) echo "$v must be an absolute path (got '$d')" >&2; exit 1 ;; esac
  [ "$(awk -F/ '{print NF-1}' <<<"${d%/}")" -ge 2 ] || { echo "$v ($d) is too shallow to deploy into" >&2; exit 1; }
done
trap 'echo "DEPLOY FAILED at line $LINENO - the site is unchanged from the last successful step." >&2' ERR

echo "== 1/5 Build ($REPO)"
( cd "$REPO/backend"  && npm ci && npm run build )
( cd "$REPO/frontend" && npm ci && npm run build )
[ -f "$REPO/frontend/dist/index.html" ] || { echo "frontend/dist/index.html missing after build" >&2; exit 1; }
[ -f "$REPO/backend/dist/server.js" ]   || { echo "backend/dist/server.js missing after build" >&2; exit 1; }

echo "== 2/5 Backend -> $APP_DIR/backend"
if [ "$REPO" != "$APP_DIR" ]; then
  sudo mkdir -p "$APP_DIR/backend"
  sudo rsync -a --delete "$REPO/backend/dist/" "$APP_DIR/backend/dist/"
  sudo cp "$REPO/backend/package.json" "$REPO/backend/package-lock.json" "$APP_DIR/backend/"
  ( cd "$APP_DIR/backend" && sudo npm ci --omit=dev )
else
  ( cd "$APP_DIR/backend" && npm prune --omit=dev )
fi

echo "== 3/5 Frontend -> $WEB_DIR"
sudo mkdir -p "$WEB_DIR"
sudo rsync -a --delete "$REPO/frontend/dist/" "$WEB_DIR/"

echo "== 4/5 Restart API"
sudo systemctl restart "$SERVICE"
sleep 3
sudo systemctl is-active --quiet "$SERVICE" || { sudo journalctl -u "$SERVICE" -n 30 --no-pager >&2; exit 1; }

echo "== 5/5 Check"
curl -fsS "http://127.0.0.1:$API_PORT/api/meta" | head -c 200; echo
echo "Served app shell references: $(grep -o 'assets/index-[^"]*\.js' "$WEB_DIR/index.html" | head -1)"
echo "Done. Hard-refresh the browser (Ctrl+F5) if the old page still shows."
