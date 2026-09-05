import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * The kill switch, exercised through the functions that actually move money
 * rather than through the switch itself.
 *
 * Covered here: releaseEscrow, refundEscrow, withdrawBudget — the three
 * exported entry points that sign a fund-moving transaction.
 *
 * Not covered here: the three escrow-CREATION sites (task/delegate route,
 * chain-executor, agent-orchestrator). Each sits deep inside a large handler
 * that reaches the network before it reaches the keypair, so a unit test would
 * assert framework plumbing rather than the guard. They are covered instead by
 * construction — each imports getAuthorityKeypair from the single module — and
 * by the source scan in escrow-kill-switch.test.ts, which fails the build if a
 * file outside that module ever reads ESCROW_PRIVATE_KEY again.
 */

vi.mock("@/lib/supabase/agent-budgets", () => ({
  dbGetBudget: vi.fn(async () => ({
    agent_did: "did:aip:test:agent",
    owner_wallet: "OWNER",
    balance: 10,
    max_per_task: 1,
  })),
  dbDepositBudget: vi.fn(),
  dbSpendBudget: vi.fn(),
  dbRefundBudget: vi.fn(),
  dbWithdrawBudget: vi.fn(),
  dbGetBudgetsByOwner: vi.fn(),
  dbGetBudgetTxns: vi.fn(),
}));
vi.mock("@/lib/supabase/db", () => ({ dbUpsertEscrow: vi.fn(async () => undefined) }));

const ENV = ["ESCROW_ENABLED", "ESCROW_PRIVATE_KEY", "USDC_MINT_DEVNET"] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  // Present but irrelevant: the switch must win over a configured deployment.
  process.env.USDC_MINT_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
});

afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.clearAllMocks();
});

describe("fund-moving entry points refuse while escrow is disabled", () => {
  it("releaseEscrow throws before it can sign", async () => {
    const { createEscrowRecord, releaseEscrow } = await import("@/lib/payment/escrow");
    const { EscrowDisabledError } = await import("@/lib/payment/authority");
    createEscrowRecord({
      taskId: "task-release",
      amount: "1.00",
      from: "PAYER",
      to: "PAYEE",
      escrowTxHash: "tx",
    });
    await expect(releaseEscrow("task-release")).rejects.toThrow(EscrowDisabledError);
  });

  it("refundEscrow throws before it can sign", async () => {
    const { createEscrowRecord, refundEscrow } = await import("@/lib/payment/escrow");
    const { EscrowDisabledError } = await import("@/lib/payment/authority");
    createEscrowRecord({
      taskId: "task-refund",
      amount: "1.00",
      from: "PAYER",
      to: "PAYEE",
      escrowTxHash: "tx",
    });
    await expect(refundEscrow("task-refund")).rejects.toThrow(EscrowDisabledError);
  });

  it("withdrawBudget throws before it can sign", async () => {
    const { withdrawBudget } = await import("@/lib/payment/agent-budget");
    const { EscrowDisabledError } = await import("@/lib/payment/authority");
    await expect(withdrawBudget("did:aip:test:agent", "OWNER", 1)).rejects.toThrow(
      EscrowDisabledError
    );
  });
});
