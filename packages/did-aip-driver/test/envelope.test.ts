/**
 * Pure unit tests for the envelope/status mapping. No network, no Express.
 * Run: npm test
 */

import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  DID_RESOLUTION_CONTEXT,
  errorEnvelope,
  statusFor,
  toEnvelope,
} from "../src/envelope.js";

// A successful resolver result. Note agentRecord carries BigInt fields, exactly
// like the real resolver does, so we can prove the envelope strips them.
const okResult: any = {
  didDocument: {
    "@context": ["https://www.w3.org/ns/did/v1"],
    id: "did:aip:7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU:agent",
    controller: "did:aip:7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU:agent",
  },
  didResolutionMetadata: {
    contentType: "application/did+ld+json",
    pda: "AgentPdaBase58Address",
    bump: 254,
    slot: 1234,
    network: "solana:devnet",
    fetchedAt: "2026-06-01T00:00:00.000Z",
  },
  didDocumentMetadata: {
    registered: "2026-01-01T00:00:00.000Z",
    updated: "2026-01-02T00:00:00.000Z",
  },
  agentRecord: {
    agentId: "agent",
    pricePerTask: 500000n,
    registeredAt: 1700000000n,
    updatedAt: 1700000001n,
  },
};

test("statusFor: success returns 200", () => {
  assert.equal(statusFor(okResult), 200);
});

test("statusFor: error codes map to HTTP statuses", () => {
  assert.equal(statusFor({ didResolutionMetadata: { error: "invalidDid" } } as any), 400);
  assert.equal(statusFor({ didResolutionMetadata: { error: "notFound" } } as any), 404);
  assert.equal(statusFor({ didResolutionMetadata: { error: "deactivated" } } as any), 404);
  assert.equal(statusFor({ didResolutionMetadata: { error: "internalError" } } as any), 500);
});

test("statusFor: unknown error code falls back to 500", () => {
  assert.equal(statusFor({ didResolutionMetadata: { error: "somethingElse" } } as any), 500);
});

test("toEnvelope: adds @context and keeps the three standard members", () => {
  const env = toEnvelope(okResult);
  assert.equal(env["@context"], DID_RESOLUTION_CONTEXT);
  assert.deepEqual(env.didDocument, okResult.didDocument);
  assert.deepEqual(env.didResolutionMetadata, okResult.didResolutionMetadata);
  assert.deepEqual(env.didDocumentMetadata, okResult.didDocumentMetadata);
});

test("toEnvelope: drops the non-standard top-level agentRecord", () => {
  const env = toEnvelope(okResult) as Record<string, unknown>;
  assert.equal(env.agentRecord, undefined);
});

test("toEnvelope: normalizes didDocumentMetadata to {} on error (drops stray deactivated)", () => {
  const notFound: any = {
    didDocument: null,
    didResolutionMetadata: { error: "notFound" },
    didDocumentMetadata: { deactivated: true },
    agentRecord: null,
  };
  const env = toEnvelope(notFound);
  assert.deepEqual(env.didDocumentMetadata, {});
  assert.equal(env.didDocument, null);
  assert.deepEqual(env.didResolutionMetadata, { error: "notFound" });
});

test("toEnvelope: output is JSON-serializable despite BigInt in source agentRecord", () => {
  // If agentRecord leaked through, JSON.stringify would throw on the BigInts.
  const json = JSON.stringify(toEnvelope(okResult));
  assert.ok(!json.includes("agentRecord"), "agentRecord must not appear in the wire body");
  assert.ok(json.includes("didDocument"), "didDocument must appear in the wire body");
});

test("errorEnvelope: shapes a null-document error result", () => {
  const env = errorEnvelope("invalidDid");
  assert.equal(env["@context"], DID_RESOLUTION_CONTEXT);
  assert.equal(env.didDocument, null);
  assert.deepEqual(env.didResolutionMetadata, { error: "invalidDid" });
  assert.deepEqual(env.didDocumentMetadata, {});
  // and it survives serialization
  assert.doesNotThrow(() => JSON.stringify(env));
});
