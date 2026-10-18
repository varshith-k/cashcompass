import "server-only";

export interface Friend {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

/** Demo friends match the demo Settle Up entries (see demo-data.ts). example.com never delivers mail. */
const DEMO_FRIENDS: Friend[] = [
  { id: "friend-sam", name: "Sam (roommate)", email: "sam@example.com", phone: "+15555550123" },
  { id: "friend-alex", name: "Alex (concert tickets)", email: "alex@example.com" },
];

/**
 * Per user (keyed by Auth0 `sub`). In-memory for the server process's
 * lifetime, the same as budgets and wishlist goals; a durable table is a
 * follow-up once those move to the database.
 */
const stores = new Map<string, Friend[]>();

function storeFor(ownerId: string) {
  let friends = stores.get(ownerId);
  if (!friends) {
    friends = DEMO_FRIENDS.map((friend) => ({ ...friend }));
    stores.set(ownerId, friends);
  }
  return friends;
}

export function getFriends(ownerId: string): Friend[] {
  return [...storeFor(ownerId)].sort((a, b) => a.name.localeCompare(b.name));
}

export function getFriend(ownerId: string, id: string | undefined): Friend | undefined {
  return id ? storeFor(ownerId).find((friend) => friend.id === id) : undefined;
}

export function addFriend(ownerId: string, input: Omit<Friend, "id">): Friend {
  const friends = storeFor(ownerId);
  if (friends.some((friend) => friend.name.toLowerCase() === input.name.toLowerCase())) {
    throw new Error("You already have a friend with that name");
  }
  const friend: Friend = { ...input, id: crypto.randomUUID() };
  friends.push(friend);
  return friend;
}

export function removeFriend(ownerId: string, id: string) {
  const friends = storeFor(ownerId);
  const index = friends.findIndex((friend) => friend.id === id);
  if (index !== -1) friends.splice(index, 1);
}
