#!/usr/bin/env bash
#
# Copy a camera card or external drive into the archive — from the NAS itself.
#
# Why this exists: the network is not a viable path for video. Measured 7 Sep 2026,
# Mac -> NAS runs at 1.33 MB/s (the Mac is on 2.4 GHz Wi-Fi and the NAS's wired port
# negotiates 100 Mb/s against a Fast-Ethernet router), so 100 GB would take ~21 hours.
# Plugged into the NAS directly, the copy runs at the drive's own speed instead.
#
# THIS SCRIPT NEVER DELETES ANYTHING FROM THE SOURCE. There is no --delete, no rm, no
# move, and no write of any kind to the card: it is mounted READ-ONLY, because until the
# copy is finished and verified the card is the only copy of the footage. If you want the
# card cleared afterwards, do it yourself in the camera, after checking the files landed.
#
# Usage (run on the NAS, as root):
#   sudo -n bash scripts/usb-import.sh                     # find the one USB drive, copy it
#   sudo -n bash scripts/usb-import.sh --dest sony-8sep    # name the destination folder
#   sudo -n bash scripts/usb-import.sh --device /dev/sdd1  # say exactly which device
#   sudo -n bash scripts/usb-import.sh --checksum          # verify every byte, not just sizes
#   sudo -n bash scripts/usb-import.sh --dry-run           # show what would copy, write nothing
#
# Re-running is safe and is how you resume: rsync skips what is already there and
# --partial keeps a half-copied file so an interrupted run continues where it stopped.
set -euo pipefail

# An ssh command runs without sbin on the PATH, and every tool here lives there.
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

DEST_ROOT=/mnt/mainpool/anahon/archive/imports   # the archive dataset, nowhere near the FMS vault
MOUNT=/mnt/import                                # fixed path, so a half-finished run is obvious
DEVICE=""; DEST=""; CHECKSUM=0; DRYRUN=0; ALLOW_LOOP=0

while [ $# -gt 0 ]; do
  case "$1" in
    --device) DEVICE="${2:?--device needs a path like /dev/sdd1}"; shift 2 ;;
    --dest)   DEST="${2:?--dest needs a folder name}"; shift 2 ;;
    --checksum) CHECKSUM=1; shift ;;
    --dry-run)  DRYRUN=1; shift ;;
    --allow-loop) ALLOW_LOOP=1; shift ;;   # for testing this script against a loopback image
    -h|--help) sed -n '2,28p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1 (try --help)" >&2; exit 2 ;;
  esac
done

[ "$(id -u)" = 0 ] || { echo "Run it as root: sudo -n bash $0 $*" >&2; exit 1; }

# ---- 1. Which device? Never assume a letter: sdd today is sdc tomorrow. ----------------
# A candidate carries a filesystem, is not part of the pool, and is not already mounted.
candidates() {
  lsblk -P -o PATH,TYPE,TRAN,FSTYPE,SIZE,LABEL,MOUNTPOINT,PKNAME | while read -r line; do
    eval "$line"
    [ -n "$FSTYPE" ] || continue
    [ "$FSTYPE" != zfs_member ] || continue          # a pool disk is never an import source
    [ "$FSTYPE" != linux_raid_member ] || continue
    [ -z "$MOUNTPOINT" ] || continue                 # already mounted: not newly attached
    case "$TYPE" in part|disk) ;; loop) [ "$ALLOW_LOOP" = 1 ] || continue ;; *) continue ;; esac
    if [ "$TYPE" != loop ]; then
      # usb either on the partition or on the disk it belongs to
      tran="$TRAN"
      [ -n "$tran" ] || tran="$(lsblk -no TRAN "/dev/$PKNAME" 2>/dev/null | head -1 | tr -d ' ')"
      [ "$tran" = usb ] || continue
    fi
    echo "$PATH|$FSTYPE|$SIZE|${LABEL:-no label}"
  done
}

if [ -z "$DEVICE" ]; then
  mapfile -t FOUND < <(candidates)
  case "${#FOUND[@]}" in
    0) echo "No drive found. Plug it in, wait a few seconds, and run this again."
       echo "(Looking for a USB disk or partition that carries a filesystem and is not mounted.)"
       exit 1 ;;
    1) DEVICE="${FOUND[0]%%|*}" ;;
    *) echo "More than one drive could be meant, so I am not guessing. Say which:" >&2
       for f in "${FOUND[@]}"; do IFS='|' read -r p fs sz lb <<<"$f"; printf '  %-14s %-7s %-8s %s\n' "$p" "$fs" "$sz" "$lb" >&2; done
       echo "  sudo -n bash $0 --device <path>" >&2
       exit 1 ;;
  esac
fi

[ -b "$DEVICE" ] || { echo "$DEVICE is not a block device." >&2; exit 1; }
FSTYPE="$(lsblk -no FSTYPE "$DEVICE" | head -1 | tr -d ' ')"
LABEL="$(lsblk -no LABEL "$DEVICE" | head -1 | sed 's/[[:space:]]*$//')"
SIZE="$(lsblk -no SIZE "$DEVICE" | head -1 | tr -d ' ')"
[ "$FSTYPE" != zfs_member ] || { echo "$DEVICE is a ZFS pool member. Refusing." >&2; exit 1; }
[ -n "$FSTYPE" ] || { echo "$DEVICE carries no filesystem I can read." >&2; exit 1; }

