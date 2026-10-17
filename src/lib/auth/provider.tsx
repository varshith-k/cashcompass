"use client";

import { createContext, useContext, useMemo } from "react";
import type { AuthSession, AuthSource, AuthStatus, AuthUser } from "./types";
import { AUTH_ROUTES, loginHref, signupHref } from "./routes";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  /** "auth0" for real accounts, "demo" without Auth0 credentials; null when signed out. */
  source: AuthSource | null;
  loginHref: string;
  signupHref: string;
  logoutHref: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  session,
  children,
}: {
  session: AuthSession | null;
  children: React.ReactNode;
}) {
  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      status: session ? "authenticated" : "unauthenticated",
      source: session?.source ?? null,
      // Auth0 SDK v4 routes, mounted by src/proxy.ts. Use plain <a href>
      // (full-page navigation), not <Link> with prefetch.
      loginHref: loginHref(),
      signupHref: signupHref(),
      logoutHref: AUTH_ROUTES.logout,
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
