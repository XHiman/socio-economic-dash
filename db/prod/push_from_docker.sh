#!/usr/bin/env bash
# Copy the `socioecon` database from the local dev Docker MariaDB to the VM through an SSH tunnel.
#
# 1. In ANOTHER terminal, open the tunnel and leave it running (3308: local 3306 is a local MySQL):
#        ssh -L 3308:127.0.0.1:3306 <ssh_user>@10.9.160.19
# 2. Run this script:   bash db/prod/push_from_docker.sh [DB_USER]      (default Xhi_dev)
#
# What it does to the VM: DROPs and recreates only the tables that exist in the dump
# (all inside the `socioecon` database) and inserts the data. Nothing else on the server is touched.
# No server settings (local_infile etc.) are required. The password is prompted, never stored.
set -euo pipefail
DB_USER="${1:-Xhi_dev}"
TUNNEL_HOST="${TUNNEL_HOST:-host.docker.internal}"   # how the container reaches the tunnel on your PC
TUNNEL_PORT="${TUNNEL_PORT:-3308}"

read -rsp "Password for ${DB_USER} on the VM's MariaDB: " VM_PW; echo

docker exec -i -e VM_PW="$VM_PW" socioecon-mariadb sh -c '
  set -e
  export MYSQL_PWD="$VM_PW"
  echo "Checking connection..."
  mariadb -h '"$TUNNEL_HOST"' -P '"$TUNNEL_PORT"' -u '"$DB_USER"' socioecon -e "SELECT CURRENT_USER() AS me, VERSION() AS server;"
  echo "Copying (this can take a minute)..."
  MYSQL_PWD=dev_root_password mariadb-dump -uroot --single-transaction --skip-lock-tables --no-tablespaces socioecon \
    | mariadb -h '"$TUNNEL_HOST"' -P '"$TUNNEL_PORT"' -u '"$DB_USER"' socioecon
  echo "Verifying on the VM..."
  mariadb -h '"$TUNNEL_HOST"' -P '"$TUNNEL_PORT"' -u '"$DB_USER"' socioecon -e "
    SELECT COUNT(*) AS tables_on_vm FROM information_schema.tables WHERE table_schema=\"socioecon\";
    SELECT COUNT(*) AS talukas FROM dim_taluka;
    SELECT COUNT(*) AS gddp_rows FROM dsa_gddp;"
'
echo "Done. Local Docker counts for comparison: 158 tables, 555 talukas, 576 gddp rows."