echo "Drive   : $DEVICE"
echo "Carries : $FSTYPE${LABEL:+, labelled \"$LABEL\"}, $SIZE"

# ---- 2. The kernel has these modules on disk; they are simply not loaded. ---------------
case "$FSTYPE" in
  exfat)          MOD=exfat ;;
  vfat|fat|fat32) MOD=vfat ;;
  hfsplus|hfs)    MOD=hfsplus ;;
  ntfs|ntfs3)     MOD=ntfs3 ;;
  udf)            MOD=udf ;;
  ext2|ext3|ext4) MOD=ext4 ;;
  *)              MOD="" ;;
esac
if [ -n "$MOD" ] && ! grep -qE "^${MOD} " /proc/modules; then
  echo "Loading : $MOD"
  modprobe "$MOD" || { echo "Could not load $MOD — cannot mount $FSTYPE." >&2; exit 1; }
fi

# ---- 3. Mount READ-ONLY. The card must not be writable while it is the only copy. -------
mkdir -p "$MOUNT"
mountpoint -q "$MOUNT" && { echo "$MOUNT is already in use. Unmount it first: umount $MOUNT" >&2; exit 1; }
mount -o ro,noexec,nosuid,nodev "$DEVICE" "$MOUNT"
cleanup() { mountpoint -q "$MOUNT" && umount "$MOUNT" && echo "Unmounted $MOUNT." || true; }
trap cleanup EXIT
findmnt -no SOURCE,TARGET,FSTYPE,OPTIONS "$MOUNT" | sed 's/^/Mounted : /'
findmnt -no OPTIONS "$MOUNT" | grep -q '\bro\b' || { echo "Refusing: it did not mount read-only." >&2; exit 1; }

# ---- 4. Copy into the archive dataset. -------------------------------------------------
[ -n "$DEST" ] || DEST="$(echo "${LABEL:-drive}" | tr ' /' '--' | tr -cd '[:alnum:]._-')-$(date +%Y%m%d)"
TARGET="$DEST_ROOT/$DEST"
SRC_N=$(find "$MOUNT" -type f | wc -l)
SRC_B=$(find "$MOUNT" -type f -printf '%s\n' | awk '{s+=$1} END {print s+0}')
printf 'Source  : %s files, %s bytes (%.2f GB)\n' "$SRC_N" "$SRC_B" "$(echo "$SRC_B" | awk '{print $1/1073741824}')"
echo "Into    : $TARGET"

if [ "$DRYRUN" = 1 ]; then
  echo "-- dry run: nothing is written --"
  rsync -a --partial --dry-run --itemize-changes "$MOUNT/" "$TARGET/" | head -20
  exit 0
fi

mkdir -p "$TARGET"
START=$(date +%s)
# -a preserves timestamps; --partial keeps a half-copied file so a re-run resumes.
# There is deliberately no --delete: nothing on the card, and nothing already in the
# archive, is ever removed by this script.
# --info=progress2 redraws one progress line, which is right at a terminal and becomes
# hundreds of repeated lines when there is none (ssh without a tty, cron, an agent).
if [ -t 1 ]; then PROGRESS=(--info=progress2); else PROGRESS=(--info=stats2); fi
rsync -a --partial "${PROGRESS[@]}" --human-readable "$MOUNT/" "$TARGET/"
ELAPSED=$(( $(date +%s) - START )); [ "$ELAPSED" -gt 0 ] || ELAPSED=1

# ---- 5. Prove it arrived. --------------------------------------------------------------
DST_N=$(find "$TARGET" -type f | wc -l)
DST_B=$(find "$TARGET" -type f -printf '%s\n' | awk '{s+=$1} END {print s+0}')
echo
echo "              files          bytes"
printf 'source   %10s %14s\n' "$SRC_N" "$SRC_B"
printf 'archive  %10s %14s\n' "$DST_N" "$DST_B"
OK=1
[ "$SRC_N" = "$DST_N" ] || { echo "MISMATCH: file counts differ."; OK=0; }
[ "$SRC_B" = "$DST_B" ] || { echo "MISMATCH: total sizes differ."; OK=0; }

if [ "$CHECKSUM" = 1 ] && [ "$OK" = 1 ]; then
  echo "Checksumming every file (this re-reads both sides)…"
  DIFF=$(rsync -a --dry-run --itemize-changes --checksum "$MOUNT/" "$TARGET/" | grep -v '^\.d' || true)
  if [ -n "$DIFF" ]; then echo "$DIFF" | head -20; echo "MISMATCH: the files above differ by content."; OK=0
  else echo "Every file matches by checksum."; fi
fi

printf 'Copied %s bytes in %s s = %.2f MB/s\n' "$SRC_B" "$ELAPSED" \
  "$(echo "$SRC_B $ELAPSED" | awk '{print $1/$2/1048576}')"
if [ "$OK" = 1 ]; then
  echo "DONE — the card is unchanged and still holds everything. Check the files open, then clear it in the camera."
else
  echo "NOT VERIFIED — leave the card alone and run this again; it resumes." >&2
fi
exit $(( OK == 1 ? 0 : 1 ))
