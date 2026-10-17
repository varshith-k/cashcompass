import { beforeEach, describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => ({ getSignatureStatus: vi.fn(), getParsedTransaction: vi.fn() }));
vi.mock("@solana/web3.js", () => ({ Connection: class { getSignatureStatus = rpc.getSignatureStatus; getParsedTransaction = rpc.getParsedTransaction; } }));
import { verifySolanaTransfer } from "./verify";
import { claimSettlement, releaseSettlement } from "./receipts";
const signature = "1".repeat(88);
const transfer = (destination = "recipient", lamports = 100) => ({ program: "system", parsed: { type: "transfer", info: { destination, lamports } } });
beforeEach(() => {
  rpc.getSignatureStatus.mockResolvedValue({ value: { slot: 1, err: null, confirmationStatus: "confirmed" } });
  rpc.getParsedTransaction.mockResolvedValue({ meta: { err: null }, transaction: { message: { instructions: [transfer()] } } });
});
describe("Solana settlement verification", () => {
  it("requires a confirmed matching transfer", async () => { expect((await verifySolanaTransfer(signature, "recipient", 100)).verified).toBe(true); });
  it("rejects processed-only signatures", async () => {
    rpc.getSignatureStatus.mockResolvedValue({ value: { slot: 1, err: null, confirmationStatus: "processed" } });
    expect((await verifySolanaTransfer(signature, "recipient", 100)).verified).toBe(false);
  });
  it("rejects failed transaction metadata", async () => {
    rpc.getParsedTransaction.mockResolvedValue({ meta: { err: "failed" }, transaction: { message: { instructions: [transfer()] } } });
    expect((await verifySolanaTransfer(signature, "recipient", 100)).verified).toBe(false);
  });
  it("rejects insufficient or wrong-recipient transfers", async () => {
    expect((await verifySolanaTransfer(signature, "recipient", 101)).verified).toBe(false);
    expect((await verifySolanaTransfer(signature, "another-recipient", 100)).verified).toBe(false);
  });
  it("finds the matching transfer when another transfer comes first", async () => {
    rpc.getParsedTransaction.mockResolvedValue({ meta: { err: null }, transaction: { message: { instructions: [transfer("other"), transfer()] } } });
    expect((await verifySolanaTransfer(signature, "recipient", 100)).verified).toBe(true);
  });
  it("rejects malformed signatures and invalid expected amounts", async () => {
    expect((await verifySolanaTransfer("bad", "recipient", 100)).verified).toBe(false);
    expect((await verifySolanaTransfer(signature, "recipient", 0)).verified).toBe(false);
  });
  it("claims a signature once across users and permits retry after a failed write", async () => {
    const id = crypto.randomUUID();
    expect(await claimSettlement(id, "alice", "entry")).toBe(true);
    expect(await claimSettlement(id, "bob", "entry")).toBe(false);
    await releaseSettlement(id, "alice");
    expect(await claimSettlement(id, "alice", "entry")).toBe(true);
  });
});
