"use client";

import { createContext, useContext, useMemo } from "react";
import type { AuthSession, AuthStatus, AuthUser } from "./types";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  loginHref: string;
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
      // These routes follow the @auth0/nextjs-auth0 convention so the
      // Auth0 integration can implement them without any UI changes.
      loginHref: "/api/auth/login",
      logoutHref: "/api/auth/logout",
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
