# CashCompass — Auth Integration Contract

The agreement between the **Auth0 module** (branch `feature/auth0-integration`) and the **frontend**: shell, dashboard, design system and copilot.

The frontend already had an auth boundary in `src/lib/auth/` (commit `e523a87`). Auth0 is plugged into **that** boundary. The types, function names and `useAuth()` shape that UI code depends on are unchanged; fields were only added. UI code never imports `@auth0/nextjs-auth0`.

- SDK: `@auth0/nextjs-auth0` **4.32.x** on **Next.js 16.4** (App Router, `src/proxy.ts`, `cacheComponents` off).
- Flow: OAuth 2.0 / OIDC Authorization Code Flow with PKCE, as an Auth0 **Regular Web Application**. The client secret stays on the server.
- Session: encrypted `httpOnly` `SameSite=Lax` cookie named `__session`. It is rolling: 3 days idle, 14 days max. No tokens reach browser JavaScript.

---

## 1. Types — `@/lib/auth/types`

```ts
interface AuthUser {
  id: string;          // Auth0 `sub`, e.g. "auth0|65f…" / "google-oauth2|10…". The ONLY identity key.
  name: string;        // never empty: falls back to nickname → email local-part → "CashCompass member"
  email: string;       // "" if the IdP gave none. Display only — never a key.
  avatarUrl?: string;  // Auth0/Google profile picture
}

interface AuthSession {
  user: AuthUser;
  expiresAt: string;   // ISO, absolute session expiry
  source: "auth0" | "demo";   // NEW
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated";
```

## 2. Modes

| Auth0 env vars | `NODE_ENV` | Behavior |
|---|---|---|
| All 4 set | any | **Real Auth0**: Universal Login, Google if enabled, protected routes |
| Missing | development | **Demo mode**: every request is `DEMO_USER` (Jordan Rivera), nothing is gated, `source: "demo"`. Teammates without credentials keep working |
| Missing | production | **Fails closed.** Pages go to `/auth-error?code=configuration`, APIs return 503. No demo fallback |

## 3. Client — `useAuth()` from `@/lib/auth/provider`

`AuthProvider` is already mounted in `src/app/(app)/layout.tsx` with the server session.

```ts
const { user, status, source, loginHref, signupHref, logoutHref } = useAuth();
```

| Field | Value |
|---|---|
| `user` | `AuthUser \| null` |
| `status` | `"authenticated"` or `"unauthenticated"`. It never sits at `loading`, because the session is resolved on the server before render, so protected content never flashes |
| `source` | `"auth0"`, `"demo"` or `null`. **New** — use it for the "Demo account" badge in Settings |
| `loginHref` | `/auth/login?returnTo=%2Foverview` |
| `signupHref` | `/auth/login?returnTo=%2Foverview&screen_hint=signup`. **New** — for a "Get started" button |
| `logoutHref` | `/auth/logout` (changed from the old `/api/auth/logout` stub) |

Render these as plain `<a href>`, e.g. `<Button render={<a href={logoutHref}>Sign out</a>} />` as the topbar already does. **Don't use `<Link>`.** These are full-page redirects, and a prefetch can start a login transaction.

For custom destinations, use the helpers in `@/lib/auth/routes`. `returnTo` is sanitized to same-origin paths.

```ts
import { loginHref, signupHref } from "@/lib/auth/routes";
loginHref({ returnTo: "/wishlist" });
loginHref({ connection: "google-oauth2" });  // straight to Google (when enabled in Auth0)
```

`useAuth()` is for **display only**. Never use it to decide what data a request may access.

## 4. Server — `@/lib/auth/session` (server-only)

| Function | Use |
|---|---|
| `getSession()` | `AuthSession \| null`. Unchanged signature |
| `requireSession(returnTo?)` | Returns `AuthSession`, or **redirects to Universal Login** when signed out. Previously it threw |
| `withSession(handler)` | Route Handler wrapper. Passes `{ session }` to the handler; otherwise returns 401 JSON. **New** |
| `unauthorizedResponse()` | Standard 401 JSON |

