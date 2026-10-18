import "server-only";
import { randomUUID } from "node:crypto";
import { ensureAppTables } from "./app-tables";
import { getTigerPool } from "./tiger-repository";

export interface Friend {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  /** Their Capital One Nessie sandbox account, for P2P transfers. */
  nessieAccountId?: string;
}

/** Demo friends match the demo Settle Up entries (see demo-data.ts). example.com never delivers mail. */
const DEMO_FRIENDS: Friend[] = [
  { id: "friend-sam", name: "Sam (roommate)", email: "sam@example.com", phone: "+15555550123" },
  { id: "friend-alex", name: "Alex (concert tickets)", email: "alex@example.com" },
];

interface FriendStore {
  list(ownerId: string): Promise<Friend[]>;
  insert(ownerId: string, friend: Friend): Promise<void>;
  update(ownerId: string, friend: Friend): Promise<void>;
  remove(ownerId: string, id: string): Promise<void>;
}

/**
 * In-memory (no DATABASE_URL), seeded with the demo friends that the demo
 * events refer to. On globalThis: route handlers are bundled separately.
 */
class MemoryFriendStore implements FriendStore {
  private forOwner(ownerId: string): Friend[] {
    const g = globalThis as typeof globalThis & { __cashcompassFriends?: Map<string, Friend[]> };
    const stores = (g.__cashcompassFriends ??= new Map());
    let friends = stores.get(ownerId);
    if (!friends) {
      friends = DEMO_FRIENDS.map((friend) => ({ ...friend }));
      stores.set(ownerId, friends);
    }
    return friends;
  }
  async list(ownerId: string) {
    return this.forOwner(ownerId).map((friend) => ({ ...friend }));
  }
  async insert(ownerId: string, friend: Friend) {
    this.forOwner(ownerId).push({ ...friend });
  }
  async update(ownerId: string, friend: Friend) {
    const friends = this.forOwner(ownerId);
    const index = friends.findIndex((f) => f.id === friend.id);
    if (index !== -1) friends[index] = { ...friend };
  }
  async remove(ownerId: string, id: string) {
    const friends = this.forOwner(ownerId);
    const index = friends.findIndex((f) => f.id === id);
    if (index !== -1) friends.splice(index, 1);
  }
}

interface FriendRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  nessie_account_id: string | null;
}

const toFriend = (row: FriendRow): Friend => ({
  id: row.id,
  name: row.name,
  ...(row.email ? { email: row.email } : {}),
  ...(row.phone ? { phone: row.phone } : {}),
  ...(row.nessie_account_id ? { nessieAccountId: row.nessie_account_id } : {}),
});

/** Tiger Data table `friends` (db/schema.sql). Every query is scoped by owner_id. */
class TigerFriendStore implements FriendStore {
  private async query<T extends object>(sql: string, values: unknown[]): Promise<T[]> {
    const pool = getTigerPool();
    await ensureAppTables(pool);
    return (await pool.query<T>(sql, values)).rows;
  }
  async list(ownerId: string) {
    return (await this.query<FriendRow>("SELECT id, name, email, phone, nessie_account_id FROM friends WHERE owner_id = $1", [ownerId])).map(toFriend);
  }
  async insert(ownerId: string, friend: Friend) {
    await this.query("INSERT INTO friends (id, owner_id, name, email, phone, nessie_account_id) VALUES ($1, $2, $3, $4, $5, $6)", [
      friend.id,
      ownerId,
      friend.name,
      friend.email ?? null,
      friend.phone ?? null,
      friend.nessieAccountId ?? null,
    ]);
  }
  async update(ownerId: string, friend: Friend) {
    await this.query("UPDATE friends SET name = $3, email = $4, phone = $5, nessie_account_id = $6 WHERE owner_id = $1 AND id = $2", [
      ownerId,
      friend.id,
      friend.name,
      friend.email ?? null,
      friend.phone ?? null,
      friend.nessieAccountId ?? null,
    ]);
  }
  async remove(ownerId: string, id: string) {
    await this.query("DELETE FROM friends WHERE owner_id = $1 AND id = $2", [ownerId, id]);
  }
}

let store: FriendStore | null = null;

function friendStore(): FriendStore {
  if (!store) store = process.env.DATABASE_URL ? new TigerFriendStore() : new MemoryFriendStore();
  return store;
}

/** Per user (keyed by Auth0 `sub`), saved in Tiger Data when DATABASE_URL is set. */
export async function getFriends(ownerId: string): Promise<Friend[]> {
  return (await friendStore().list(ownerId)).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getFriend(ownerId: string, id: string | undefined): Promise<Friend | undefined> {
  return id ? (await friendStore().list(ownerId)).find((friend) => friend.id === id) : undefined;
}

export async function addFriend(ownerId: string, input: Omit<Friend, "id">): Promise<Friend> {
  const friends = await friendStore().list(ownerId);
  if (friends.some((friend) => friend.name.toLowerCase() === input.name.toLowerCase())) {
    throw new Error("You already have a friend with that name");
  }
  const friend: Friend = { ...input, id: randomUUID() };
  await friendStore().insert(ownerId, friend);
  return friend;
}

export async function removeFriend(ownerId: string, id: string): Promise<void> {
  await friendStore().remove(ownerId, id);
}

const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

/**
 * Used when a balance is added for "someone else" with contact details: links
 * to an existing friend with the same name (filling in missing details) or
 * adds a new one, so reminders and payment emails work for that balance.
 */
export async function findOrAddFriend(ownerId: string, input: Omit<Friend, "id">): Promise<Friend> {
  const existing = (await friendStore().list(ownerId)).find((friend) => friend.name.toLowerCase() === input.name.toLowerCase());
  if (!existing) return addFriend(ownerId, input);
  if ((input.email && !existing.email) || (input.phone && !existing.phone)) {
    const updated = { ...existing, email: existing.email ?? input.email, phone: existing.phone ?? input.phone };
    await friendStore().update(ownerId, updated);
    return updated;
  }
  return existing;
}
