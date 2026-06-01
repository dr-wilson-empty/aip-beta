/**
 * did:aip driver for the DIF Universal Resolver.
 *
 * Exposes the one endpoint the Universal Resolver calls:
 *
 *   GET /1.0/identifiers/{did}
 *     Accept: application/ld+json
 *     -> 200 application/did+ld+json  (DID Resolution Result)
 *     -> 400 invalidDid / 404 notFound|deactivated / 500 internalError
 *
 *   GET /health  -> 200 { status: "ok" }   (compose + smoke checks)
 *
 * All real resolution logic lives in @aipagents/did-resolver; this process is a
 * thin HTTP shell around it.
 */

import express from "express";
import { AipDidResolver } from "@aipagents/did-resolver";
import { DID_LD_JSON, errorEnvelope, statusFor, toEnvelope } from "./envelope.js";

const PORT = Number(process.env.DRIVER_PORT ?? 8080);
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const NETWORK = process.env.SOLANA_NETWORK ?? "solana:devnet";

const resolver = new AipDidResolver({ rpcEndpoint: RPC_URL, network: NETWORK });

const app = express();
app.disable("x-powered-by");

// Liveness probe for docker-compose and local smoke tests.
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// The Universal Resolver interface. The pattern in application.yml only routes
// did:aip:* here, but any malformed input is still handled (resolver reports
// invalidDid, which we map to 400).
app.get("/1.0/identifiers/:did", async (req, res) => {
  res.type(DID_LD_JSON);
  try {
    const result = await resolver.resolve(req.params.did);
    res.status(statusFor(result)).json(toEnvelope(result));
  } catch (err) {
    // resolver.resolve() is designed not to throw, so reaching here means an
    // unexpected runtime/RPC fault. Report it as internalError rather than
    // letting Express emit an HTML 500.
    console.error("[did:aip-driver] unexpected error:", err);
    res.status(500).json(errorEnvelope("internalError"));
  }
});

app.listen(PORT, () => {
  console.log(`[did:aip-driver] listening on :${PORT} (rpc=${RPC_URL}, network=${NETWORK})`);
});
