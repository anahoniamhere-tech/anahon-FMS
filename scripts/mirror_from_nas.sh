#!/bin/bash
# Daily one-way mirror: NAS (system of record) -> this Mac. Read-only on the NAS, no sudo.
# Pulls the newest hourly ZFS snapshot so the SQLite file is a consistent point-in-time copy.
# The Mac copy is NEVER the source of truth — anything changed here is overwritten by design.
set -euo pipefail
NAS="admin@192.168.1.22"; FMS="/mnt/mainpool/anahon/fms"
APP="$HOME/AnaHon/system"
VAULT="$HOME/AnaHon/vault"
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin"
SSH="ssh -o BatchMode=yes -o ConnectTimeout=15"
STAMPFILE="$HOME/Library/Logs/.anahon-fms-mirror-last"
echo "== $(date '+%F %T') mirror start"

# Already done today? Then this is a catch-up trigger firing after a successful run, and there
# is nothing to do. The triggers exist because 03:30 is missed whenever the laptop is asleep.
if [ "$(cat "$STAMPFILE" 2>/dev/null)" = "$(date +%F)" ] && [ "${FORCE:-}" != "1" ]; then
  echo "already mirrored today — nothing to do"; exit 0
fi

# The youngest snapshot BY CREATION TIME, never by name.
#
# This was `ls | sort | tail -1` until 12 Sep 2026, and it silently froze the mirror for six
# days: the hourly snapshots are fms-<date>_<hour>, the hand-made safety ones are
# pre-<thing>-<stamp>, and "pre-" sorts after "fms-". So the newest name was whichever manual
# snapshot happened to sort last — pre-white-chrome-202609061128, from 6 September — and every
# night the job copied that same six-day-old data and reported "mirror done". Three rooms then
# lost time to checks failing on columns that existed everywhere except here.
# backup_to_drive.sh already did it this way; the mirror had not been told.
SNAP=$($SSH "$NAS" "/usr/sbin/zfs list -H -t snapshot -o name -s creation ${FMS#/mnt/} | tail -1 | cut -d@ -f2")
[ -n "$SNAP" ] || { echo "no snapshot"; exit 1; }
SRC="$FMS/.zfs/snapshot/$SNAP"; echo "snapshot: $SNAP"

# And a mirror that copies stale data is worse than one that stops, because it looks like it
# worked. Hourly snapshots mean the newest is always minutes old; more than a day old means the
# selection above has gone wrong again, and this must be noisy rather than quietly current.
SNAP_AGE_H=$($SSH "$NAS" "/usr/sbin/zfs list -H -p -t snapshot -o creation ${FMS#/mnt/}@$SNAP" 2>/dev/null | awk -v now="$(date +%s)" '{ printf "%d", (now - $1) / 3600 }')
if [ -n "$SNAP_AGE_H" ] && [ "$SNAP_AGE_H" -gt 25 ]; then
  echo "REFUSED: newest snapshot $SNAP is ${SNAP_AGE_H}h old — snapshots have stopped, or the choice above is wrong again. Not overwriting the local copy with stale data."
  exit 1
fi
rsync -a -e "$SSH" "$NAS:$SRC/db/dev.db" "$APP/prisma/dev.db.incoming"
[ "$(sqlite3 "$APP/prisma/dev.db.incoming" 'pragma integrity_check;' | head -1)" = "ok" ] || { echo "integrity FAILED, keeping old copy"; rm -f "$APP/prisma/dev.db.incoming"; exit 1; }
mv -f "$APP/prisma/dev.db.incoming" "$APP/prisma/dev.db"
rsync -a --delete -e "$SSH" "$NAS:$SRC/vault/" "$VAULT/"
echo "db: $(sqlite3 "$APP/prisma/dev.db" 'select count(*) from Expense;') vouchers, $(sqlite3 "$APP/prisma/dev.db" 'select count(*) from AppDoc;') docs   vault: $(find "$VAULT" -type f | wc -l | tr -d ' ') files"
date +%F > "$STAMPFILE"
echo "== $(date '+%F %T') mirror done"
