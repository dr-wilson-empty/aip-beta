import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

/**
 * Platform authority keypair — the single place `ESCROW_PRIVATE_KEY` is read.
 *
 * Everything that can move user funds signs with this key: escrow creation
 * (the authority is both payer and signer), release, refund, and budget
 * withdrawal. Before this module existed the key was read in six places, three
 * of which had their own private copy of `getAuthorityKeypair()`. That made a
 * kill switch impossible: disabling one call site left the others signing.
 *
 * Escrow is DISABLED BY DEFAULT. `ESCROW_ENABLED=1` turns it on.
 *
 * The reasoning is in wienerlabs/mandate#1: none of this code is being ported
 * to Arc, the settlement design it implements is known-unsound (the agent's own
 * self-reported status decides whether it gets paid, and there is no challenge
 * window or arbitration), and the deployment it ran on is gone. Closing it is
 * cheaper and safer than fixing it, and it must stay closed even if someone
 * redeploys the repo.
 */

export class EscrowDisabledError extends Error {
  constructor() {
    super(
      "Escrow is disabled. This deployment cannot move funds.\n" +
        "The settlement path in this repository is superseded by wienerlabs/mandate " +
        "and is intentionally switched off (see mandate#1).\n" +
        "Set ESCROW_ENABLED=1 only on a throwaway devnet key you are willing to lose."
    );
    this.name = "EscrowDisabledError";
  }
}

/** True when the operator has explicitly opted in. */
export function isEscrowEnabled(): boolean {
  return process.env.ESCROW_ENABLED === "1";
}

let _authorityKeypair: Keypair | null = null;

/**
 * The authority keypair, or a throw.
 *
 * Throws `EscrowDisabledError` unless `ESCROW_ENABLED=1`. Callers are not
 * expected to catch it: a caller that catches and continues has re-opened the
 * hole this module exists to close.
 */
export function getAuthorityKeypair(): Keypair {
  if (!isEscrowEnabled()) throw new EscrowDisabledError();

  if (_authorityKeypair) return _authorityKeypair;

  const key = process.env.ESCROW_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "ESCROW_PRIVATE_KEY is not set. It is the escrow authority " +
        "(escrow creation, release, refund and budget withdrawal signer)."
    );
  }

  _authorityKeypair = Keypair.fromSecretKey(bs58.decode(key));
  return _authorityKeypair;
}

/** Base58 authority address. Throws under the same conditions. */
export function getAuthorityAddress(): string {
  return getAuthorityKeypair().publicKey.toBase58();
}

/** Test seam. Not for production use. */
export function __resetAuthorityCacheForTests(): void {
  _authorityKeypair = null;
}
