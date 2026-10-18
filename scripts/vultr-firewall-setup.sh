#!/usr/bin/env bash
# One-time setup: creates (or reuses) a Vultr Cloud Firewall group allowing
# SSH/HTTP/HTTPS and attaches it to the CashCompass instance. Free — Vultr
# Cloud Firewall has no extra cost, unlike Auto Backups.
#
# Run manually, not from the deploy timer. Dry-run by default: prints what
# it would do without changing anything. Pass --apply to actually create
# rules and attach the group — attaching a misconfigured firewall to a live
# box can lock out SSH, so review the dry-run output first.
#
# Requires: VULTR_API_KEY, VULTR_INSTANCE_ID (see .env.example), curl, jq.
#
# Usage:
#   VULTR_API_KEY=... VULTR_INSTANCE_ID=... ./scripts/vultr-firewall-setup.sh
#   VULTR_API_KEY=... VULTR_INSTANCE_ID=... ./scripts/vultr-firewall-setup.sh --apply

set -Eeuo pipefail

API="https://api.vultr.com/v2"
GROUP_DESCRIPTION="cashcompass-production"
APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

: "${VULTR_API_KEY:?Set VULTR_API_KEY}"
: "${VULTR_INSTANCE_ID:?Set VULTR_INSTANCE_ID}"
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }

auth=(-H "Authorization: Bearer $VULTR_API_KEY" -H "Content-Type: application/json")

echo "Looking for an existing '$GROUP_DESCRIPTION' firewall group..."
existing_id=$(curl -s "${auth[@]}" "$API/firewalls" \
  | jq -r --arg d "$GROUP_DESCRIPTION" '.firewall_groups[]? | select(.description == $d) | .id' \
  | head -n1)

if [[ -n "$existing_id" ]]; then
  echo "Found existing group: $existing_id (rules are not modified on re-run)"
  group_id="$existing_id"
else
  echo "No existing group. Would create one named '$GROUP_DESCRIPTION' with rules:"
  echo "  - tcp/22  (SSH)   from 0.0.0.0/0  — matches the instance's current unrestricted access; tighten the subnet yourself once you know your admin IP"
  echo "  - tcp/80  (HTTP)  from 0.0.0.0/0"
  echo "  - tcp/443 (HTTPS) from 0.0.0.0/0"
  if (( APPLY == 0 )); then
    echo
    echo "Dry run only — nothing changed. Re-run with --apply to create and attach it."
    exit 0
  fi
  group_id=$(curl -s "${auth[@]}" -X POST "$API/firewalls" \
    -d "{\"description\":\"$GROUP_DESCRIPTION\"}" | jq -r '.firewall_group.id')
  echo "Created group: $group_id"

  add_rule() {
    local port=$1 note=$2
    curl -s "${auth[@]}" -X POST "$API/firewalls/$group_id/rules" \
      -d "{\"ip_type\":\"v4\",\"protocol\":\"tcp\",\"subnet\":\"0.0.0.0\",\"subnet_size\":0,\"port\":\"$port\",\"notes\":\"$note\"}" \
      >/dev/null
    echo "  Added rule: tcp/$port ($note)"
  }
  add_rule 22 "SSH"
  add_rule 80 "HTTP"
  add_rule 443 "HTTPS"
fi

if (( APPLY == 0 )); then
  echo
  echo "Dry run only — group exists but is not attached. Re-run with --apply to attach it to $VULTR_INSTANCE_ID."
  exit 0
fi

echo "Attaching $group_id to instance $VULTR_INSTANCE_ID..."
curl -s "${auth[@]}" -X PATCH "$API/instances/$VULTR_INSTANCE_ID" \
  -d "{\"firewall_group_id\":\"$group_id\"}" >/dev/null
echo "Done. Verify SSH access in a NEW terminal before closing your current session —"
echo "a mistake here can lock you out."
