# Auth boundary

Everything in this directory is the seam between Auth0 and the rest of the app. The shell, dashboard and every page import only from here: `getSession()` / `requireSession()` / `withSession()` on the server, and `useAuth()` on the client. Nothing else imports `@auth0/nextjs-auth0` directly.

Full contract: [`docs/AUTH_INTEGRATION_CONTRACT.md`](../../../docs/AUTH_INTEGRATION_CONTRACT.md). Tenant setup: [`docs/AUTH0_SETUP.md`](../../../docs/AUTH0_SETUP.md).

## Files

- `session.ts` (server-only). Reads the Auth0 session:
  - `getSession()` returns `AuthSession | null`.
  - `requireSession(returnTo?)` redirects to login when signed out.
  - `withSession(handler)` wraps a Route Handler and returns 401 JSON when signed out.
- `provider.tsx`. `AuthProvider` wraps the app in `src/app/(app)/layout.tsx`. `useAuth()` returns `{ user, status, source, loginHref, signupHref, logoutHref }`.
- `types.ts`. `AuthUser` (`id` is the Auth0 `sub`), `AuthSession` and `AuthStatus`.
- `routes.ts`. Auth URLs, `returnTo` sanitizing, and the public-path allowlist.
- `ownership.ts`. `withOwner` / `assertOwnedBy` / `onlyOwnedBy` for per-user data.
- `config.ts`. Demo-mode detection.
- `map-user.ts`, `errors.ts`. Internal helpers.
- `../auth0.ts`. The SDK client. `../../proxy.ts` mounts the SDK routes and gates every non-public route.

## Modes

| Auth0 env vars | `NODE_ENV` | Behavior |
|---|---|---|
| All set | any | Real Auth0: Universal Login, Google if enabled, encrypted session cookie |
| Missing | development | **Demo mode**: every request is `DEMO_USER`, nothing is gated, `source: "demo"` |
| Missing | production | No demo fallback. Protected routes redirect to login, which shows `/auth-error` |

## Routes (SDK v4, mounted by `src/proxy.ts`)

`/auth/login` (`?returnTo=/path`, `&screen_hint=signup`, `&connection=google-oauth2`), `/auth/callback`, `/auth/logout`, `/auth/profile`. Link to them with a plain `<a href>`, not `<Link>`. `/api/auth/me` returns the session as JSON.

If a UI component needs a new field on `AuthUser`, add it to `types.ts`, `map-user.ts` and `demo-user.ts`.
