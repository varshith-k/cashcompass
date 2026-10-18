"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerId } from "@/lib/auth/session";
import { notifyFriend, type NotifyResult } from "@/lib/email/notify-friend";
import { addFriend, removeFriend } from "./friends";
import { getFinancialEventRepository } from "./repository";

export type FriendFormState = { status: "idle" | "saved" | "error"; message: string };

const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export async function addFriendAction(_previous: FriendFormState, formData: FormData): Promise<FriendFormState> {
  const ownerId = await requireOwnerId();
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!name || name.length > 60) return { status: "error", message: "Enter a name (up to 60 characters)." };
  if (email && (email.length > 254 || !EMAIL_PATTERN.test(email))) return { status: "error", message: "That email address doesn't look right." };
  if (phone && !/^\+?[\d\s().-]{7,20}$/.test(phone)) return { status: "error", message: "That phone number doesn't look right." };

  try {
    addFriend(ownerId, { name, email: email || undefined, phone: phone || undefined });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Couldn't add that friend." };
  }
  revalidatePath("/settle-up");
  return { status: "saved", message: `Added ${name}.` };
}

export async function removeFriendAction(formData: FormData) {
  const ownerId = await requireOwnerId();
  removeFriend(ownerId, String(formData.get("id") ?? ""));
  revalidatePath("/settle-up");
}

/** Emails the friend a reminder for one balance they owe. Rate-limited per balance. */
export async function sendSettleUpReminder(entryId: string): Promise<NotifyResult> {
  const entry = (await getFinancialEventRepository().listEvents()).find(
    (event) => event.id === entryId && event.category === "Repayment" && event.record === "planned" && event.direction === "income",
  );
  if (!entry) throw new Error("Balance not found");
  return notifyFriend("reminder", entry);
}
