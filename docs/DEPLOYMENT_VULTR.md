# Automatic deployment on Vultr

> This guide records the previously reported server setup. The current release branch has not authenticated to independently confirm it. Before merging the production-readiness release, review/install its updated deployment script, configure durable storage, back up and migrate the intended database, and verify core readiness. No server changes are authorized from this session until findings are presented and approved.

## Active server setup

CashCompass runs at https://cashcompass.club on Vultr instance 66.42.81.135.
Nginx provides HTTPS and proxies to PM2 on port 8000. This existing setup is
preserved; Coolify and Docker are not required for the active deployment.

The `cashcompass-deploy.timer` systemd timer checks `origin/main` every two
minutes, using the existing GitHub SSH deploy key. Pushes to another branch
do not deploy until merged into main. GitHub Actions secrets are not needed.

The deploy script archives the new commit into `/opt/cashcompass-deploy/releases`,
copies the existing server environment files, installs dependencies, runs the
available tests, and builds with an isolated Node 22 runtime. The lockfile
requires `npm ci --legacy-peer-deps`; ordinary `npm ci` fails peer resolution.
An exclusive lock prevents concurrent builds. A temporary server on loopback
port 8001 must pass an HTTP check before PM2 switches the live port 8000.
Build failures leave the current process running. A failed live health check
restores the previous release. Switching processes causes a short interruption.
Each release has a distinct PM2 process name so its working directory and
startup arguments are explicit. The previous process is stopped and retained
for rollback. `current-app` and `previous-app` record the PM2 names.

Server files:

- `/opt/cashcompass-deploy/deploy.sh`: installed copy of `scripts/deploy-vultr.sh`.
- `/opt/cashcompass-deploy/node`: isolated Node 22 runtime.
- `/opt/cashcompass-deploy/current` and `previous`: release links.
- `/opt/cashcompass-deploy/deployed-commit`: last successful commit.
- `/etc/systemd/system/cashcompass-deploy.{service,timer}`: systemd units.
- `/root/cashcompass`: original checkout and environment configuration source.

Check status and logs over SSH:

```sh
systemctl status cashcompass-deploy.timer
journalctl -u cashcompass-deploy.service -n 80 --no-pager
pm2 status
```

Run a check immediately with `systemctl start cashcompass-deploy.service`.
Failed commits are not rebuilt repeatedly. After fixing server configuration,
retry the same commit with `FORCE_DEPLOY=1 /opt/cashcompass-deploy/deploy.sh`.
Pause automatic deployment with `systemctl stop cashcompass-deploy.timer`;
resume with `systemctl start cashcompass-deploy.timer`.

Environment files stay on the server and are copied with mode 600 into each
new release. To change settings, edit the files in `/root/cashcompass` and
deploy again. Existing releases are retained for recovery: monitor disk space
and remove obsolete releases only after checking the current/previous links.
The HTTP health check verifies server startup, not sign-in or finance workflows.
The production-readiness release persists budgets, goals, checkpoints, account snapshots and sync state in `planning_profiles` alongside financial events and receipts. It requires `DATABASE_URL` and the updated schema. Earlier process-local data resets on deployment and has no durable migration source after a restart.

Changes to the deployment scripts in GitHub do not install themselves into
systemd: upload revised scripts/units explicitly and reload systemd.

## Production configuration

The earlier server report recorded commit `671a5b5718e31744ed2b731b39f78a17fe60939c` as deployed. Recheck the current release before making changes. The HTTPS
homepage returns 200, signed-out `/api/auth/me` returns 401, and `/overview`
redirects signed-out visitors to login.

`/root/cashcompass/.env.production.local` contains the production Auth0 and
Gemini settings, APP_BASE_URL, and a server-generated AUTH0_SECRET. Local
development settings are in the git-ignored `.env.local`; local and production
cookie secrets are separate.

An earlier report identified an Auth0 callback URL mismatch. The October 17 follow-up public probe now reaches Universal Login with the expected production callback and no detected mismatch error. Full sign-in/callback/logout verification still needs a user-controlled test session. If a mismatch recurs, check these Auth0 application URLs (preserve any existing entries):

| Setting | URLs |
| --- | --- |
| Allowed Callback URLs | `http://localhost:3000/auth/callback`, `https://cashcompass.club/auth/callback` |
| Allowed Logout URLs | `http://localhost:3000`, `https://cashcompass.club` |
| Allowed Web Origins | `http://localhost:3000`, `https://cashcompass.club` |

Save the Auth0 application settings, then retry login. This URL-list change
does not require redeployment.

After changing server environment values, redeploy with:

```sh
FORCE_DEPLOY=1 /opt/cashcompass-deploy/deploy.sh
```

The generated secret is stored only on the server. Never commit production
environment files or paste their values into chat.

