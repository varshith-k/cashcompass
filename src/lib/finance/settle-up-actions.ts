"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerId } from "@/lib/auth/session";
import { notifyFriend, type NotifyResult } from "@/lib/email/notify-friend";
import { listDemoAccounts } from "@/lib/nessie/accounts";
import { createTransfer, isNessieConfigured, isNessieId } from "@/lib/nessie/client";
import { getSyncStatus } from "@/lib/nessie/status";
import { addFriend, getFriend, isValidEmail, removeFriend } from "./friends";
import { settleLedgerAmount } from "./ledger";
import { getFinancialEventRepository } from "./repository";

export type FriendFormState = { status: "idle" | "saved" | "error"; message: string };

export async function addFriendAction(_previous: FriendFormState, formData: FormData): Promise<FriendFormState> {
  const ownerId = await requireOwnerId();
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const nessieAccountId = String(formData.get("nessieAccountId") ?? "").trim().toLowerCase();

  if (!name || name.length > 60) return { status: "error", message: "Enter a name (up to 60 characters)." };
  if (email && !isValidEmail(email)) return { status: "error", message: "That email address doesn't look right." };
  if (phone && !/^\+?[\d\s().-]{7,20}$/.test(phone)) return { status: "error", message: "That phone number doesn't look right." };
  if (nessieAccountId && !isNessieId(nessieAccountId)) return { status: "error", message: "That doesn't look like a Nessie account ID (24 hex characters, or a UUID)." };

  try {
    await addFriend(ownerId, { name, email: email || undefined, phone: phone || undefined, nessieAccountId: nessieAccountId || undefined });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Couldn't add that friend." };
  }
  revalidatePath("/settle-up");
  return { status: "saved", message: `Added ${name}.` };
}

export async function removeFriendAction(formData: FormData) {
  const ownerId = await requireOwnerId();
  await removeFriend(ownerId, String(formData.get("id") ?? ""));
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

export type TransferResult = { ok: boolean; message: string };

/**
 * Settles a balance you owe a friend with a real Capital One Nessie P2P
 * transfer: from your configured sandbox account to the friend's account,
 * then records the payment (linked to the transfer so the next sync matches
 * it instead of importing a duplicate). No account id comes from the browser.
 */
export async function payWithNessieTransfer(entryId: string): Promise<TransferResult> {
  const ownerId = await requireOwnerId();
  if (!isNessieConfigured()) return { ok: false, message: "Add NESSIE_API_KEY to enable Nessie transfers." };

  const entry = (await getFinancialEventRepository().listEvents()).find(
    (event) => event.id === entryId && event.category === "Repayment" && event.record === "planned" && event.direction === "expense",
  );
  if (!entry) return { ok: false, message: "That balance is no longer open." };
  const friend = await getFriend(ownerId, entry.friendId);
  if (!friend?.nessieAccountId) return { ok: false, message: "Add this friend's Nessie account ID first." };

  const { accounts, error } = await listDemoAccounts();
  if (error) return { ok: false, message: error };
  const payerId = (await getSyncStatus(ownerId))?.accountId || process.env.NESSIE_ACCOUNT_ID || accounts[0]?._id;
  if (!payerId || !accounts.some((account) => account._id === payerId)) {
    return { ok: false, message: "Choose your Nessie account in Settings and sync once first." };
  }
  if (payerId === friend.nessieAccountId) return { ok: false, message: "That's your own account." };

  let transferId: string;
  try {
    transferId = (
      await createTransfer(payerId, {
        payeeAccountId: friend.nessieAccountId,
        amount: entry.amount,
        description: `CashCompass settle up with ${friend.name}`,
      })
    )._id;
  } catch (error) {
    console.warn("[settle-up] Nessie transfer failed:", error instanceof Error ? error.message : "unknown error");
    return { ok: false, message: "Nessie didn't accept the transfer. Nothing was recorded; try again." };
  }

  await settleLedgerAmount(entry.id, entry.amount, { sourceRecordId: `${payerId}/transfer/${transferId}` });
  return { ok: true, message: `Sent a Nessie transfer to ${friend.name} and marked it settled.` };
}
