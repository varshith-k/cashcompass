export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  /** True only when Auth0 says the email is verified (always for Google). */
  emailVerified?: boolean;
}

export interface AuthSession {
  user: AuthUser;
  expiresAt: string;
  /** "auth0" for a real signed-in user, "demo" when running without Auth0 credentials. */
  source: AuthSource;
}

export type AuthSource = "auth0" | "demo";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";
