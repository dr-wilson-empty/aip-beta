import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ENV_KEYS = ["ESCROW_ENABLED", "ESCROW_PRIVATE_KEY"] as const;
let saved: Record<string, string | undefined>;

// A throwaway devnet keypair, base58. Never funded, never used anywhere.
const DUMMY_KEY =
  "2yNQeiBff8j3J3Y7wAC3LPSxuGG1HKXjxnAgQyqdK3T7GPd8pZMkkM3A4466cKKh918Uk1Lwo3m8cBiwTRfiurkA";

async function freshAuthority() {
  const mod = await import("@/lib/payment/authority");
  mod.__resetAuthorityCacheForTests();
  return mod;
}

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("escrow kill switch", () => {
  it("is off by default", async () => {
    const { isEscrowEnabled } = await freshAuthority();
    expect(isEscrowEnabled()).toBe(false);
  });

  it("refuses to produce the authority keypair when disabled", async () => {
    const { getAuthorityKeypair, EscrowDisabledError } = await freshAuthority();
    expect(() => getAuthorityKeypair()).toThrow(EscrowDisabledError);
  });

  it("still refuses when the private key IS present", async () => {
    // The important case: a deployment that still carries the secret must not
    // move funds just because the secret is there.
    process.env.ESCROW_PRIVATE_KEY = DUMMY_KEY;
    const { getAuthorityKeypair, EscrowDisabledError } = await freshAuthority();
    expect(() => getAuthorityKeypair()).toThrow(EscrowDisabledError);
  });

  it("refuses the authority address too", async () => {
    process.env.ESCROW_PRIVATE_KEY = DUMMY_KEY;
    const { getAuthorityAddress, EscrowDisabledError } = await freshAuthority();
    expect(() => getAuthorityAddress()).toThrow(EscrowDisabledError);
  });

  it("opts in only on the exact value 1", async () => {
    for (const v of ["0", "true", "yes", ""]) {
      process.env.ESCROW_ENABLED = v;
      const { isEscrowEnabled } = await freshAuthority();
      expect(isEscrowEnabled(), `ESCROW_ENABLED=${JSON.stringify(v)}`).toBe(false);
    }
    process.env.ESCROW_ENABLED = "1";
    const { isEscrowEnabled } = await freshAuthority();
    expect(isEscrowEnabled()).toBe(true);
  });

  it("when enabled, fails on the missing key rather than the switch", async () => {
    process.env.ESCROW_ENABLED = "1";
    const { getAuthorityKeypair, EscrowDisabledError } = await freshAuthority();
    expect(() => getAuthorityKeypair()).toThrow(/ESCROW_PRIVATE_KEY is not set/);
    expect(() => getAuthorityKeypair()).not.toThrow(EscrowDisabledError);
  });

  it("returns the keypair when fully enabled", async () => {
    process.env.ESCROW_ENABLED = "1";
    process.env.ESCROW_PRIVATE_KEY = DUMMY_KEY;
    const { getAuthorityKeypair } = await freshAuthority();
    expect(getAuthorityKeypair().publicKey.toBase58()).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });
});

/* ------------------------------------------------------------------ */
/*  Regression guard                                                    */
/*                                                                      */
/*  The hole this switch closes was created by copy-paste: three files   */
/*  had grown their own getAuthorityKeypair() reading the env directly,  */
/*  so disabling one left the others signing. Fail the build if a new    */
/*  direct read appears.                                                 */
/* ------------------------------------------------------------------ */

const ALLOWED = new Set([
  "src/lib/payment/authority.ts",   // the chokepoint itself
  "src/lib/auth/encrypt.ts",        // derives an encryption key; moves no funds
]);

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, acc);
    else if (/\.tsx?$/.test(name)) acc.push(p);
  }
  return acc;
}

describe("ESCROW_PRIVATE_KEY has exactly one reader", () => {
  it("no file outside the allowlist reads the key", () => {
    const offenders = sourceFiles("src")
      .filter((f) => !ALLOWED.has(f))
      .filter((f) =>
        readFileSync(f, "utf8")
          .split("\n")
          .some((line) => {
            if (!line.includes("ESCROW_PRIVATE_KEY")) return false;
            const t = line.trim();
            // Comments may name the variable; only code counts.
            return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
          })
      );
    expect(
      offenders,
      "Reading ESCROW_PRIVATE_KEY outside src/lib/payment/authority.ts bypasses the " +
        "kill switch. Import getAuthorityKeypair() from there instead."
    ).toEqual([]);
  });
});
