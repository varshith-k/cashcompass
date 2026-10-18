import { connection } from "next/server";
import { ArrowRightLeft, Mail, Phone, Radio, Trash2, Users } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { AddFriendSheet } from "@/components/ledger/add-friend-sheet";
import { SplitBillSheet } from "@/components/ledger/split-bill-sheet";
import { AddLedgerEntrySheet } from "@/components/ledger/add-ledger-entry-sheet";
import { LedgerList } from "@/components/ledger/ledger-list";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SharedWithYou, type IncomingShare } from "@/components/ledger/shared-with-you";
import { requireSession } from "@/lib/auth/session";
import type { AuthUser } from "@/lib/auth/types";
import { getSharedBalanceStore } from "@/lib/finance/shared-balances";
import { isEmailConfigured } from "@/lib/email/resend";
import { isNessieConfigured } from "@/lib/nessie/client";
import { selectLedgerEntries } from "@/lib/finance/calculations";
import { getFriends } from "@/lib/finance/friends";
import { getFinancialEventRepository } from "@/lib/finance/repository";
import { removeFriendAction } from "@/lib/finance/settle-up-actions";
import { formatCurrency } from "@/lib/format";

/**
 * Balances other users shared with you (only for your verified email), and a
 * status line for each of your balances that's shared. Never breaks the page.
 */
async function loadSharing(
  user: AuthUser,
  entries: { id: string; counterparty: string; sourceRecordId?: string }[],
): Promise<{ incoming: IncomingShare[]; notes: Record<string, string> }> {
  try {
    const shares = getSharedBalanceStore();
    const [pending, sent] = await Promise.all([
      user.emailVerified && user.email ? shares.listPendingFor(user.email.toLowerCase()) : Promise.resolve([]),
      shares.listSentBy(user.id),
    ]);
    const notes: Record<string, string> = {};
    for (const share of sent) {
      if (share.status === "pending") notes[share.fromEventId] = `Shared with ${share.toEmail} · waiting for them to accept`;
      else if (share.status === "accepted") notes[share.fromEventId] = `Linked with ${share.toEmail}'s CashCompass · payments sync both ways`;
      else if (share.status === "declined") notes[share.fromEventId] = `${share.toEmail} said this isn't theirs`;
    }
    for (const entry of entries) {
      if (entry.sourceRecordId?.startsWith("shared/")) notes[entry.id] = `Linked with ${entry.counterparty}'s CashCompass · payments sync both ways`;
    }
    const incoming = pending
      .filter((share) => share.fromOwnerId !== user.id)
      .map((share) => ({
        id: share.id,
        fromName: share.fromName,
        fromEmail: share.fromEmail,
        youOwe: share.kind === "they_owe_sender",
        amount: share.amount,
        description: share.description,
        dueDate: share.dueDate,
      }));
    return { incoming, notes };
  } catch (error) {
    console.warn("[shared] couldn't load shared balances:", error instanceof Error ? error.message : "unknown error");
    return { incoming: [], notes: {} };
  }
}

export const metadata = { title: "Settle Up" };

