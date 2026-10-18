import { Connection, PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

describe("patched RPC client compatibility", () => {
  it("generates UUID request ids and parses an HTTP balance response", async () => {
    let requestId: unknown;
    const connection = new Connection("https://api.devnet.solana.com", {
      fetch: async (_url, options) => {
        const request = JSON.parse(String(options?.body));
        requestId = request.id;
        expect(request.method).toBe("getBalance");
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: { context: { slot: 1 }, value: 5000 } }));
      },
    });
    expect(await connection.getBalance(new PublicKey("11111111111111111111111111111111"))).toBe(5000);
    expect(requestId).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  });
});
