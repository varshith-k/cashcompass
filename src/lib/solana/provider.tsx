"use client";

import { createContext, useContext, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { SOLANA_DEMO_RECIPIENT, SOLANA_RPC_ENDPOINT } from "./config";

import "@solana/wallet-adapter-react-ui/styles.css";

const RecipientContext = createContext(SOLANA_DEMO_RECIPIENT);
export function useSettlementRecipient() { return useContext(RecipientContext); }

export function SolanaProvider({ children, recipientAddress }: { children: React.ReactNode; recipientAddress: string }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={SOLANA_RPC_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <RecipientContext.Provider value={recipientAddress}><WalletModalProvider>{children}</WalletModalProvider></RecipientContext.Provider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