## Bill email reminders

Bills & Payments lets users turn on "Remind me by email" per bill (days before + time, in their own time zone). An hourly job sends the due ones through Resend.

1. Add to `/root/cashcompass/.env.production.local` (alongside `RESEND_API_KEY` and `EMAIL_FROM`), then redeploy with `FORCE_DEPLOY=1 /opt/cashcompass-deploy/deploy.sh`:
   ```
   CRON_SECRET=<output of: openssl rand -hex 32>
   ```
2. Install the timer:
   ```sh
   cp scripts/cashcompass-reminders.service scripts/cashcompass-reminders.timer /etc/systemd/system/
   systemctl daemon-reload
   systemctl enable --now cashcompass-reminders.timer
   ```
3. Check it: `systemctl start cashcompass-reminders.service && journalctl -u cashcompass-reminders.service -n 5`. The response shows `{"checked":…,"sent":…}`.

Reminders go to each user's own login email. While Resend uses the test sender (no verified domain), only the Resend account owner's address receives them. With a database (`DATABASE_URL`), run `db/schema.sql` again to create the `bill_reminders` table; without one, reminders are kept in memory and reset on redeploy.

## Vultr platform features

Four things worth having on a production instance: pre-deploy snapshots, a cloud firewall, automatic backups, and monitoring. The first two are scripted here; the other two are dashboard toggles this repo doesn't automate.

### Pre-deploy snapshots (automated)

`scripts/deploy-vultr.sh` requests a whole-disk snapshot via the Vultr API right before every deploy, tagged with the commit and timestamp (`pre-deploy-<commit>-<timestamp>`). It's a safety net on top of the existing PM2/release rollback: that rollback only restores the app process if the new build fails its health check, while a snapshot can restore the entire disk if something goes wrong at the OS level.

It's best-effort and non-blocking by design: without `VULTR_API_KEY`/`VULTR_INSTANCE_ID` set, it logs that it's skipping and the deploy proceeds exactly as before. If the Vultr API call itself fails (bad key, network blip, rate limit), it logs the failure and the deploy still proceeds — a flaky API call must never block a real deploy. Verified locally: the skip path and the API-failure path both leave the script exiting `0` and continuing.

To enable it, add `VULTR_API_KEY` and `VULTR_INSTANCE_ID` to `/root/cashcompass/.env.production.local` (values the deploy script reads directly as shell env vars, not through Next.js — export them in the shell that runs the systemd timer, e.g. `/etc/systemd/system/cashcompass-deploy.service`'s `Environment=` lines, since `.env.production.local` is for the Next.js app, not the deploy script itself).

Snapshots aren't free storage — Vultr bills for snapshot storage by the GB-month. Prune old ones periodically from **Products → Snapshots** in the dashboard, or via `DELETE /v2/snapshots/{id}`.

### Cloud firewall (scripted, manual run)

`scripts/vultr-firewall-setup.sh` creates a Cloud Firewall group (`cashcompass-production`) allowing SSH/HTTP/HTTPS and attaches it to the instance. No cost — Vultr Cloud Firewall is free.

Run it by hand, not from the deploy timer:

```sh
VULTR_API_KEY=... VULTR_INSTANCE_ID=... ./scripts/vultr-firewall-setup.sh            # dry run: prints what it would do
VULTR_API_KEY=... VULTR_INSTANCE_ID=... ./scripts/vultr-firewall-setup.sh --apply    # actually creates + attaches
```

It defaults to allowing SSH from anywhere (`0.0.0.0/0`), matching the instance's current unrestricted access — attaching the group is not meant to suddenly cut off SSH. Once it's attached, tighten the SSH rule to your admin IP from the Vultr dashboard (**Products → Firewall → cashcompass-production**) or by editing the rule via the API. **Verify SSH access in a second terminal before closing your current session** — a bad firewall rule can lock you out, and recovering from that needs the Vultr console (serial/VNC access via the dashboard), not SSH.

### Automatic backups (dashboard only, costs money)

Vultr Auto Backups isn't scripted here deliberately: it's a recurring cost (roughly +20% of the instance's monthly price), so enabling it is a billing decision, not a default. To turn it on: **instance → Settings → Backups → Enable**. Vultr then takes a daily backup on its own schedule, independent of deploys.

Auto Backups (scheduled, billed) and the pre-deploy snapshot script above (on-demand, billed separately by storage) are complementary, not duplicates — keep both if the extra cost is acceptable, or just the pre-deploy snapshots if not.

### Monitoring (already included, no setup)

Every Vultr instance ships with CPU, disk, and network graphs at no extra cost — **instance → Overview** in the dashboard already shows them. Nothing in this repo needs to change for that; there's no monitoring API integration here because there's nothing to integrate against the app itself (it's infrastructure-level, not app-level, metrics).
