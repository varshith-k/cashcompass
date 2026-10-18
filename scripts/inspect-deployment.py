#!/usr/bin/env python3
"""Read-only inventory. Outputs configuration presence, never credential values.
Run over an authenticated SSH connection: ssh ... python3 - < this-file.py
"""
import json
import os
import pathlib
import re
import subprocess

NAMES = ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "AUTH0_SECRET", "APP_BASE_URL", "DATABASE_URL", "GEMINI_API_KEY", "GEMINI_MODEL", "NESSIE_API_KEY", "NESSIE_CUSTOMER_ID", "NESSIE_ACCOUNT_ID", "SOLANA_RPC_ENDPOINT", "SOLANA_DEMO_RECIPIENT_ADDRESS"]

def command(arguments):
    try:
        result = subprocess.run(arguments, capture_output=True, text=True, timeout=15, check=False)
        return result.stdout if result.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None

def presence(values):
    return {name: "present" if values.get(name, "").strip().strip("\"'") else "missing" for name in NAMES}

def file_presence(path):
    try:
        content = pathlib.Path(path).read_text()
        values = dict(re.findall(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", content, re.MULTILINE))
        return {"path": str(path), "variables": presence(values)}
    except (OSError, UnicodeDecodeError):
        return None

report = {"hostname": os.uname().nodename, "docker_available": False, "containers": [], "compose_projects": [], "environment_files": [], "process_managers": []}
ids = command(["docker", "ps", "-aq"])
if ids is not None:
    report["docker_available"] = True
    if ids.split():
        inspected = command(["docker", "inspect", *ids.split()])
        for item in json.loads(inspected or "[]"):
            config = item.get("Config", {})
            labels = config.get("Labels") or {}
            environment = dict(entry.split("=", 1) for entry in config.get("Env", []) if "=" in entry)
            image = command(["docker", "image", "inspect", item["Image"]])
            image_labels = (json.loads(image)[0].get("Config", {}).get("Labels") or {}) if image else {}
            revision = image_labels.get("org.opencontainers.image.revision", "unknown")
            if not re.fullmatch(r"[0-9a-f]{7,40}", revision):
                revision = "unknown"
            report["containers"].append({
                "name": item.get("Name", "").lstrip("/"), "image": config.get("Image"), "image_id": item.get("Image"),
                "status": item.get("State", {}).get("Status"), "health": item.get("State", {}).get("Health", {}).get("Status"), "revision": revision,
                "compose_project": labels.get("com.docker.compose.project"), "compose_service": labels.get("com.docker.compose.service"),
                "compose_files": labels.get("com.docker.compose.project.config_files"), "working_directory": config.get("WorkingDir"),
                "variables": presence(environment),
                "mounts": [{"type": mount.get("Type"), "source": mount.get("Source"), "destination": mount.get("Destination")} for mount in item.get("Mounts", [])],
            })
            if item.get("State", {}).get("Running"):
                probe = "try { require('@next/env').loadEnvConfig(process.cwd(), false, {info(){},error(){}}); } catch {} const names = " + json.dumps(NAMES) + "; console.log(JSON.stringify(Object.fromEntries(names.map(name => [name, process.env[name]?.trim() ? 'present' : 'missing']))));"
                configured = command(["docker", "exec", item["Id"], "node", "-e", probe])
                if configured:
                    try:
                        effective = json.loads(configured)
                        if set(effective) == set(NAMES) and set(effective.values()) <= {"present", "missing"}:
                            report["containers"][-1]["effective_application_variables"] = effective
                    except (ValueError, TypeError):
                        pass
            working = labels.get("com.docker.compose.project.working_dir")
            if working:
                for name in [".env", ".env.local", ".env.production", ".env.production.local"]:
                    found = file_presence(pathlib.Path(working) / name)
                    if found:
                        report["environment_files"].append(found)
    projects = command(["docker", "compose", "ls", "--all", "--format", "json"])
    if projects:
        report["compose_projects"] = json.loads(projects)
units = command(["systemctl", "list-units", "--type=service", "--all", "--no-legend", "--no-pager"])
if units:
    report["process_managers"] = [line.split()[0] for line in units.splitlines() if re.search(r"cashcompass|pm2|coolify|dokploy", line, re.IGNORECASE)]
# The repository also documents a host-based PM2 deployment. Read its known
# configuration sources without invoking PM2 (which can start its daemon).
for directory in [pathlib.Path("/root/cashcompass"), pathlib.Path("/opt/cashcompass-deploy/current")]:
    if directory.is_dir():
        for name in [".env", ".env.local", ".env.production", ".env.production.local"]:
            found = file_presence(directory / name)
            if found and found not in report["environment_files"]:
                report["environment_files"].append(found)
report["host_application_processes"] = []
proc = pathlib.Path("/proc")
if proc.is_dir():
    for entry in proc.iterdir():
        if not entry.name.isdigit():
            continue
        try:
            working = (entry / "cwd").resolve(strict=True)
            if "cashcompass" not in str(working).lower():
                continue
            environment = dict(value.split("=", 1) for value in (entry / "environ").read_text().split("\0") if "=" in value)
            report["host_application_processes"].append({"pid": int(entry.name), "working_directory": str(working), "variables": presence(environment)})
        except (OSError, UnicodeDecodeError):
            continue
timer = command(["systemctl", "is-active", "cashcompass-deploy.timer"])
report["deployment_timer_active"] = bool(timer and timer.strip() == "active")
print(json.dumps(report, indent=2))
