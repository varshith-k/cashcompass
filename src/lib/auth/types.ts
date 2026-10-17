export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface AuthSession {
  user: AuthUser;
  expiresAt: string;
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";
