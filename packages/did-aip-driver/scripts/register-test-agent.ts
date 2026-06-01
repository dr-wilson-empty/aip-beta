/**
 * Register the PERMANENT did:aip test identifier the Universal Resolver needs.
 *
 * The Universal Resolver runs a nightly check that resolves each driver's
 * `testIdentifiers`. If they do not resolve, the driver is flagged and
 * eventually removed. Every other did:aip test registers a throwaway agent and
 * deregisters it at the end, so there is currently NO permanently resolvable
 * DID. This script creates one and never deregisters it.
 *
 * Properties:
 *   - Stable agent id: "resolver" (so the DID is reproducible).
 *   - Idempotent: if the agent already exists, it prints the DID and exits 0.
 *   - It does NOT deregister. Treat the resulting agent as infrastructure.
 *
 * Run (owner key = your funded Devnet wallet):
 *   SOLANA_DEVNET_KEYPAIR=/path/to/id.json npx tsx scripts/register-test-agent.ts
 * or, using the default Solana CLI key (~/.config/solana/id.json):
 *   npx tsx scripts/register-test-agent.ts
 *
 * On success it prints the canonical DID:
 *   did:aip:<owner_pubkey>:resolver-test
 * Put that exact string into the driver's testIdentifiers (PR application.yml).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createHash } from "node:crypto";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { AipDidResolver, formatDid } from "@aipagents/did-resolver";

const PROGRAM_ID = new PublicKey("CgchXu2dRV3r9E1YjRhp4kbeLLtv1Xz61yoerJzp1Vbc");
const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const AGENT_ID = "resolver";

function loadOwner(): Keypair {
  const candidate =
    process.env.SOLANA_DEVNET_KEYPAIR ??
    path.join(os.homedir(), ".config", "solana", "id.json");
  if (!fs.existsSync(candidate)) {
    throw new Error(
      `No keypair found at ${candidate}. Set SOLANA_DEVNET_KEYPAIR to a funded Devnet keypair JSON.`,
    );
  }
  const raw = JSON.parse(fs.readFileSync(candidate, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

// --- Anchor-compatible encoders (mirrors the on-chain register_agent ABI) ---

function discriminator(name: string): Uint8Array {
  return Uint8Array.from(createHash("sha256").update(`global:${name}`).digest()).subarray(0, 8);
}
function encodeString(s: string): Uint8Array {
  const b = new TextEncoder().encode(s);
  const out = new Uint8Array(4 + b.length);
  new DataView(out.buffer).setUint32(0, b.length, true);
  out.set(b, 4);
  return out;
}
function encodeU32(n: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n, true);
  return out;
}
function encodeU64(n: bigint): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, n, true);
  return out;
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

async function main(): Promise<void> {
  const owner = loadOwner();
  const conn = new Connection(RPC, "confirmed");
  const did = formatDid(owner.publicKey.toBase58(), AGENT_ID);

  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), owner.publicKey.toBuffer(), Buffer.from(AGENT_ID)],
    PROGRAM_ID,
  );

  console.log(`owner   : ${owner.publicKey.toBase58()}`);
  console.log(`agent id: ${AGENT_ID}`);
  console.log(`pda     : ${pda.toBase58()} (bump ${bump})`);
  console.log(`did     : ${did}`);

  // Idempotency: if the agent account already exists, do nothing.
  const existing = await conn.getAccountInfo(pda, { commitment: "confirmed" });
  if (existing !== null) {
    console.log("\nagent already registered. Nothing to do.");
    await verify(did);
    printNext(did);
    return;
  }

  const balance = await conn.getBalance(owner.publicKey);
  if (balance < 0.05 * 1e9) {
    throw new Error(
      `Insufficient SOL on ${owner.publicKey.toBase58()} (${balance / 1e9} SOL). ` +
        `Fund it on Devnet first: solana airdrop 1 ${owner.publicKey.toBase58()} --url devnet`,
    );
  }

  const ixData = concat(
    discriminator("register_agent"),
    encodeString(AGENT_ID),
    encodeString(did),
    encodeString("AIP Resolver Agent"),
    encodeString("https://resolver.test/agent"),
    owner.publicKey.toBytes(), // wallet_address
    Uint8Array.from([2]), // AgentType::Execution
    encodeU32(1), // 1 capability
    encodeString("echo"),
    encodeString("Returns its input verbatim"),
    encodeU64(0n), // price_per_task (free; this is infra, not a real service)
    encodeString("0.0.1"), // version
  );

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: owner.publicKey, isSigner: true, isWritable: true },
      { pubkey: pda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(ixData),
  });

  console.log("\nsubmitting register_agent ...");
  const sig = await sendAndConfirmTransaction(conn, new Transaction().add(ix), [owner]);
  console.log(`confirmed: ${sig}`);

  await verify(did);
  printNext(did);
}

async function verify(did: string): Promise<void> {
  const resolver = new AipDidResolver({ rpcEndpoint: RPC, network: "solana:devnet" });
  const result = await resolver.resolve(did);
  if (!result.didDocument) {
    throw new Error(`resolve() did not return a document for ${did}; got ${JSON.stringify(result.didResolutionMetadata)}`);
  }
  console.log(`\nresolve() OK -> ${result.didDocument.id}`);
}

function printNext(did: string): void {
  console.log("\n------------------------------------------------------------");
  console.log("PERMANENT TEST DID (do NOT deregister this agent):");
  console.log(`  ${did}`);
  console.log("Use this exact string as the driver's testIdentifiers entry.");
  console.log("------------------------------------------------------------");
}

main().catch((err) => {
  console.error("\nregister-test-agent failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
