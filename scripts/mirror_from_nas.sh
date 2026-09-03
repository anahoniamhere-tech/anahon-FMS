#!/bin/bash
# Daily one-way mirror: NAS (system of record) -> this Mac. Read-only on the NAS, no sudo.
# Pulls the newest hourly ZFS snapshot so the SQLite file is a consistent point-in-time copy.
# The Mac copy is NEVER the source of truth — anything changed here is overwritten by design.
set -euo pipefail
NAS="admin@192.168.1.22"; FMS="/mnt/mainpool/anahon/fms"
APP="$HOME/antigravity/AnaHon-Financial-Management-System"
VAULT="$HOME/Documents/AnaHon_Document_Vault"
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin"
SSH="ssh -o BatchMode=yes -o ConnectTimeout=15"
echo "== $(date '+%F %T') mirror start"
SNAP=$($SSH "$NAS" "ls $FMS/.zfs/snapshot | sort | tail -1"); [ -n "$SNAP" ] || { echo "no snapshot"; exit 1; }
SRC="$FMS/.zfs/snapshot/$SNAP"; echo "snapshot: $SNAP"
rsync -a -e "$SSH" "$NAS:$SRC/db/dev.db" "$APP/prisma/dev.db.incoming"
[ "$(sqlite3 "$APP/prisma/dev.db.incoming" 'pragma integrity_check;' | head -1)" = "ok" ] || { echo "integrity FAILED, keeping old copy"; rm -f "$APP/prisma/dev.db.incoming"; exit 1; }
mv -f "$APP/prisma/dev.db.incoming" "$APP/prisma/dev.db"
rsync -a --delete -e "$SSH" "$NAS:$SRC/vault/" "$VAULT/"
echo "db: $(sqlite3 "$APP/prisma/dev.db" 'select count(*) from Expense;') vouchers, $(sqlite3 "$APP/prisma/dev.db" 'select count(*) from AppDoc;') docs   vault: $(find "$VAULT" -type f | wc -l | tr -d ' ') files"
echo "== $(date '+%F %T') mirror done"
