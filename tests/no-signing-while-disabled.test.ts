import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The claim under test is not "a function throws" — it is "no transaction is
 * sent". These tests assert the second directly.
 */

const sendSpy = vi.fn(() => {
  throw new Error("FUNDS MOVED: sendAndConfirmTransaction was reached while escrow is disabled");
});

vi.mock("@solana/web3.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solana/web3.js")>();
  return { ...actual, sendAndConfirmTransaction: sendSpy };
});
vi.mock("@/lib/supabase/db", () => ({ dbUpsertEscrow: vi.fn(async () => undefined) }));

const ENV = ["ESCROW_ENABLED", "ESCROW_PRIVATE_KEY", "USDC_MINT_DEVNET"] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.USDC_MINT_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
  sendSpy.mockClear();
});

afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("no transaction is sent while escrow is disabled", () => {
  it("the chain executor gives up before sending", async () => {
    const { createAndExecuteChain, getChain } = await import("@/lib/protocol/chain-executor");

    const chain = createAndExecuteChain({
      callerAddress: "CALLER",
      callerDid: "did:aip:test:caller",
      steps: [
        {
          agentName: "Test Agent",
          agentEndpoint: "http://localhost:4001",
          capabilityId: "text.summarize",
          input: "hello",
          estimatedCost: "0.05",
          status: "pending",
        } as never,
      ],
      totalCost: "0.05",
      depositTxHash: "deposit-tx",
    });

    // runChain is fired without await; let its rejection settle.
    await new Promise((r) => setTimeout(r, 50));

    expect(sendSpy, "no transaction may be sent").not.toHaveBeenCalled();
    expect(getChain(chain.id)?.status).toBe("failed");
  });
});

/* ------------------------------------------------------------------ */
/*  Structural invariant                                                */
/*                                                                      */
/*  A file that sends a transaction either goes through the kill switch  */
/*  or is signer-agnostic: it cannot sign without being handed a keypair */
/*  by a caller that did go through the switch. Anything else is a new   */
/*  signing path and has to be added here deliberately.                  */
/* ------------------------------------------------------------------ */

const SIGNER_AGNOSTIC = new Set([
  // Every exported function takes `authorityKeypair: Keypair` / `ownerKeypair: Keypair`.
  "src/lib/payment/commission.ts",
  "src/lib/solana/escrow-program.ts",
  "src/lib/solana/registry-program.ts",
]);

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, acc);
    else if (/\.tsx?$/.test(name)) acc.push(p);
  }
  return acc;
}

describe("every signing path is gated", () => {
  it("files that send transactions import the authority module or take a signer", () => {
    const senders = sourceFiles("src").filter((f) =>
      readFileSync(f, "utf8").includes("sendAndConfirmTransaction(")
    );
    expect(senders.length, "expected to find the known signing sites").toBeGreaterThan(0);

    const ungated = senders.filter((f) => {
      if (SIGNER_AGNOSTIC.has(f)) return false;
      return !/from "(\.\/|@\/lib\/payment\/)authority"/.test(readFileSync(f, "utf8"));
    });

    expect(
      ungated,
      "A new file sends transactions without importing getAuthorityKeypair from " +
        "src/lib/payment/authority.ts. Either route it through the kill switch, or — if " +
        "it only ever signs with a keypair handed in by its caller — add it to " +
        "SIGNER_AGNOSTIC with a note saying why."
    ).toEqual([]);
  });
});
