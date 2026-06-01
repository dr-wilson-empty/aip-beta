/**
 * Maps the resolver's output into the exact wire format the DIF Universal
 * Resolver expects, and into the HTTP status codes its callers expect.
 *
 * Why this file exists separately from server.ts: it is pure (no Express, no
 * network), so the mapping is unit-testable on its own.
 *
 * Design note: @aipagents/did-resolver already returns a DIF-shaped
 * ResolutionResult (didDocument | null, didResolutionMetadata,
 * didDocumentMetadata). It does NOT throw on bad input; it reports failure in
 * `didResolutionMetadata.error`. So the driver never uses try/catch for
 * resolution outcomes; it branches on that error field instead.
 */

import type { ResolutionResult } from "@aipagents/did-resolver";

/** Top-level JSON-LD context for a DID Resolution Result. */
export const DID_RESOLUTION_CONTEXT = "https://w3id.org/did-resolution/v1";

/** Content-Type the DIF interface requires on the response. */
export const DID_LD_JSON = "application/did+ld+json";

/**
 * A spec-clean DID Resolution Result: exactly the four members W3C defines.
 * Note we deliberately do NOT carry the resolver's non-standard top-level
 * `agentRecord` (see toEnvelope).
 */
export interface ResolutionEnvelope {
  "@context": string;
  didDocument: ResolutionResult["didDocument"];
  didResolutionMetadata: ResolutionResult["didResolutionMetadata"];
  didDocumentMetadata: ResolutionResult["didDocumentMetadata"];
}

/**
 * Map a resolver result to an HTTP status code.
 *
 *   invalidDid                -> 400
 *   notFound | deactivated    -> 404
 *   internalError | unknown   -> 500
 *   (no error, document present) -> 200
 */
export function statusFor(result: ResolutionResult): number {
  const meta = result.didResolutionMetadata;
  if (meta && "error" in meta) {
    switch (meta.error) {
      case "invalidDid":
        return 400;
      case "notFound":
      case "deactivated":
        return 404;
      case "internalError":
        return 500;
      default:
        return 500;
    }
  }
  return 200;
}

/**
 * Wrap a resolver result as a DID Resolution Result for the HTTP body.
 *
 * Three things happen here:
 *  1. We add the top-level `@context` the resolver omits.
 *  2. We pick ONLY the three standard members, dropping the resolver's extra
 *     top-level `agentRecord` (non-standard, and its BigInt fields would make
 *     JSON.stringify throw "Do not know how to serialize a BigInt").
 *  3. On an error result we force `didDocumentMetadata` to {}. The resolver
 *     emits `{ deactivated: true }` on notFound, which is contradictory for a
 *     DID that never existed; we normalize it away so error bodies are clean.
 */
export function toEnvelope(result: ResolutionResult): ResolutionEnvelope {
  const isError = "error" in result.didResolutionMetadata;
  return {
    "@context": DID_RESOLUTION_CONTEXT,
    didDocument: result.didDocument,
    didResolutionMetadata: result.didResolutionMetadata,
    didDocumentMetadata: isError ? {} : result.didDocumentMetadata,
  };
}

/** Build an error envelope for faults that happen outside the resolver. */
export function errorEnvelope(
  error: "invalidDid" | "notFound" | "deactivated" | "internalError",
): ResolutionEnvelope {
  return {
    "@context": DID_RESOLUTION_CONTEXT,
    didDocument: null,
    didResolutionMetadata: { error } as ResolutionResult["didResolutionMetadata"],
    didDocumentMetadata: {},
  };
}
