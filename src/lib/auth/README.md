# Auth boundary

Everything in this directory is the seam for the Auth0 integration. The rest
of the app (shell, dashboard, every page) only ever imports from here —
`getSession()` on the server, `useAuth()` on the client — never from an
Auth0 package directly. That means the Auth0 work can happen without
touching, or conflicting with, any UI code.

## Current state (demo mode)

- `demo-user.ts` — the one hardcoded demo user.
- `session.ts` — `getSession()` / `requireSession()`, server-only, always
  returns the demo user wrapped in a session.
- `provider.tsx` — `AuthProvider` (wraps the app in
  `src/app/(app)/layout.tsx`) and the `useAuth()` hook client components use
  for `user`, `status`, `loginHref`, `logoutHref`.
- `src/app/api/auth/{login,logout,callback,me}/route.ts` — stub routes that
  redirect back into the app. Paths match the `@auth0/nextjs-auth0`
  convention on purpose.

## Wiring up Auth0

1. `npm install @auth0/nextjs-auth0`
2. Fill in the `AUTH0_*` values in `.env.local` (see `.env.example`):
   `AUTH0_SECRET`, `AUTH0_BASE_URL`, `AUTH0_ISSUER_BASE_URL`,
   `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`.
3. Replace the bodies of the four stub routes with the SDK's handlers
   (`handleLogin`, `handleLogout`, `handleCallback`, `handleProfile` or
   equivalent for the installed SDK version). Keep the file paths as-is.
4. Replace the body of `getSession()` in `session.ts` with the SDK's
   session lookup, keeping the `AuthSession | null` return type in
   `types.ts` (add fields if Auth0 gives you more than `id`/`name`/`email`,
   but don't remove any — callers rely on them).
5. If route protection is needed, add it in `src/proxy.ts` (Next 16 renamed
   `middleware.ts` → `proxy.ts`) by calling `getSession()`; nothing else
   needs to change.

Nothing outside this directory and the four stub routes should need to
change. If a UI component needs a new field on `AuthUser`, add it to
`types.ts` and keep `demo-user.ts` in sync so the app still runs without
real Auth0 credentials configured.
