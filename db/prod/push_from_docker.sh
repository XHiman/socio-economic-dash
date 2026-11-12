#!/usr/bin/env bash
# Copy the `socioecon` database from the local dev Docker MariaDB to the VM through an SSH tunnel.
#
# 1. In ANOTHER terminal, open the tunnel and leave it running (3308: local 3306 is a local MySQL):
#        ssh -L 0.0.0.0:3308:127.0.0.1:3306 <ssh_user>@10.9.160.19
#    (0.0.0.0 so the Docker container can reach it; the port is open on your PC only while the tunnel runs)
# 2. Run this script:   bash db/prod/push_from_docker.sh [DB_USER]      (default Xhi_dev)
#
# What it does to the VM: DROPs and recreates only the tables that exist in the dump
# (all inside the `socioecon` database) and inserts the data. Nothing else on the server is touched.
# No server settings (local_infile etc.) are required. The password is prompted, never stored.
#
# The window never closes on its own: success or failure, it prints what happened and waits for Enter.
# Full output is also written to db/prod/push_from_docker.log.
set -uo pipefail

DB_USER="${1:-Xhi_dev}"
TUNNEL_HOST="${TUNNEL_HOST:-host.docker.internal}"   # how the container reaches the tunnel on your PC
TUNNEL_PORT="${TUNNEL_PORT:-3308}"
CONTAINER="${CONTAINER:-socioecon-mariadb}"
LOG="$(dirname "${BASH_SOURCE[0]}")/push_from_docker.log"

# Git Bash on Windows rewrites arguments that look like paths (e.g. /var/lib) before docker sees them.
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'

finish() {
  local code=$1
  echo
  if [ "$code" -eq 0 ]; then echo "=== FINISHED OK ==="; else echo "=== FAILED (exit code $code) - see the messages above and $LOG ==="; fi
  read -rp "Press Enter to close... " _ || true
  exit "$code"
}
fail() { echo "ERROR: $*" >&2; finish 1; }

exec > >(tee "$LOG") 2>&1

command -v docker >/dev/null 2>&1 || fail "docker not found in PATH. Start Docker Desktop and run this from Git Bash."
docker info >/dev/null 2>&1 || fail "Docker is not running. Start Docker Desktop and try again."
[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" = "true" ] \
  || fail "Container '$CONTAINER' is not running. Start it with: docker compose up -d"

read -rsp "Password for ${DB_USER} on the VM's MariaDB: " VM_PW; echo
[ -n "$VM_PW" ] || fail "Empty password."

# Runs inside the container. -e is NOT used: each step reports its own error and the script stops there.
read -r -d '' REMOTE <<'EOF'
export MYSQL_PWD="$VM_PW"
VM="-h $TUNNEL_HOST -P $TUNNEL_PORT -u $DB_USER socioecon"

echo "Checking connection to $TUNNEL_HOST:$TUNNEL_PORT as $DB_USER..."
mariadb $VM -e "SELECT CURRENT_USER() AS me, VERSION() AS server;" 2>/tmp/conn.err || {
  cat /tmp/conn.err >&2
  if grep -q "ERROR 2002" /tmp/conn.err; then
    echo "Nothing answered on $TUNNEL_HOST:$TUNNEL_PORT. Open the tunnel in another terminal and leave it running:" >&2
    echo "    ssh -L 0.0.0.0:${TUNNEL_PORT}:127.0.0.1:3306 <ssh_user>@10.9.160.19" >&2
    echo "(0.0.0.0 lets the Docker container reach it; plain '-L ${TUNNEL_PORT}:...' binds loopback only and can be unreachable from Docker.)" >&2
  else
    echo "The server answered but refused the login - check the password / that $DB_USER may connect." >&2
  fi
  exit 11
}

echo "Dumping local database..."
MYSQL_PWD=dev_root_password mariadb-dump -uroot --single-transaction --skip-lock-tables --no-tablespaces socioecon > /tmp/socioecon_push.sql \
  || { echo "mariadb-dump failed." >&2; exit 12; }
echo "Dump size: $(wc -c < /tmp/socioecon_push.sql) bytes"

echo "Loading into the VM (this can take a minute)..."
mariadb $VM < /tmp/socioecon_push.sql || { echo "Load into the VM failed - it may be partly applied; fix the error above and run again (the script is safe to repeat)." >&2; exit 13; }
rm -f /tmp/socioecon_push.sql

echo "Verifying on the VM..."
mariadb $VM -e "
  SELECT COUNT(*) AS tables_on_vm FROM information_schema.tables WHERE table_schema='socioecon';
  SELECT COUNT(*) AS talukas FROM dim_taluka;
  SELECT COUNT(*) AS gddp_rows FROM dsa_gddp;" || { echo "Verification query failed." >&2; exit 14; }
EOF

docker exec -i \
  -e VM_PW="$VM_PW" -e TUNNEL_HOST="$TUNNEL_HOST" -e TUNNEL_PORT="$TUNNEL_PORT" -e DB_USER="$DB_USER" \
  "$CONTAINER" sh -c "$REMOTE"
code=$?
[ "$code" -eq 0 ] || fail "Copy failed inside the container (exit code $code)."

echo "Done. Local Docker counts for comparison: 158 tables, 567 talukas, 1008 gddp rows."
finish 0
