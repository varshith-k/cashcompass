import type { AuthUser } from "./types";

type Auth0ProfileLike = {
  sub?: unknown;
  name?: unknown;
  nickname?: unknown;
  email?: unknown;
  picture?: unknown;
};

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/**
 * Narrows an Auth0 session user to AuthUser. `id` is the Auth0 `sub` — the
 * only stable identity key. Returns null when there's no usable `sub`.
 */
export function toAuthUser(profile: Auth0ProfileLike | null | undefined): AuthUser | null {
  const id = text(profile?.sub);
  if (!profile || !id) return null;

  const email = text(profile.email) ?? "";
  const user: AuthUser = {
    id,
    name: text(profile.name) ?? text(profile.nickname) ?? (email ? email.split("@")[0]! : "CashCompass member"),
    email,
  };
  const avatarUrl = text(profile.picture);
  if (avatarUrl) user.avatarUrl = avatarUrl;
  return user;
}