export default async function SettleUpPage({ searchParams }: { searchParams: Promise<{ split?: string }> }) {
  const { split: splitReceiptId } = await searchParams;
  await connection();

  const { user } = await requireSession();
  const ownerId = user.id;
  const events = await getFinancialEventRepository().listEvents();
  const { owedToMe, iOwe } = selectLedgerEntries(events);
  const [friends, sharing] = await Promise.all([getFriends(ownerId), loadSharing(user, [...owedToMe, ...iOwe])]);
  // Receipts that can be split here (newest first); already-split ones are marked.
  const splitKeys = new Set(events.map((e) => e.sourceRecordId).filter((k): k is string => Boolean(k?.startsWith("split/"))));
  const receiptOptions = events
    .filter((e) => e.isReceipt && e.record === "actual" && e.direction === "expense")
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => ({ id: e.id, merchant: e.counterparty, amount: e.amount, date: e.date, notes: e.notes, alreadySplit: splitKeys.has(`split/${e.id}`) }));
  const emailReady = isEmailConfigured();
  const emailableFriendIds = friends.filter((f) => f.email).map((f) => f.id);
  const nessieFriendIds = isNessieConfigured() ? friends.filter((f) => f.nessieAccountId).map((f) => f.id) : [];

  // Net balance per friend: positive = they owe you.
  const net = new Map<string, number>();
  for (const entry of [...owedToMe, ...iOwe]) {
    if (!entry.friendId) continue;
    net.set(entry.friendId, (net.get(entry.friendId) ?? 0) + (entry.direction === "income" ? entry.amount : -entry.amount));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settle Up"
        description="Track who owes whom with your friends, send reminders, and settle up. Money friends owe you is shown in your forecast but never counted as cash you can spend until they pay."
        actions={
          <div className="flex gap-2">
            <SplitBillSheet
              receipts={receiptOptions}
              friends={friends.map((f) => ({ id: f.id, name: f.name, hasEmail: Boolean(f.email) }))}
              initialReceiptId={typeof splitReceiptId === "string" ? splitReceiptId : undefined}
            />
            <AddFriendSheet />
            <AddLedgerEntrySheet friends={friends.map((f) => ({ id: f.id, name: f.name, hasEmail: Boolean(f.email) }))} />
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              role="link"
              render={
                <a
                  href={process.env.DEEPSPACE_SPLIT_ROOM_URL ?? "https://cashcompass-split-room.app.space/split"}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <Radio className="size-4" />
              Live Split Room
            </Button>
          </div>
        }
      />

      <SharedWithYou shares={sharing.incoming} />

      {!emailReady && (
        <p className="rounded-lg bg-accent px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Email notifications are off.</span> Add <code>RESEND_API_KEY</code>{" "}
          and <code>EMAIL_FROM</code> to the server environment to email friends automatically. Until then, reminders open a
          pre-filled email in your own mail app.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" aria-hidden="true" />
            Friends
          </CardTitle>
        </CardHeader>
        <CardContent>
          {friends.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add friends to split costs and send them reminders.</p>
          ) : (
            <ul className="divide-y divide-border">
              {friends.map((friend) => {
                const balance = Math.round((net.get(friend.id) ?? 0) * 100) / 100;
                return (
                  <li key={friend.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-40">
                      <p className="text-sm font-medium">{friend.name}</p>
                      <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        {friend.email ? (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="size-3" aria-hidden="true" />
                            {friend.email}
                          </span>
                        ) : (
                          <span>No email: can&apos;t be emailed</span>
                        )}
                        {friend.nessieAccountId && (
                          <span className="inline-flex items-center gap-1">
                            <ArrowRightLeft className="size-3" aria-hidden="true" />
                            Nessie ••{friend.nessieAccountId.slice(-4)}
                          </span>
                        )}
                        {friend.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="size-3" aria-hidden="true" />
                            {friend.phone}
                          </span>
                        )}
                      </p>
                    </div>
                    <p
                      className={
                        balance > 0 ? "text-sm font-medium text-positive" : balance < 0 ? "text-sm font-medium text-caution" : "text-sm text-muted-foreground"
                      }
                    >
                      {balance > 0
                        ? `Owes you ${formatCurrency(balance, { cents: true })}`
                        : balance < 0
                          ? `You owe ${formatCurrency(-balance, { cents: true })}`
                          : "Settled up"}
                    </p>
                    <ActionForm action={removeFriendAction}>
                      <input type="hidden" name="id" value={friend.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${friend.name} from friends`}
                        className="text-muted-foreground hover:text-critical"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </ActionForm>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <LedgerList
        title="Owed to you"
        entries={owedToMe}
        shareNotes={sharing.notes}
        emptyText="Nobody owes you anything right now."
        emailableFriendIds={emailableFriendIds}
      />
      <LedgerList
        title="You owe"
        entries={iOwe}
        shareNotes={sharing.notes}
        emptyText="You don't owe anyone right now."
        allowSolanaSettlement
        nessieFriendIds={nessieFriendIds}
      />
    </div>
  );
}
