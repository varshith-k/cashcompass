import { ActionForm } from "@/components/ui/action-form";
import { HandCoins, MessageCircle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteLedgerEntry, logLedgerPayment } from "@/lib/finance/actions";
import type { FinancialEvent } from "@/lib/finance/types";
import { formatCurrency, formatRelativeDay } from "@/lib/format";
import { buildWhatsAppReminderLink } from "@/lib/whatsapp";
import { PayWithSolanaDialog } from "./pay-with-solana-dialog";
import { SendReminderButton } from "./send-reminder-button";

function reminderMessage(entry: FinancialEvent): string {
  return `Hi ${entry.counterparty}! Friendly reminder from CashCompass: you owe ${formatCurrency(entry.amount, { cents: true })}, expected ${formatRelativeDay(entry.date).toLowerCase()}. No rush, just a nudge 🙂`;
}

export function LedgerList({
  title,
  entries,
  emptyText,
  allowSolanaSettlement = false,
  emailableFriendIds = [],
}: {
  title: string;
  entries: FinancialEvent[];
  emptyText: string;
  /** Only "You owe" entries are payable by the signed-in user — the other list is money owed to them. */
  allowSolanaSettlement?: boolean;
  /** Friends with an email address, who can be sent reminders. */
  emailableFriendIds?: string[];
}) {
  return (
    <div>
      <h2 className="font-heading text-sm font-semibold text-muted-foreground mb-2">{title}</h2>
      {entries.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-2 py-10 text-muted-foreground rounded-xl border border-border bg-card">
          <HandCoins className="size-7" strokeWidth={1.5} />
          <p className="text-sm max-w-xs">{emptyText}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-32">
                <p className="text-sm font-medium truncate">{entry.counterparty}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {entry.certainty === "uncertain" && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-caution/40 text-caution">
                      Uncertain
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">Expected {formatRelativeDay(entry.date)}</span>
                </div>
              </div>

              <p className="text-sm font-medium tabular-nums shrink-0">
                {formatCurrency(entry.amount, { cents: true })}
              </p>

              {entry.direction === "income" && entry.counterpartyPhone && (
                <Button
                  render={
                    <a
                      href={buildWhatsAppReminderLink(entry.counterpartyPhone, reminderMessage(entry))}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="size-3.5" />
                      Remind
                    </a>
                  }
                  nativeButton={false}
                  role="link"
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-positive border-positive/30 hover:bg-positive/10"
                />
              )}

              {entry.direction === "income" && entry.friendId && emailableFriendIds.includes(entry.friendId) && (
                <SendReminderButton entryId={entry.id} friendName={entry.counterparty} />
              )}

              <ActionForm action={logLedgerPayment} className="flex items-center gap-2 shrink-0">
                <input type="hidden" name="id" value={entry.id} />
                <Input
                  name="amountPaid"
                  type="number"
                  min="0.01"
                  max={entry.amount}
                  step="0.01"
                  defaultValue={entry.amount}
                  className="h-8 w-24"
                  aria-label={`Amount settled for ${entry.counterparty}`}
                />
                <Button type="submit" size="sm" variant="outline">
                  Log payment
                </Button>
              </ActionForm>

              {allowSolanaSettlement && (
                <PayWithSolanaDialog
                  ledgerEntryId={entry.id}
                  counterparty={entry.counterparty}
                  amountUsd={entry.amount}
                />
              )}

              <ActionForm action={deleteLedgerEntry}>
                <input type="hidden" name="id" value={entry.id} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete entry for ${entry.counterparty}`}
                  className="text-muted-foreground hover:text-critical"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
