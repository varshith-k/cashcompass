# Auth0 Setup, Deployment & Demo Guide

How to configure the Auth0 tenant for CashCompass, run it locally, deploy it, and demo it. For the code-level API, see `AUTH_INTEGRATION_CONTRACT.md`.

## 1. Create the tenant and application (manual, about 10 min)

1. Sign up or log in at <https://auth0.com>. Create a tenant, e.g. `cashcompass`, in the US region.
2. **Applications → Applications → Create Application**
   - Name: `CashCompass`
   - Type: **Regular Web Application**. Not SPA: the secret must stay on the server.
3. **Settings** tab. Each list is comma-separated:

   | Field | Value |
   |---|---|
   | Allowed Callback URLs | `http://localhost:3000/auth/callback, https://<PROD_DOMAIN>/auth/callback` |
   | Allowed Logout URLs | `http://localhost:3000, https://<PROD_DOMAIN>` |
   | Allowed Web Origins | `http://localhost:3000, https://<PROD_DOMAIN>` |
   | Application Login URI (optional) | `https://<PROD_DOMAIN>/auth/login` (must be HTTPS) |

   For Vercel preview deploys, also add each preview origin, or a wildcard such as `https://cashcompass-*.vercel.app/auth/callback` if your tenant allows it.
4. Copy **Domain**, **Client ID** and **Client Secret** into `.env.local` (see §3).
5. **Advanced Settings → Grant Types**: leave **Authorization Code** and **Refresh Token** enabled.

## 2. Connections

- **Database (email + password):** Authentication → Database → `Username-Password-Authentication`. Make sure it's enabled for the CashCompass app under the app's *Connections* tab. This powers email sign-up on the Universal Login page.
- **Google (optional):** Authentication → Social → **Google / Gmail** → enable it for the CashCompass app.
  - The Auth0 dev keys work instantly for testing. Users see an "Auth0 development keys" notice, and the keys aren't meant for production.
  - For the deployed demo, create a Google OAuth client in Google Cloud Console. Set the authorized redirect URI to `https://<AUTH0_DOMAIN>/login/callback`, then paste the client ID and secret into Auth0.
  - Once Google is enabled, Universal Login shows "Continue with Google" automatically. `<GoogleLoginButton />` skips straight to it.

## 3. Local development

```bash
cp .env.example .env.local
# fill AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET
openssl rand -hex 32   # paste as AUTH0_SECRET
npm install
npm run dev            # http://localhost:3000
```

`.env.local` is git-ignored. Never commit it, and never paste secrets into issues, PRs or chat.

## 4. Branding Universal Login

Do this in the Auth0 dashboard. No code is involved.

**Branding → Universal Login → Customization Options** (New Universal Login):

| Setting | Value |
|---|---|
| Logo URL | `https://<PROD_DOMAIN>/cashcompass-logo.png` (an HTTPS PNG/SVG, about 150px tall, owned by the frontend) |
| Primary button color | `#0276B1` |
| Page background | `#F5F8FC` |
| Links / focused inputs | `#0276B1` |
| Base focus color | `#004977` |
| Error color | `#D03027` |
| Success color | `#0F766E` |
| Body text | `#102A43` |
| Widget corner radius | `12px`; buttons `12px`; inputs `12px` |
| Font URL | Inter from Google Fonts (`https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap`) |

Under **Branding → Universal Login → Advanced Options → Text** (or *Customize Text*), set the login prompt title to **"Welcome to CashCompass"** and the description to **"Your money. Your direction."**

Also set the **tenant friendly name** to `CashCompass` and the support email under **Settings → General**.

Don't use Capital One logos or wordmarks on the login page.

## 5. Production deployment (e.g. Vercel)

1. Set these environment variables in the host (Production scope):
   `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET` (a **new** value, not the dev one), and `APP_BASE_URL=https://<PROD_DOMAIN>`.
2. Preview environments: leave `APP_BASE_URL` **unset**. The SDK infers the host per request, and Auth0's Allowed Callback URLs act as the allowlist.
3. Add the production URLs to the Auth0 app (§1.3). HTTPS is required in production. The SDK sets `Secure` cookies automatically.
4. Changing domains later only means updating `APP_BASE_URL` and the Auth0 URL lists. No code changes.
5. Rotate `AUTH0_SECRET` to sign everyone out. Rotate the client secret in Auth0 if it ever leaks.

## 6. Optional: in-app profile editing

Settings can let users change their display name. Auth0 has to allow the app to update users first:

1. **Applications → APIs → Auth0 Management API → Machine to Machine Applications**: authorize **CashCompass** and tick only the `update:users` scope.
2. **Applications → CashCompass → Advanced Settings → Grant Types**: enable **Client Credentials**.
3. Set `AUTH0_PROFILE_EDITING=true`. If `AUTH0_DOMAIN` is a custom domain, also set `AUTH0_MANAGEMENT_DOMAIN` to your `*.auth0.com` tenant domain.

For Google users, Auth0 overwrites the name from Google on each login unless you turn off **Sync user profile attributes at each login** under Authentication → Social → Google. Email and photo always come from the sign-in provider.

## 7. Hackathon demo account

1. Auth0 → **User Management → Users → Create User**, using the `Username-Password-Authentication` connection.
   - For example `demo@cashcompass.app` with a strong password used only for this. Mark the email as verified if prompted.
   - Put the credentials on your demo slide or devpost notes. Don't put them in the repo. The account must only ever hold demo or Nessie data.
2. Judges can also sign up on the Universal Login page in about 20 seconds, or use **Continue with Google**.
3. Local development without credentials needs nothing: leave the `AUTH0_*` vars empty and the app runs as the demo user (see `src/lib/auth/README.md`).

### Showing Auth0 to judges (about 30 s)

1. Open the site while signed out. The landing page shows **Get started** and **Log in**. Click **Get started** to open Universal Login with CashCompass branding.
2. Sign in with Google or the demo account. You land on `/overview` with your name in the top bar.
3. Open **Settings** to show the profile: photo, name, email and "Signed in with Google". Edit the name if profile editing is enabled (§6).
4. Sign out from the avatar menu, then try `/overview`. It redirects to login. Show that `curl https://<PROD_DOMAIN>/api/auth/me` returns **401**.
5. Mention the setup: Authorization Code + PKCE, an `httpOnly` encrypted session, no tokens in the browser, and per-user data keyed by Auth0 `sub`.

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `/auth-error?code=unavailable` right after clicking Log in | Wrong `AUTH0_DOMAIN` (no `https://`), or the tenant is unreachable |
| Auth0 page says "Callback URL mismatch" | Add `<origin>/auth/callback` to Allowed Callback URLs exactly, including port and protocol |
| `/auth-error?code=session_expired` | Login started in one browser or tab and finished elsewhere, or took more than an hour. Retry |
| Logged out but immediately logged back in | Add the origin to **Allowed Logout URLs** |
| App shows Jordan Rivera locally | Demo mode: the `AUTH0_*` vars are missing from `.env.local`. Restart `npm run dev` after adding them |
| `/auth-error?code=configuration` in production | AUTH0_* env vars are missing in the host. Add them and redeploy |
| Session lost on every refresh | `AUTH0_SECRET` missing or changed between instances. Set one stable value per environment |
| "Auth0 development keys" banner on Google login | Configure your own Google OAuth client (§2) |
