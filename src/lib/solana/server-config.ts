import "server-only";
import { SOLANA_DEMO_RECIPIENT, SOLANA_RPC_ENDPOINT } from "./config";

export function settlementRecipient(): string {
  return process.env.SOLANA_DEMO_RECIPIENT_ADDRESS || SOLANA_DEMO_RECIPIENT;
}
export function verificationRpcEndpoint(): string {
  return process.env.SOLANA_RPC_ENDPOINT || SOLANA_RPC_ENDPOINT;
}
