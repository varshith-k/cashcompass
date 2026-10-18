# Deployment and access

The Vultr marketplace Docker image provides Docker; it does not establish a GitHub deployment workflow. The newly pulled [Vultr guide](DEPLOYMENT_VULTR.md) reports an existing nginx/PM2 deployment and a systemd timer polling `main` every two minutes. This session has not independently authenticated to verify those server settings. The repository's `Verify` workflow runs checks only.

## Current access and approval boundary

The user supplied `root@66.42.81.135`, port 22, Ubuntu 24.04, Docker marketplace image. SSH reached the host but existing key authentication was denied. Running containers, Compose projects, environment configuration and deployment automation have not yet been inspected. Do not infer an application manager from the marketplace image.

The user authorized pushing/pulling code and read-only server inspection. Report inspection findings and obtain approval before restarting, rebuilding, migrating, redeploying, or otherwise changing the server application. Publish this release to `release/production-readiness`; merging it into `main` requires deployment review because the reported timer can deploy it automatically. No temporary public key was added, and the local agent currently has no identities.

Never put passwords, private keys, API keys, database URLs, raw `docker inspect`, raw environment files or `docker compose config` output in chat or logs. Presence reports say only `present` or `missing`; presence does not prove validity.

## Windows SSH setup

In normal PowerShell, create a named key and enter a passphrase locally. If that path already exists, retain it or choose another filename rather than overwriting it.

```powershell
$sshKeyPath = "$env:USERPROFILE\.ssh\cashcompass_vultr"
New-Item -ItemType Directory -Force "$env:USERPROFILE\.ssh" | Out-Null
ssh-keygen -t ed25519 -a 100 -f $sshKeyPath -C cashcompass-vultr
```

In Administrator PowerShell, enable the Windows agent:

```powershell
Set-Service -Name ssh-agent -StartupType Automatic
Start-Service ssh-agent
```

Back in normal PowerShell:

```powershell
ssh-add $sshKeyPath
Get-Content "${sshKeyPath}.pub" -Raw | Set-Clipboard
```

Through the Vultr Ubuntu web console, logged in as root, append the copied **public** key as one line. Preserve any existing authorized keys:

```bash
install -d -m 700 /root/.ssh
cat >> /root/.ssh/authorized_keys <<'EOF'
PASTE_THE_COPIED_PUBLIC_KEY_HERE
EOF
chmod 600 /root/.ssh/authorized_keys
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Compare that public host fingerprint with the initial SSH prompt before trusting the connection:

```powershell
ssh -i $sshKeyPath -o IdentitiesOnly=yes root@66.42.81.135 hostname
```

The assistant environment has a separate filesystem and agent. A key loaded on Windows does not authorize it. When the user chooses assistant access, generate a separate temporary key locally, authorize only its public key with the `restrict` option, and verify the console-provided host fingerprint. The private key must remain on its originating machine. After the inspection, remove only the temporary public-key line through the console and delete the temporary local key.

Reference: [Microsoft OpenSSH key management](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_keymanagement).

## Read-only inspection

The reviewed `scripts/inspect-deployment.py` captures Docker metadata internally and prints sanitized container/image identity, status, Compose project/configuration paths, mounts, relevant systemd units/timer status, host application process configuration and recognized environment names with presence only. An optional Node probe reads effective configuration in a short-lived process without starting the application. It does not restart containers or write configuration. A missing variable in one source may be configured in another; report each source distinctly.

From the repository on Windows:

```powershell
Get-Content -Raw .\scripts\inspect-deployment.py | ssh -i $sshKeyPath -o IdentitiesOnly=yes root@66.42.81.135 python3 -
```

Inspect Auth0's five settings (`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`, `APP_BASE_URL`), `DATABASE_URL`, `GEMINI_API_KEY`, and `NESSIE_API_KEY` plus a configured Nessie customer/account. Model and devnet RPC/recipient overrides are optional. Report missing credentials without their values. Inventory alone does not verify sign-in, API permissions, database migrations, or billing.

## Prepared release artifacts

- `Dockerfile`: Node 22 multistage standalone build; runtime user 1001; no copied environment/key files. It enables `CASHCOMPASS_OUTPUT=standalone` during build. Normal builds retain `next start` compatibility for the documented PM2 manager. Docker is an optional artifact, not a required replacement for PM2. Build on a separate machine/CI and transfer a verified image if Docker is chosen.
- `deploy/compose.example.yaml`: review-only example with localhost port binding, read-only root filesystem, writable temporary/cache mounts, dropped capabilities and a memory limit. Adapt it to the actual reverse proxy and deployment manager after inspection. Do not replace an unidentified existing deployment with the example.
- `/api/public/health`: 200 only when core authentication configuration, database connectivity and required tables/ownership columns are ready; otherwise 503. Returns only readiness and an optional validated build revision. It does not authenticate against external services. Build with `--build-arg GIT_REVISION=<40-character-commit>` to expose release identity; local uncommitted images report `unknown`.
- `npm run check:env`: local/server configuration presence report only. Exit code 1 means required core/integration configuration is missing. `-- --core-only` reports the same names while requiring only authentication/database configuration for startup.
- `scripts/deploy-vultr.sh`: prepared core preflight and database-aware candidate/live health checks. Before merging this release into `main`, review/install the revised server script and migrate the intended database with explicit approval. The previously documented installed copy only checked `/`, which can pass while financial pages cannot load; repository edits do not update that installed copy.
- `npm run db:migrate`: additive schema setup for TimescaleDB, including durable planning profiles. Run only against the intended database after reviewing existing schema, taking a backup and obtaining production approval. It reports only success or an error class/code.

## Approval-ready deployment sequence

1. Finish the read-only inventory and identify current release, auto-deploy trigger, ingress/TLS, environment source, database version/schema and backup path. Present the findings and proposed diff.
2. Verify live Auth0 callback/logout URLs, isolated test-user access, Gemini/photo requests, selected Nessie sandbox sync, and optional funded Solana devnet transfer with user-controlled credentials/wallet authorization. Do not claim these passed from local contract tests.
3. Prepare a versioned image from reviewed code; record the previous image/configuration for rollback. Obtain user approval for the concrete server/migration/release changes.
4. Apply only the approved migration and manager-specific image update. Check readiness, TLS and authenticated routes; repeat a non-destructive smoke flow with a test account. Verify the published revision matches the approved commit.
5. Restore the previous image/configuration if checks fail, keeping database backups intact. Remove temporary SSH authorization when the inspection/deployment session is complete.
