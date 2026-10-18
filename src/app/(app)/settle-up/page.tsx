import { connection } from "next/server";
import { ArrowRightLeft, Mail, Phone, Trash2, Users } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { AddFriendSheet } from "@/components/ledger/add-friend-sheet";
import { AddLedgerEntrySheet } from "@/components/ledger/add-ledger-entry-sheet";
import { LedgerList } from "@/components/ledger/ledger-list";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOwnerId } from "@/lib/auth/session";
import { isEmailConfigured } from "@/lib/email/resend";
import { isNessieConfigured } from "@/lib/nessie/client";
import { selectLedgerEntries } from "@/lib/finance/calculations";
import { getFriends } from "@/lib/finance/friends";
import { getFinancialEventRepository } from "@/lib/finance/repository";
import { removeFriendAction } from "@/lib/finance/settle-up-actions";
import { formatCurrency } from "@/lib/format";

export default async function SettleUpPage() {
  await connection();

  const ownerId = await requireOwnerId();
  const events = await getFinancialEventRepository().listEvents();
  const { owedToMe, iOwe } = selectLedgerEntries(events);
  const friends = getFriends(ownerId);
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
        description="Track who owes whom with your friends, send reminders, and settle up. Money owed to you counts as uncertain in your forecast, never as guaranteed cash."
        actions={
          <div className="flex gap-2">
            <AddFriendSheet />
            <AddLedgerEntrySheet friends={friends.map((f) => ({ id: f.id, name: f.name, hasEmail: Boolean(f.email) }))} />
          </div>
        }
      />

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
        emptyText="Nobody owes you anything right now."
        emailableFriendIds={emailableFriendIds}
      />
      <LedgerList
        title="You owe"
        entries={iOwe}
        emptyText="You don't owe anyone right now."
        allowSolanaSettlement
        nessieFriendIds={nessieFriendIds}
      />
    </div>
  );
}