```ts
// app/api/transactions/route.ts
import { withSession } from "@/lib/auth/session";
import { withOwner } from "@/lib/auth/ownership";

export const GET = withSession(async (_req, { session }) =>
  Response.json(await db.transactions.findMany({ where: { ownerId: session.user.id } })),
);

export const POST = withSession(async (req, { session }) =>
  Response.json(await db.transactions.create(withOwner(session.user, await req.json()))),
);
```

```ts
// Server Action
"use server";
import { requireSession } from "@/lib/auth/session";
export async function addBill(form: FormData) {
  const { user } = await requireSession();
  // ... write with ownerId: user.id
}
```

## 5. Routes and protection

| Route | Owner | Purpose |
|---|---|---|
| `/auth/login` | SDK (via proxy) | Universal Login. Query params: `returnTo`, `screen_hint=signup`, `connection`, `login_hint` |
| `/auth/callback` | SDK | OAuth callback. Register it in Auth0 |
| `/auth/logout` | SDK | Clears the app session and the Auth0 SSO session, then returns to `/` |
| `/auth/profile` | SDK | Profile JSON (unused by the UI) |
| `/api/auth/me` | app | `{ session }`, or 401 |
| `/auth-error?code=` | app | Friendly, recoverable sign-in failure page |

`src/proxy.ts` is **default-deny**. Every page and API route needs a session except `PUBLIC_PATHS` / `PUBLIC_PREFIXES` in `@/lib/auth/routes`:

- Public: `/` (it only redirects to `/overview`), `/auth-error`, `/auth/*`, `/api/public/*`, and static assets.
- Protected: `/overview`, `/transactions`, `/bills`, `/budgets`, `/cash-flow`, `/ledger`, `/wishlist`, `/copilot`, `/settings`, `/api/**`, and any new route automatically.
- When signed out, pages get **307** → `/auth/login?returnTo=<path>` and APIs get **401** `{"error":"unauthorized",…}`. After login the user returns to `returnTo`, or to `/overview` by default.

To add a public marketing or landing page, add its path to `PUBLIC_PATHS`. That is also where a signed-out landing page would go if you replace the current `/` redirect.

The proxy is the first gate. **Route Handlers and Server Actions must still call `withSession` / `requireSession`** before touching user data.

## 6. User data ownership — `@/lib/auth/ownership`

- Every persisted user record (transactions, bills, budgets, ledger, goals, scenarios, copilot history) has **`ownerId = session.user.id`**.
- **Never accept a user id from the client.** `withOwner(user, record)` overwrites any `ownerId` the client sends.
- To read by id, use `assertOwnedBy(record, user)`. It throws `ForbiddenResourceError`; respond **404**.
- To filter lists, use `onlyOwnedBy(rows, user)`, or better, put `ownerId` in the DB query.

### Financial data is scoped per user (done)

`getFinancialEventRepository()` resolves the owner from the verified session on every call (`requireOwnerId()`), so callers never pass a user id:

- **Tiger Data:** `financial_events.owner_id` is `NOT NULL`. Every `SELECT`, `UPDATE` and `DELETE` filters on it, so an update or delete with someone else's id matches nothing. The continuous aggregate groups by `owner_id`.
- **Demo/in-memory:** events, budgets, wishlist goals and the Nessie sync status are kept per user. Each new user starts from the demo seed.
- **Pages and server actions** pass `await requireOwnerId()` to the budget, goal and sync-status helpers. The copilot receives the user's budgets and goals on its `ForecastContext`.
- Covered by `src/lib/finance/user-isolation.test.ts`.

### Capital One Nessie demo data

Nessie is simulated banking and is **separate from Auth0**. Neither system sees the other's credentials.

