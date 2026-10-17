// Auth route helpers and route-protection policy.
// Safe to import from Server Components, Client Components, and proxy.ts.

/** Routes mounted by @auth0/nextjs-auth0 v4 through `auth0.middleware()` in src/proxy.ts. */
export const AUTH_ROUTES = {
  login: "/auth/login",
  logout: "/auth/logout",
  callback: "/auth/callback",
  profile: "/auth/profile",
  accessToken: "/auth/access-token",
} as const;

/** App-owned (not SDK) page that explains failed sign-ins. */
export const AUTH_ERROR_PATH = "/auth-error";

/** Where users land after signing in when no `returnTo` was requested. */
export const DEFAULT_SIGNED_IN_PATH = "/overview";

/**
 * Pages anyone can open ("/" only redirects to /overview). Every other page
 * and API route requires a session (default-deny), so new financial routes
 * are protected automatically. Add a path here only for genuinely public content.
 */
export const PUBLIC_PATHS: readonly string[] = ["/", AUTH_ERROR_PATH];

/** Prefixes that are always public (SDK auth routes and public APIs). */
export const PUBLIC_PREFIXES: readonly string[] = ["/auth/", "/api/public/"];

export function isPublicPath(pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (PUBLIC_PATHS.includes(normalized)) return true;
  return PUBLIC_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/**
 * Accepts only same-origin relative paths, so `returnTo` can't become an
 * open redirect (rejects "//evil.com", "https://…", "/\\evil.com", etc.).
 */
export function safeReturnTo(value: string | null | undefined, fallback = DEFAULT_SIGNED_IN_PATH): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  if (value === AUTH_ERROR_PATH || value.startsWith("/auth/")) return fallback;
  return value;
}

type LoginOptions = {
  returnTo?: string;
  /** Skip the Universal Login chooser and go straight to a connection, e.g. "google-oauth2". */
  connection?: string;
  /** Show the login screen even if Auth0 already has a session (switch or add an account). */
  forceLogin?: boolean;
};

function buildLoginHref(options: LoginOptions, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({ returnTo: safeReturnTo(options.returnTo), ...extra });
  if (options.connection) params.set("connection", options.connection);
  if (options.forceLogin) params.set("prompt", "login");
  return `${AUTH_ROUTES.login}?${params.toString()}`;
}

/** Universal Login, log-in tab. */
export function loginHref(options: LoginOptions = {}): string {
  return buildLoginHref(options);
}

/** Universal Login, sign-up tab ("Get started"). */
export function signupHref(options: LoginOptions = {}): string {
  return buildLoginHref(options, { screen_hint: "signup" });
}

/** Ends the app session and the Auth0 session, then returns to the landing page. */
export function logoutHref(): string {
  return AUTH_ROUTES.logout;
}
