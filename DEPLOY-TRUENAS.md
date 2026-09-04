# Deploy the FMS to TrueNAS SCALE (192.168.1.22)

The app runs as one Docker container. The SQLite database and document vault live on a
NAS dataset (local disk to the container — never over SMB), snapshotted by ZFS.

## Prerequisites (state on 3 Sep 2026)

1. **Internet on the NAS — DONE.** The NAS now hangs off the office Netis router (LAN3) with DHCP:
   hostname `Anahon`, address 192.168.1.22 (`anahon.local`), internet and DNS verified. The MikroTik
   network (192.168.100.x) is isolated and no longer used by the NAS.
2. **TrueNAS 24.10 or newer — DONE.** Upgraded to Electric Eel 24.10.2.4 on 3 Sep 2026; Docker 27
   runs with its data on `mainpool`. The 24.04.2 boot environment remains selectable for rollback.

**Deployed 3 Sep 2026:** container `anahon-fms` runs from `/mnt/mainpool/anahon/fms/src`, app at
http://192.168.1.22:3100, restart policy unless-stopped. Hourly ZFS snapshots of `mainpool/anahon/fms`,
kept two weeks (snapshot task 4). Two gotchas fixed during the first build: the build stage needs
`openssl` so Prisma generates the openssl-3 engine, and `server.ts` must call `listen` in production
(it used to export the app only, for Vercel).

Pool name is `mainpool` (54.6 TB, 38 TB free). Existing share dataset: `mainpool/server`.

## One-time: on the Mac

```bash
cd ~/antigravity/AnaHon-Financial-Management-System
scp -r Dockerfile docker docker-compose.yml .dockerignore package*.json prisma src public \
      server.ts docgen.ts index.html vite.config.ts tsconfig.json assets metadata.json \
      admin@192.168.1.22:/mnt/mainpool/anahon/fms/src/
```
(Pool is `mainpool` (confirmed 3 Sep 2026). Enable SSH under
System → Services first.)

Then copy the data — database, vault, calendar feed:

```bash
scp prisma/dev.db                          admin@192.168.1.22:/mnt/mainpool/anahon/fms/db/dev.db
scp -r ~/Documents/AnaHon_Document_Vault/. admin@192.168.1.22:/mnt/mainpool/anahon/fms/vault/
scp .calendar-feed.json                    admin@192.168.1.22:/mnt/mainpool/anahon/fms/calendar-feed.json
```

## One-time: on the NAS (System → Shell, or ssh)

1. Create the dataset and folders:
   ```bash
   sudo zfs create -p mainpool/anahon/fms
   sudo mkdir -p /mnt/mainpool/anahon/fms/{src,db,vault}
   sudo chown -R 1000:1000 /mnt/mainpool/anahon/fms/{db,vault}   # uid 1000 = "node" inside the container
   ```
2. Write `/mnt/mainpool/anahon/fms/src/.env` by hand with ONLY:
   ```
   GEMINI_API_KEY=…
   ANTHROPIC_API_KEY=…
   FIREBASE_PROJECT_ID=anahon-financial
   FMS_DATA=/mnt/mainpool/anahon/fms
   ```
   Do not copy the Mac `.env` — its DATABASE_URL/ANAHON_VAULT/PORT are Mac paths and the
   Dockerfile sets the container ones.
3. Build and start:
   ```bash
   cd /mnt/mainpool/anahon/fms/src && sudo docker compose up -d --build
   sudo docker logs -f anahon-fms     # expect "migrate deploy" then the listen line
   ```
4. Open http://192.168.1.22:3100 from any machine on the LAN and log in with Firebase.

## Verify before switching over

- [ ] Login works (Firebase cert fetch needs outbound HTTPS from the NAS).
- [ ] Documents open from the vault (Documents desk → any file).
- [ ] Reports → PDF renders (exercises chromium).
- [ ] Expense → scan invoice (exercises python3 + fitz).
- [ ] Record counts match the Mac: vouchers, bank lines, documents.

