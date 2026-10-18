# Automatic deployment on Vultr

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
In-memory budgets, goals, and other process-local data reset on deployment.

Changes to the deployment scripts in GitHub do not install themselves into
systemd: upload revised scripts/units explicitly and reload systemd.

## Production configuration

Commit `671a5b5718e31744ed2b731b39f78a17fe60939c` is deployed. The HTTPS
homepage returns 200, signed-out `/api/auth/me` returns 401, and `/overview`
redirects signed-out visitors to login.

`/root/cashcompass/.env.production.local` contains the production Auth0 and
Gemini settings, APP_BASE_URL, and a server-generated AUTH0_SECRET. Local
development settings are in the git-ignored `.env.local`; local and production
cookie secrets are separate.

The remaining login blocker is an Auth0 callback URL mismatch. In the Auth0
application settings, allow these URLs (preserve any existing entries):

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
