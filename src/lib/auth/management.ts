import "server-only";
import { isAuth0Configured } from "./config";

/**
 * Minimal Auth0 Management API client for profile editing. Uses the app's
 * own client credentials, so the CashCompass application must be authorized
 * for the Auth0 Management API with the `update:users` scope and the
 * Client Credentials grant enabled (docs/AUTH0_SETUP.md §6). Opt-in with
 * AUTH0_PROFILE_EDITING=true so the UI never offers a save that will fail.
 */
export function isProfileEditingEnabled(): boolean {
  return process.env.AUTH0_PROFILE_EDITING === "true" && isAuth0Configured();
}

// The Management API lives on the canonical tenant domain, which differs
// from AUTH0_DOMAIN when a custom login domain is used.
function managementDomain(): string {
  return process.env.AUTH0_MANAGEMENT_DOMAIN || process.env.AUTH0_DOMAIN!;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getManagementToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const domain = managementDomain();
  const response = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: process.env.AUTH0_CLIENT_ID,
      client_secret: process.env.AUTH0_CLIENT_SECRET,
      audience: `https://${domain}/api/v2/`,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Management API token request failed with status ${response.status}`);
  }

  const body = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
}

/** Sets the user's display name in Auth0. `userId` is the Auth0 `sub` from the verified session. */
export async function updateAuth0UserName(userId: string, name: string): Promise<void> {
  const token = await getManagementToken();
  const response = await fetch(`https://${managementDomain()}/api/v2/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Management API user update failed with status ${response.status}`);
  }
}