## After switch-over

- Snapshots: Data Protection → Periodic Snapshot Tasks → `mainpool/anahon/fms`, hourly, keep 2 weeks.
- Stop running `npm run dev` on the Mac; the NAS copy is now the system of record.
- **The Mac is a one-way mirror** (since 3 Sep 2026): `scripts/mirror_from_nas.sh`, run by launchd
  `org.anahon.fms-mirror` daily at 03:30, pulls `db/dev.db` and `vault/` from the newest ZFS snapshot.
  Never edit the Mac database or vault for real data — it is overwritten by design. File documents
  through the app or directly on the NAS.
- **Schema changes are tracked migrations only** — add a folder under `prisma/migrations/` (hand
  timestamp, see existing names), ship `prisma/` to the NAS `src/`, rebuild. The entrypoint runs
  `prisma migrate deploy`. Never `prisma db push` against the NAS, never hand-run SQL on it.
- Update: re-run the `scp` of source files (never `.env`), then `docker compose up -d --build` again.
  Migrations apply automatically on start.
- `db/` and `vault/` belong to uid 1000; writes there and `docker` need `sudo` on the NAS — run those
  from Saad's terminal. Read-only ssh/rsync and writes to `src/` work as `admin` without sudo.
- Off-site: `scripts/backup_to_drive.sh` via `org.anahon.fms-backup`, **daily 03:00**, from the newest
  ZFS snapshot, AES-256 to Drive `AnaHon_FMS_Cloud_Backup`, two sets kept. Restore-tested 3 Sep 2026.
  The key `~/anahon-archive-keys/anahon-archive-2026-08-17.key` is also in Apple Passwords
  ("AnaHon archive key 2026-08-17") and on paper in the office file.
- LAN fallback: the NAS is `100.91.229.30` on Tailscale (same host key as 192.168.1.22).
- Remote access: Apps → Tailscale, then use the NAS tailnet IP instead of 192.168.1.22.

## Remote access (Tailscale, added 3 Sep 2026)

The NAS runs a Tailscale container from `/mnt/mainpool/anahon/tailscale/docker-compose.yml`
(auth key in `.env` there, mode 600 — written by Saad, never through chat). The FMS is published to
tailnet members only at **https://anahon-1.tailbcb2b7.ts.net** via
`tailscale serve --bg --https=443 http://127.0.0.1:3100` (survives container restarts; state is on disk).

- Give someone access: Tailscale admin → Users → Invite (they install the client and sign in with Google),
  then they open the URL above. Remove them there to revoke. Google sign-in works on that URL because it
  is a Firebase authorized domain.
- HTTPS certificates must stay enabled under Tailscale admin → DNS.
- Why not Cloudflare Tunnel / Vercel: no access to anahon.org DNS (Hostinger) or its registrar; Vercel has
  no local disk for SQLite + vault.

## Website publish hook (3 Sep 2026)

`server.ts` calls `SITE_URL/__publish {id}` after a website-bound item passes the last gate (and after a
correction). Set in `src/.env` on the NAS: `SITE_URL=http://192.168.1.22:4321` (the site container beside
this one; see anahon-astro/DEPLOY-TRUENAS.md). Fire-and-forget — the FMS never waits on the site, and the
site re-reads this database and refuses anything not Published. Log line prefix: `[site]`.


## Live editor (4 Sep 2026)

`src/tabs/LiveTab.tsx` frames the site's dev server (`state.siteUrl` = `SITE_PUBLIC_URL` ‖
`SITE_URL`) — the browser must reach that URL, so on the NAS set
`SITE_URL=http://192.168.1.22:4321` (LAN) in `src/.env`. Routes: `POST /api/website/edit`
(text/image string replace across the four content JSONs, editor roles), `GET
/api/website/library` (pictures under the site's `/uploads/website` + `/images`),
`POST /api/website/build` (→ site `/__build`; audit "Website Published"). See the site's
DEPLOY-TRUENAS.md › Live editor for the publish target.
