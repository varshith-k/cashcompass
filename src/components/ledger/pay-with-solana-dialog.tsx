"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, ExternalLink, Loader2, Wallet } from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { settleLedgerWithSolana } from "@/lib/solana/actions";
import { explorerUrl as transactionUrl, SOLANA_DEMO_RECIPIENT, SOLANA_DEMO_USD_PER_SOL } from "@/lib/solana/config";
import { formatCurrency } from "@/lib/format";

type Step = "idle" | "preparing" | "sending" | "verifying" | "success" | "error";

export function PayWithSolanaDialog({
  ledgerEntryId,
  counterparty,
  amountUsd,
}: {
  ledgerEntryId: string;
  counterparty: string;
  amountUsd: number;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [pendingSignature, setPendingSignature] = useState("");
  const [existingSignature, setExistingSignature] = useState("");
  const storageKey = `cashcompass:solana-pending:${ledgerEntryId}`;

  const { connection } = useConnection();
  const { connected, publicKey, sendTransaction } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const router = useRouter();

  const demoSol = amountUsd / SOLANA_DEMO_USD_PER_SOL;
  const busy = step === "preparing" || step === "sending" || step === "verifying";

  function rememberSignature(signature: string) {
    setPendingSignature(signature);
    setExplorerUrl(transactionUrl(signature));
    try { localStorage.setItem(storageKey, signature); } catch { /* Retain in memory if storage is unavailable. */ }
  }

  async function recordPayment(signature: string) {
    setStep("verifying");
    setError(null);
    rememberSignature(signature);
    try {
      const result = await settleLedgerWithSolana(ledgerEntryId, amountUsd, signature);
      if (!result.verified) {
        setStep("error");
        setError(`${result.reason ?? "Verification is not complete"}. No new transfer was sent. Check this transaction on Explorer before retrying verification.`);
        return;
      }
      try { localStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
      setExplorerUrl(result.explorerUrl);
      setStep("success");
      router.refresh();
    } catch {
      setStep("error");
      setError("CashCompass could not verify or record this transaction. Keep its signature and retry verification; do not send another payment.");
    }
  }

  function reset() {
    setStep("idle");
    setError(null);
    setExplorerUrl(null);
  }

  async function handlePay() {
    const signatureToCheck = pendingSignature || existingSignature.trim();
    if (signatureToCheck) {
      if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signatureToCheck)) {
        setStep("error");
        setError("Enter the transaction signature from Phantom, not a wallet address or Explorer URL.");
        return;
      }
      await recordPayment(signatureToCheck);
      return;
    }
    if (!connected || !publicKey) {
      setWalletModalVisible(true);
      return;
    }

    setStep("preparing");
    setError(null);

    try {
      const recipient = new PublicKey(SOLANA_DEMO_RECIPIENT);
      const lamports = Math.round(demoSol * 1_000_000_000);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const transaction = new Transaction({
        feePayer: publicKey,
        blockhash,
        lastValidBlockHeight,
      }).add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipient,
          lamports,
        }),
      );

      setStep("sending");
      const signature = await sendTransaction(transaction, connection);
      rememberSignature(signature);

      setStep("verifying");
      const confirmation = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
      if (confirmation.value.err) {
        setStep("error");
        setError("The submitted transaction failed on-chain. Check it on Explorer; no ledger payment was recorded.");
        return;
      }
      await recordPayment(signature);
    } catch (err) {
      setStep("error");
      setError(err instanceof Error ? err.message : "The devnet payment failed");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          try {
            const saved = localStorage.getItem(storageKey);
            if (saved) rememberSignature(saved);
          } catch { /* Storage is optional. */ }
        } else reset();
      }}
    >
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        Pay with Solana
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settle up with {counterparty}</DialogTitle>
          <DialogDescription>
            Solana devnet demo: this sends test SOL, not real money. CashCompass verifies the
            transfer on-chain before marking this ledger entry paid.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount owed</span>
            <span className="font-medium tabular-nums">{formatCurrency(amountUsd, { cents: true })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Demo SOL amount</span>
            <span className="font-medium tabular-nums">{demoSol.toFixed(4)} SOL</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Network</span>
            <span className="font-medium">Solana Devnet</span>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Demo rate: 1 SOL = {formatCurrency(SOLANA_DEMO_USD_PER_SOL)}. No live price feed is used.
            For demonstration only.
          </p>
        </div>

        {step !== "success" && (
          <div className="space-y-2 text-sm">
            {pendingSignature ? (
              <p>A transaction signature is saved. The button below only retries verification; it does not send more SOL.</p>
            ) : (
              <>
                <Label htmlFor={`signature-${ledgerEntryId}`}>Already sent SOL? Paste its transaction signature</Label>
                <Input id={`signature-${ledgerEntryId}`} value={existingSignature} onChange={(event) => setExistingSignature(event.target.value)} disabled={busy} placeholder="Transaction signature from Phantom" />
              </>
            )}
            {pendingSignature && <a href={transactionUrl(pendingSignature)} target="_blank" rel="noreferrer" className="underline">Check submitted transaction on Solana Explorer</a>}
          </div>
        )}

        {step === "error" && error && (
          <div className="flex items-start gap-2 rounded-lg border border-critical/30 bg-critical/5 p-3 text-sm text-critical">
            <CircleAlert className="size-4 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {step === "success" && explorerUrl && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-positive/30 bg-positive/5 p-3 text-sm text-positive">
            <p className="flex-1 min-w-32">Payment verified on-chain. The ledger entry is now marked paid.</p>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2 shrink-0"
            >
              View on Explorer <ExternalLink className="size-3.5" />
            </a>
          </div>
        )}

        {step !== "success" && (
          <DialogFooter>
            <Button type="button" onClick={handlePay} disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {step === "preparing" ? "Preparing transaction…" : step === "sending" ? "Approve in wallet…" : "Verifying…"}
                </>
              ) : pendingSignature || existingSignature.trim() ? (
                "Retry verification — no new transfer"
              ) : connected ? (
                "Send devnet payment"
              ) : (
                <>
                  <Wallet className="size-4" />
                  Connect wallet
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