1. Map users to Nessie customers **on the server only**. Use a table `auth0Sub → nessieCustomerId`, or a single shared `NESSIE_DEMO_CUSTOMER_ID` for the hackathon.
2. Nessie routes use `withSession`, look up that user's Nessie customer id, and never trust a customer or account id sent by the client.
3. Synced records are stored with `ownerId = user.id`, `source = "nessie"` and a dedupe key such as `nessieTransactionId`. Upsert on `(ownerId, nessieTransactionId)` so re-syncs never duplicate. Users who share the demo customer each get their own copy.
4. Auth doesn't touch the forecast or simulation engine. It only supplies `user.id`.

## 7. Environment

| Variable | Notes |
|---|---|
| `AUTH0_DOMAIN` | Tenant domain, no `https://` |
| `AUTH0_CLIENT_ID` | |
| `AUTH0_CLIENT_SECRET` | **Secret, server-only** |
| `AUTH0_SECRET` | **Secret.** `openssl rand -hex 32`, different per environment |
| `APP_BASE_URL` | `http://localhost:3000` or `https://<prod domain>`. Leave unset on previews |
| `AUTH0_PROFILE_EDITING` | Optional. `true` enables name editing in Settings; needs Management API access (setup doc §6) |
| `AUTH0_MANAGEMENT_DOMAIN` | Optional. Canonical `*.auth0.com` domain, only when `AUTH0_DOMAIN` is a custom domain |

These replace the v3 names that were in the old `.env.example` (`AUTH0_BASE_URL`, `AUTH0_ISSUER_BASE_URL`). Setup steps: `docs/AUTH0_SETUP.md`.

## 8. What changed in shared and frontend files

| File | Change |
|---|---|
| `src/lib/auth/session.ts` | Real Auth0 lookup with demo fallback. `requireSession` redirects. Adds `withSession` |
| `src/lib/auth/provider.tsx` | Hrefs point at SDK v4 routes. Adds `source` and `signupHref` |
| `src/lib/auth/types.ts` | Adds `AuthSession.source` |
| `src/lib/auth/README.md` | Rewritten for the real integration |
| `src/app/api/auth/{login,logout,callback}/route.ts` | **Deleted.** SDK v4 serves `/auth/*` from the proxy, not from route handlers |
| `src/app/api/auth/me/route.ts` | Uses `withSession` (401 when signed out) |
| `.env.example` | v4 Auth0 variables. Gemini and Nessie lines unchanged |
| `package.json` | Adds `@auth0/nextjs-auth0`, plus dev deps `vitest` and `server-only`; scripts `test` and `typecheck` |
| New (auth-owned) | `src/proxy.ts`, `src/lib/auth0.ts`, `src/lib/auth/{config,map-user,routes,errors,ownership,management,profile-actions}.ts`, `src/app/auth-error/`, tests, `vitest.config.mts`, `docs/AUTH*.md` |
| `src/app/page.tsx` | Was a redirect to `/overview`. Now the **signed-out landing page** (Get started / Log in); signed-in users and demo mode still redirect to `/overview` |
| `src/components/shell/topbar.tsx` | Avatar shows the profile photo (`AvatarImage`), falling back to initials |
| `src/components/settings/account-card.tsx` | Photo; badge shows "Signed in with Google/Email" or "Demo account"; optional display-name form |
| `src/app/(app)/settings/page.tsx` | Passes `canEditProfile`; reads the per-user sync status |
| `src/app/(app)/{overview,budgets,wishlist}/page.tsx` | Pass `await requireOwnerId()` to the goal and budget helpers |
| `src/lib/finance/*`, `src/lib/nessie/{actions,status}.ts`, `src/lib/copilot/*`, `db/schema.sql` | Per-user data scoping (see §6) |

**Not touched:** `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `next.config.ts`, `globals.css`, the sidebar, the dashboard components and the feature components.

Everything the frontend needs from auth is in place: landing page, avatar photo, account badge and profile editing. Restyle any of it freely; keep the hrefs from `@/lib/auth/routes` / `useAuth()` and the `requireOwnerId()` calls.
