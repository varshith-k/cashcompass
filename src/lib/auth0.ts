import "server-only";

import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

import { classifyAuthError } from "@/lib/auth/errors";
import { AUTH_ERROR_PATH, DEFAULT_SIGNED_IN_PATH } from "@/lib/auth/routes";

export const SESSION_INACTIVITY_SECONDS = 60 * 60 * 24 * 3; // 3 days idle
export const SESSION_ABSOLUTE_DURATION_SECONDS = 60 * 60 * 24 * 14; // 14 days max

/**
 * The single Auth0 SDK instance (Regular Web Application, Authorization Code
 * Flow + PKCE, encrypted httpOnly session cookie). Server-only: it holds the
 * client secret. App code should go through src/lib/auth/session.ts instead.
 *
 * Config comes from AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET,
 * AUTH0_SECRET and APP_BASE_URL (see .env.example). APP_BASE_URL may be left
 * unset on preview deployments; the SDK then infers it from the request host
 * and Auth0's Allowed Callback URLs act as the allowlist.
 */
export const auth0 = new Auth0Client({
  signInReturnToPath: DEFAULT_SIGNED_IN_PATH,
  authorizationParameters: {
    scope: "openid profile email",
  },
  session: {
    rolling: true,
    inactivityDuration: SESSION_INACTIVITY_SECONDS,
    absoluteDuration: SESSION_ABSOLUTE_DURATION_SECONDS,
  },
  async onCallback(error, ctx) {
    const baseUrl = ctx.appBaseUrl;
    if (!baseUrl) {
      return new NextResponse("Sign-in is misconfigured.", { status: 500 });
    }

    if (error) {
      // Log only the code; messages can contain query input.
      console.error("[auth] callback failed:", error.code);
      const url = new URL(AUTH_ERROR_PATH, baseUrl);
      url.searchParams.set("code", classifyAuthError(error.code));
      return NextResponse.redirect(url);
    }

    // ctx.returnTo has already been restricted to same-origin by the SDK.
    return NextResponse.redirect(new URL(ctx.returnTo || DEFAULT_SIGNED_IN_PATH, baseUrl));
  },
});
