// Per-user data isolation helpers. Persisted financial records carry an
// `ownerId` equal to AuthUser.id (the Auth0 `sub`).

import type { AuthUser } from "@/lib/auth/types";

export type Owned = { ownerId: string };

export class ForbiddenResourceError extends Error {
  constructor() {
    super("Resource does not belong to the current user.");
    this.name = "ForbiddenResourceError";
  }
}

/** Stamps a new record with the current user's id. Ignores any client-sent ownerId. */
export function withOwner<T extends object>(user: AuthUser, record: T): Omit<T, "ownerId"> & Owned {
  return { ...(record as Omit<T, "ownerId">), ownerId: user.id };
}

export function isOwnedBy(resource: Owned | null | undefined, user: AuthUser): boolean {
  return !!resource && resource.ownerId === user.id;
}

/**
 * Throws unless `resource` belongs to `user`. Route Handlers should map the
 * error to 404 (not 403) so record ids of other users aren't confirmed.
 */
export function assertOwnedBy<T extends Owned>(resource: T | null | undefined, user: AuthUser): T {
  if (!resource || !isOwnedBy(resource, user)) throw new ForbiddenResourceError();
  return resource;
}

export function onlyOwnedBy<T extends Owned>(resources: readonly T[], user: AuthUser): T[] {
  return resources.filter((resource) => resource.ownerId === user.id);
}
