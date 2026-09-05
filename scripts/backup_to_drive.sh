#!/bin/bash
# Nightly encrypted off-site backup of everything that lives in only one place.
#
# Three sets, each pulled from the NAS's newest hourly ZFS snapshot (so the SQLite file is a
# consistent point-in-time copy), encrypted on the Mac with the archive key (AES-256-CBC +
# PBKDF2), and dropped into the Google Drive folder, which keeps the two newest dated sets:
#   fms-database-<date>.db.enc         the live database
#   document-vault-<date>.tar.gz.enc   the document vault (+ the legacy calendar-feed file)
#   workbench-<date>.tar.gz.enc        what used to exist in ONE place only (added 5 Sep 2026):
#                                      the website's live-edited content, data, uploads and images
#                                      (its code is in git; the edits are not), the archive's
#                                      catalogue and overrides (the 32 GB of rescued media has
#                                      its own encrypted Drive copy), this project's Claude memory
#                                      (~/.claude/projects/-Users-saadmatar-AnaHon/memory), and the
#                                      Mac-only ~/AnaHon/documents folder until it is filed.
# Run by launchd every day at 03:00 (org.anahon.fms-backup); by hand: scripts/backup_to_drive.sh
# Without the key at $KEY none of it can be read — keep a copy of that key somewhere that is not this Mac.
set -euo pipefail

NAS="admin@192.168.1.22"
FMS="/mnt/mainpool/anahon/fms"
SITE="/mnt/mainpool/anahon/site"
ARCH="/mnt/mainpool/anahon/archive"
MEMORY="$HOME/.claude/projects/-Users-saadmatar-AnaHon/memory"
DOCS="$HOME/AnaHon/documents"
KEY="$HOME/anahon-archive-keys/anahon-archive-2026-08-17.key"
STAGE="$HOME/anahon-fms-encrypted"
PULL="$STAGE/pull"
DRIVE="$HOME/Library/CloudStorage/GoogleDrive-anahoniamhere@gmail.com/My Drive/AnaHon_FMS_Cloud_Backup"
KEEP=2
STAMP=$(date +%Y-%m-%d)
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin"

[ -f "$KEY" ] || { echo "missing key: $KEY"; exit 1; }
[ -d "$(dirname "$DRIVE")" ] || { echo "Google Drive folder not mounted"; exit 1; }
mkdir -p "$PULL" "$STAGE"

echo "== $(date '+%F %T') start"
SNAP=$(ssh -o BatchMode=yes -o ConnectTimeout=15 "$NAS" "ls $FMS/.zfs/snapshot | sort | tail -1")
[ -n "$SNAP" ] || { echo "no snapshot on NAS"; exit 1; }
SRC="$FMS/.zfs/snapshot/$SNAP"
echo "1/4  pull from NAS snapshot $SNAP"
rsync -a --delete -e "ssh -o BatchMode=yes" "$NAS:$SRC/db/dev.db" "$PULL/dev.db"
rsync -a --delete -e "ssh -o BatchMode=yes" "$NAS:$SRC/vault/" "$PULL/vault/"
rsync -a -e "ssh -o BatchMode=yes" "$NAS:$FMS/calendar-feed.json" "$PULL/calendar-feed.json" 2>/dev/null || true
[ "$(sqlite3 "$PULL/dev.db" 'pragma integrity_check;' | head -1)" = "ok" ] || { echo "database integrity check FAILED"; exit 1; }
# The workbench: small, and the only copy of each thing outside the box it lives on.
SNAP_SITE=$(ssh -o BatchMode=yes "$NAS" "ls $SITE/.zfs/snapshot | sort | tail -1"); SNAP_ARCH=$(ssh -o BatchMode=yes "$NAS" "ls $ARCH/.zfs/snapshot | sort | tail -1")
mkdir -p "$PULL/workbench/site" "$PULL/workbench/archive-catalogue" "$PULL/workbench/claude-memory" "$PULL/workbench/documents"
for d in content data uploads images; do rsync -a --delete -e "ssh -o BatchMode=yes" "$NAS:$SITE/.zfs/snapshot/$SNAP_SITE/$d/" "$PULL/workbench/site/$d/" 2>/dev/null || true; done
rsync -a --delete --exclude 'archive/raw' -e "ssh -o BatchMode=yes" "$NAS:$ARCH/.zfs/snapshot/$SNAP_ARCH/" "$PULL/workbench/archive-catalogue/" 2>/dev/null || true
[ -d "$MEMORY" ] && rsync -a --delete "$MEMORY/" "$PULL/workbench/claude-memory/"
[ -d "$DOCS" ] && rsync -a --delete "$DOCS/" "$PULL/workbench/documents/"
echo "  workbench: $(du -sh "$PULL/workbench" | cut -f1) (site content $SNAP_SITE, archive catalogue $SNAP_ARCH, memory, documents)"

encrypt() {  # encrypt <plaintext> <dest.enc>
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -in "$1" -out "$2.part" -pass file:"$KEY"
  mv "$2.part" "$2"; echo "  encrypted: $(basename "$2") ($(du -h "$2" | cut -f1))"
}
echo "2/4  encrypt"
rm -f "$STAGE"/*.enc
encrypt "$PULL/dev.db" "$STAGE/fms-database-$STAMP.db.enc"
TMPTAR="$STAGE/.vault-$STAMP.tar.gz"
tar -czf "$TMPTAR" -C "$PULL" vault $( [ -f "$PULL/calendar-feed.json" ] && echo calendar-feed.json )
encrypt "$TMPTAR" "$STAGE/document-vault-$STAMP.tar.gz.enc"; rm -f "$TMPTAR"
TMPWB="$STAGE/.workbench-$STAMP.tar.gz"
tar -czf "$TMPWB" -C "$PULL" workbench
encrypt "$TMPWB" "$STAGE/workbench-$STAMP.tar.gz.enc"; rm -f "$TMPWB"

echo "3/4  checksums + copy to Drive"
( cd "$STAGE" && shasum -a 256 *.enc > "SHA256SUMS-$STAMP.txt" )
mkdir -p "$DRIVE"
cp "$STAGE"/*-"$STAMP".* "$DRIVE/"
cp "$(dirname "$0")/../RESTORE-FMS-BACKUP.txt" "$DRIVE/" 2>/dev/null || true

echo "4/4  prune Drive to newest $KEEP sets"
for pat in "fms-database-*.db.enc" "document-vault-*.tar.gz.enc" "workbench-*.tar.gz.enc" "SHA256SUMS-*.txt"; do
  ls -1 "$DRIVE"/$pat 2>/dev/null | sort -r | tail -n +$((KEEP+1)) | while read -r f; do echo "  removing $(basename "$f")"; rm -f "$f"; done
done
ls -lh "$DRIVE" | grep -v '^total'
# The pulled plaintext (database + full vault) must not outlive the run — it sits unencrypted in $HOME otherwise.
rm -rf "$PULL"
echo "== $(date '+%F %T') done"
