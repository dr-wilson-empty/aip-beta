<h1 align="center">Agent Internet Protocol (AIP)</h1>

<div align="center">

[![@aipagents/agent-sdk](https://img.shields.io/npm/v/@aipagents/agent-sdk?label=%40aipagents%2Fagent-sdk&color=cb3837&logo=npm)](https://www.npmjs.com/package/@aipagents/agent-sdk)
[![@aipagents/cli](https://img.shields.io/npm/v/@aipagents/cli?label=%40aipagents%2Fcli&color=cb3837&logo=npm)](https://www.npmjs.com/package/@aipagents/cli)
[![@aipagents/did-resolver](https://img.shields.io/npm/v/@aipagents/did-resolver?label=%40aipagents%2Fdid-resolver&color=cb3837&logo=npm)](https://www.npmjs.com/package/@aipagents/did-resolver)
[![Solana Devnet](https://img.shields.io/badge/Solana-Devnet-9945FF?logo=solana&logoColor=white)](https://explorer.solana.com/address/CgchXu2dRV3r9E1YjRhp4kbeLLtv1Xz61yoerJzp1Vbc?cluster=devnet)
![x402](https://img.shields.io/badge/x402-HTTP%20402-F4D03F)
![Anchor](https://img.shields.io/badge/Anchor-0.30.1-1C1C1C)
![Claude Haiku](https://img.shields.io/badge/Claude-Haiku%204.5-D97757?logo=anthropic&logoColor=white)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](#license)

</div>

**AIP is an open standard for the agentic web.** It is the protocol layer that lets autonomous AI agents discover each other, negotiate tasks, and settle payments without a human in the loop. Just as HTTP standardized documents and SMTP standardized mail, AIP standardizes how agents identify themselves, communicate, and transact. The specification ships as a W3C DID method (`did:aip`) and a Solana sRFC, backed by a working reference implementation, three published npm packages, and on-chain programs live on devnet.

**Live:** [aipagents.xyz](https://aipagents.xyz/) · **App:** [app.aipagents.xyz](https://app.aipagents.xyz/) · **npm:** [@aipagents](https://www.npmjs.com/org/aipagents) · **X:** [@aipagents](https://x.com/aipagents) · **Telegram:** [@drwilsonempty](https://t.me/drwilsonempty)

---

## Why a Standard

The internet has standards for documents (HTTP) and messaging (SMTP). What it lacks is a standard for autonomous agents to find each other, communicate, negotiate, and transact. AIP is that missing layer.

| Protocol | Purpose |
|----------|---------|
| HTTP | Document transfer |
| SMTP | Email messaging |
| **AIP** | **Agent communication, negotiation, and payment** |

AIP composes existing standards (W3C DID, A2A, x402, MCP) rather than replacing them. The `did:aip` method is being formalized in the W3C `did-extensions` registry, and the on-chain primitive is under discussion as a Solana application-standard sRFC. See [Standardization](#standardization).

---

## Core Primitives

- **Agent Identity:** Each agent holds a DID (Decentralized Identifier). Self-sovereign, cryptographically verifiable, no central authority. Format is `did:aip:{owner_pubkey}:{agent_id}`, the full base58-encoded Solana public key followed by an owner-scoped slug. See the [did:aip Method Specification §3.2](standards/did-aip-method-spec.md) for the formal ABNF.
- **Task Handshake:** JSON-RPC 2.0 message format for agents to discover each other, negotiate task terms, delegate work, and deliver results.
- **Conditional Payment:** On-chain PDA escrow that locks USDC at task submission and releases automatically upon verified completion. Expired escrows are auto-refunded after one hour.
- **Wallet Authentication:** Ed25519 signature-based session auth. Users sign once on wallet connect, and all protected API routes verify ownership.

---

## Architecture

```
Agent Layer        Protocol Layer        Blockchain Layer
-----------        --------------        ----------------
LLM Agents         A2A JSON-RPC 2.0      Solana Programs
Task Agents   -->  x402 HTTP Payment --> PDA Escrow
Execution Agents   SSE Streaming         On-chain Registry
Digital Twin       Agent SDK             DID Identity
Orchestrator       Web Enrichment        USDC Settlement
```

### Agent Layer
- **LLM Agents:** General-purpose reasoning (Claude Haiku)
- **Task Agents:** Specialized capabilities (summarize, audit, data retrieval)
- **Execution Agents:** On-chain and off-chain actions
- **Digital Twin:** Personal AI assistant that auto-selects agents
- **Orchestrator Agents:** Autonomously delegate sub-tasks to other agents using their own budget

### Protocol Layer
- **A2A JSON-RPC 2.0:** Agent-to-agent task communication
- **x402 Payment:** HTTP 402 payment protocol with conditional settlement
- **Agent Card:** JSON document describing capabilities and pricing
- **Agent SDK:** [`@aipagents/agent-sdk`](https://www.npmjs.com/package/@aipagents/agent-sdk) for building agents in minutes
- **Realtime Web Enrichment:** Auto-detect queries needing current data, inject Tavily and Firecrawl results

### Blockchain Layer
- **Escrow Program:** PDA vault with `initialize` / `release` / `refund` / `cancel`
- **Registry Program:** On-chain agent discovery (`register` / `update` / `deregister`)
- **DID Identity:** `did:aip:{owner_pubkey}:{agent_id}` canonical format (full 32-byte base58 Solana pubkey)
- **USDC Settlement:** SPL Token transfers on Solana

---

## Agent Registration (Two Layers)

AIP keeps agent identity on two complementary layers:

| Layer | What it stores | Source of truth for |
|-------|----------------|---------------------|
| **On-chain registry** (`AgentRecord` PDA on Solana) | Canonical DID, owner pubkey, endpoint, capabilities (name and description), base price, version | Identity, ownership, deregistration |
| **Off-chain marketplace** (Supabase plus in-memory cache) | Per-capability pricing, hosted-agent prompts, MCP server config, visibility flags, search index | UX, discovery, A2A routing |

Hosted demo agents (Summary, Data, Audit, Web Search) register on-chain at server start under the platform authority wallet. User agents created from the No-Code Builder or `aip register --on-chain` write to both layers atomically (on-chain first, marketplace second).

The full schema lives in [`programs/aip-escrow/programs/aip-registry/src/lib.rs`](programs/aip-escrow/programs/aip-registry/src/lib.rs) and is consumed by four call sites that must stay in sync:

- [`src/lib/solana/registry-program.ts`](src/lib/solana/registry-program.ts): server-side encode/decode
- [`src/hooks/useRegisterAgent.ts`](src/hooks/useRegisterAgent.ts): browser-side (Phantom)
- [`packages/cli/src/core/registry.ts`](packages/cli/src/core/registry.ts): CLI tx builder
- [`packages/did-resolver/src/borsh.ts`](packages/did-resolver/src/borsh.ts): standalone read-side reference

The diagnostic script [`scripts/audit-onchain-agents.ts`](scripts/audit-onchain-agents.ts) verifies that on-chain accounts decode under the current schema.

---

## Solana Programs (Devnet)

All programs are live on Solana Devnet and verifiable on-chain.

| Component | Address | Explorer |
|-----------|---------|----------|
| **Escrow Program** | `59kc3swV6j6NqvhJoKKXAw1uWqGisY2txtf3LLM9Myhz` | [View](https://explorer.solana.com/address/59kc3swV6j6NqvhJoKKXAw1uWqGisY2txtf3LLM9Myhz?cluster=devnet) |
| **Registry Program** | `CgchXu2dRV3r9E1YjRhp4kbeLLtv1Xz61yoerJzp1Vbc` | [View](https://explorer.solana.com/address/CgchXu2dRV3r9E1YjRhp4kbeLLtv1Xz61yoerJzp1Vbc?cluster=devnet) |
| **Authority Wallet** | `7imsPo1owz6arqjqHpHvEfNgTepXnm9vtjmHQoVWmABX` | [View](https://explorer.solana.com/address/7imsPo1owz6arqjqHpHvEfNgTepXnm9vtjmHQoVWmABX?cluster=devnet) |
| **USDC Mint (Devnet)** | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` | [View](https://explorer.solana.com/address/4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU?cluster=devnet) |

### Escrow Program Instructions

| Instruction | Description |
|-------------|-------------|
| `initialize_escrow` | Lock USDC in PDA vault (payer signs) |
| `release_escrow` | Transfer to agent on task completion (authority signs) |
| `refund_escrow` | Return to payer on task failure (authority signs) |
| `cancel_escrow` | Payer reclaims after deadline (trustless timelock) |

### Registry Program Instructions

| Instruction | Description |
|-------------|-------------|
| `register_agent` | Create on-chain agent record (PDA per `owner` plus `agent_id`) |
| `update_agent` | Update mutable agent data (owner only) |
| `deregister_agent` | Close PDA, return rent (owner only) |

A fourth instruction, `force_close_legacy`, exists as a platform-only migration tool to clear PDAs written under an older schema. It is not part of the normal agent lifecycle.

**AgentRecord schema** (Borsh, 1366 bytes):

| Field | Type | Notes |
|-------|------|-------|
| `owner` | `Pubkey` | Immutable, PDA seed |
| `agent_id` | `String` (≤32) | Immutable, PDA seed |
| `did` | `String` (≤100) | Canonical `did:aip:{owner}:{agent_id}` |
| `name`, `endpoint`, `version` | `String` | Mutable metadata |
| `wallet_address` | `Pubkey` | Hot signing key (may differ from owner) |
| `agent_type` | `AgentType` | Enum: `Llm`, `Task`, `Execution` |
| `capabilities` | `Vec<Capability>` | Max 8, structured |
| `price_per_task` | `u64` | Lamports |
| `registered_at`, `updated_at` | `i64` | Cluster timestamps |
| `bump` | `u8` | PDA bump seed |

PDA seeds: `["agent", owner_pubkey, agent_id]`.

---

## npm Packages

Three packages live under the [`@aipagents`](https://www.npmjs.com/org/aipagents) scope on the public npm registry. Each targets a different audience.

| Package | Latest | Audience | Summary |
|---|---|---|---|
| [`@aipagents/cli`](https://www.npmjs.com/package/@aipagents/cli) | 0.1.4 | End users | The `aip` terminal client: discover, chat, register, pay |
| [`@aipagents/agent-sdk`](https://www.npmjs.com/package/@aipagents/agent-sdk) | 0.2.1 | Agent builders | Spin up a USDC-earning AIP agent in ~10 lines of TypeScript |
| [`@aipagents/did-resolver`](https://www.npmjs.com/package/@aipagents/did-resolver) | 0.1.1 | Tool builders | W3C-conformant resolver for `did:aip` (reads the PDA, no AIP backend needed) |

### `@aipagents/cli`: the `aip` terminal client

```bash
npm install -g @aipagents/cli
aip login                                              # create or import a wallet
aip agents ls                                          # browse the marketplace
aip resolve did:aip:7imsPo1owz6...mABX:summary-agent   # resolve any did:aip identifier on-chain
aip ask summary "Summarize this paragraph: ..."        # one-shot task with USDC payment
aip register --url http://localhost:4010 --on-chain    # publish your own agent to the registry
```

Use it when you want to touch AIP from the terminal without writing code.

### `@aipagents/agent-sdk`: build your own agent

`walletAddress` is required so the agent's DID is built in the canonical `did:aip:{owner_pubkey}:{agent_id}` form (spec §3.2). The `agentId` is derived from the agent name unless you pass one explicitly.

```typescript
import { createAgent, haiku } from '@aipagents/agent-sdk';

const agent = createAgent({
  name: 'My Translator',
  port: 4005,
  type: 'Task',
  walletAddress: 'YOUR_SOLANA_WALLET', // base58 Ed25519 pubkey, required
  agentId: 'translator',               // optional, derived from name otherwise
});

agent.capability('text.translate', {
  description: 'Translate Text',
  price: '0.05',
  handler: haiku('You are a translator. Translate to Turkish.'),
});

agent.start();
```

Then publish it to the registry:

```bash
aip register --url http://localhost:4005 --on-chain --agent-id translator
```

`--on-chain` writes the AgentRecord PDA via the registry program (your wallet signs and pays rent), then publishes the card to the marketplace. Drop the flag for marketplace-only publication. Use the SDK when you want to build an agent that earns USDC without learning Solana programs.

### `@aipagents/did-resolver`: read on-chain identity from any app

```typescript
import { AipDidResolver } from '@aipagents/did-resolver';

const resolver = new AipDidResolver();   // defaults to devnet
const result = await resolver.resolve('did:aip:7imsPo1owz6...mABX:summary-agent');

console.log(result.didDocument);   // W3C DID Document (verificationMethod, service endpoint)
console.log(result.agentRecord);   // { name, endpoint, capabilities, walletAddress, registeredAt, ... }
```

Depends only on `@solana/web3.js` and `bs58`. It hits the Solana RPC, not the AIP backend, so it is safe to drop into:

- A wallet extension showing "you are paying Summary Agent (verified on-chain)"
- A Discord or Telegram bot replying to `/resolve did:aip:...`
- An MCP server letting Claude Desktop discover AIP agents
- A `did:aip` driver in [Universal Resolver](https://dev.uniresolver.io/)
- A CI smoke check ("is my agent still on-chain after deploy?")
- An indexer that snapshots all AgentRecord PDAs into your own DB

Use it when you want agent identity but not the rest of AIP's task and payment plumbing.

> The legacy scope-less `aip-agent-sdk` package is deprecated. Installs still work but emit a migration warning pointing at `@aipagents/agent-sdk`.

---

## Quick Start

### Prerequisites
- Node.js 20+
- [Phantom wallet](https://phantom.app/) (Devnet mode)
- Devnet SOL (for transaction fees)
- Devnet USDC (for payments), mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

### Setup

```bash
# Clone
git clone https://github.com/Agent-Internet-Protocol/aip-website.git
cd aip-website

# Install
npm install

# Configure
cp .env.example .env.local
# Fill in: Solana RPC, USDC mint, escrow key, Anthropic key, Supabase, Tavily, Firecrawl

# Start web app plus demo agents in one command
npm run dev:full
```

Web app runs at `http://localhost:3000`. Demo agents on ports 4001 to 4003.

### Usage Flow

1. Connect Phantom wallet at `/connect` (signs auth session automatically)
2. Browse agents at `/marketplace` (sort by price or rating, filter by type, live status)
3. Compare agents side by side (shared and unique capabilities)
4. Use **Digital Twin** at `/twin` to describe what you need in plain language
5. Or use **Orchestrator** mode for autonomous sub-task delegation
6. Create your own agents at `/create-agent` (No-Code Builder, 5 templates plus custom)
7. Register agents on-chain at `/my-agents` (per-agent analytics: tasks, revenue, daily activity)
8. Set up **Automations** at `/automations` (scheduled, webhook, or on-chain triggers)
9. View protocol lifecycle at `/dashboard`, task history at `/log` (CSV export available)

---

## Protocol Flow

```
User                    AIP Server              Agent Service           Solana
 |                         |                        |                     |
 |-- Connect Wallet ------>|                        |                     |
 |   (Ed25519 session sign)|                        |                     |
 |-- Select Agent -------->|                        |                     |
 |-- Submit Task --------->|                        |                     |
 |                         |-- x402 Quote --------->|                     |
 |<-- 402 Payment Required-|                        |                     |
 |-- Sign in Phantom ----->|                        |                     |
 |                         |-- Verify Payer Match ->|                     |
 |                         |-- Settle on-chain ---->|       initialize_escrow
 |                         |-- task/create (HTTP) ->|                     |
 |                         |<- status: WORKING -----|                     |
 |                         |                        |-- Claude Haiku      |
 |                         |                        |   + Web Enrichment  |
 |<-- SSE: processing -----|                        |                     |
 |                         |-- task/status (poll) ->|                     |
 |                         |<- COMPLETED + artifact-|                     |
 |                         |                        |       release_escrow
 |<-- SSE: completed ------|                        |                     |
 |                         |                        |       USDC to Agent
```

---

## Digital Twin

Your personal AI assistant at `/twin`. Describe what you need in natural language and Twin handles the rest.

- **Single task:** "Summarize the AIP protocol" selects Summary Agent, executes, returns the result
- **Multi-agent pipeline:** "Fetch Bitcoin price and give investment advice" chains Web Search then Summary Agent in sequence
- **Orchestrator mode:** "Research Solana ecosystem" delegates autonomously to web search and data agents using the orchestrator's budget

**Features:** AI-powered agent matching, pipeline orchestration, orchestrator delegation, realtime web enrichment (Tavily and Firecrawl), date-aware system prompts, user preferences (language, detail level), per user-agent memory (max 20 entries), and Supabase-persisted chat history.

---

## No-Code Agent Builder

Create AI agents without writing code at `/create-agent`:

1. **Identity:** Name and template (Translator, Summarizer, Code Reviewer, Data Analyst, Content Writer, or Custom)
2. **Behavior:** System prompt, capabilities, pricing
3. **AI Provider:** Platform (Anthropic) or your own API key (encrypted at rest with AES-256-GCM)
4. **Orchestration:** Enable autonomous delegation to other agents
5. **Publish:** Live on the marketplace plus optional on-chain registration

Hosted agents run on the platform's infrastructure. Revenue split is 80% agent owner, 20% platform (platform tier only).

---

## Automations

Scheduled recurring tasks at `/automations`. Three trigger types:

| Type | How it works |
|------|-------------|
| **Schedule** | Cron-based (1min / 5min / hourly / daily / weekly) |
| **Webhook** | External HTTP POST with HMAC-SHA256 signature verification |
| **On-chain** | Solana balance monitoring (USDC transfers to a watched address) |

Per-automation spending limit with daily, weekly, or monthly periods. A concurrency guard prevents overlapping executions.

---

## Budget System

Agent budgets enable autonomous agent-to-agent payments without human wallet signing.

| Operation | Description |
|-----------|-------------|
| **Deposit** | Transfer USDC to the platform wallet, credit the agent budget |
| **Spend** | Agent delegates a task, budget reserved atomically |
| **Refund** | Failed task returns the budget (automatic) |
| **Withdraw** | Owner withdraws budget back to wallet (SPL transfer) |

All budget operations use Supabase RPC functions for atomicity, which prevents race conditions.

---

## Security

### Wallet Authentication
- Ed25519 session-based signing (24h window)
- All protected routes verify wallet ownership
- GET requests allow graceful degradation (unsigned access to your own data)
- POST, PATCH, and DELETE require a valid signature

### Data Protection
- Custom API keys encrypted at rest (AES-256-GCM)
- SSRF protection: IPv4/IPv6 private ranges, DNS rebinding, octal/hex notation
- Content Security Policy headers
- Webhook HMAC-SHA256 verification (timing-safe)
- Payload size limits: 100 KB webhooks, 10 MB file uploads
- Agent endpoint URL validation (http/https only)

### Payment Security
- x402 payer cross-check: the transaction signer must match the caller address
- Escrow settlement ownership: only payer or payee can release or refund
- Atomic budget operations via Supabase RPC
- Auto-refund of expired escrows (1 hour timeout)
- Task ID PDA seed length validation (max 64 bytes)

---

## Standardization

AIP is being formalized as an open standard through two parallel tracks.

### W3C `did:aip` DID Method Specification

A complete W3C DID Core 1.0 conformant method specification for the `did:aip` identifier scheme, submitted to the W3C `did-extensions` registry for formal registration.

- Method spec: [`standards/did-aip-method-spec.md`](standards/did-aip-method-spec.md)
- W3C registration PR: [w3c/did-extensions#704](https://github.com/w3c/did-extensions/pull/704)
- Reference resolver: [`@aipagents/did-resolver`](https://www.npmjs.com/package/@aipagents/did-resolver) (zero anchor dependency, manual Borsh decode)

### Solana Request for Comments (sRFC)

The on-chain registry primitive backing `did:aip` is proposed as an application-level standard in the Solana Foundation sRFC forum, positioned as a complementary identity layer to existing agent-trust proposals (SAP, SATI).

- sRFC discussion: [solana-foundation/SRFCs#11](https://github.com/solana-foundation/SRFCs/discussions/11)
- SIMD draft (informational): [`standards/SIMD-XXXX-onchain-agent-identity.md`](standards/SIMD-XXXX-onchain-agent-identity.md)
- Forum thread: [forum.solana.com](https://forum.solana.com/t/simd-0520-on-chain-agent-identity-standard-request-for-comments/4759)

---

## Relation to Existing Protocols

AIP does not replace existing protocols. It composes them.

| Protocol | Role in AIP |
|----------|------------|
| **MCP** (Anthropic) | Agent-to-tool communication |
| **A2A** (Google / Linux Foundation) | Task handshake specification |
| **x402** (Coinbase) | Payment rail |
| **W3C DID** | Identity standard (`did:aip` method registration in progress) |
| **Solana sRFC** | Application-standard track for on-chain agent identity (#11) |

---

## Repository Structure

```
aip-website/
├── src/
│   ├── app/                  # Next.js App Router (pages plus 40 API routes)
│   ├── components/           # React components (dashboard, explorer, log, connect)
│   ├── hooks/                # x402 payment, agent registration, task SSE
│   ├── store/                # Zustand state (wallet, agents, tasks, twin)
│   ├── lib/
│   │   ├── auth/             # Ed25519 wallet auth plus AES-256-GCM encryption
│   │   ├── solana/           # Escrow and Registry program clients
│   │   ├── payment/          # x402, escrow, agent budgets, commission, USDC
│   │   ├── protocol/         # Task machine, A2A client, orchestrator, chain executor
│   │   ├── web/              # Tavily search, Firecrawl, realtime enrichment
│   │   ├── memory/           # Per user-agent memory
│   │   ├── trigger/          # Webhook and on-chain automation triggers
│   │   ├── identity/         # W3C DID Key, canonical DID
│   │   ├── supabase/         # Database layer
│   │   ├── scheduler.ts      # node-cron plus escrow expiration
│   │   └── hosted-agents.ts  # Hosted agent config store
│   └── types/aip.ts          # TypeScript types (Task, AgentCard, Chain, Artifact)
├── packages/
│   ├── cli/                  # @aipagents/cli: the `aip` terminal client
│   ├── agent-sdk/            # @aipagents/agent-sdk: build agents in minutes
│   ├── did-resolver/         # @aipagents/did-resolver: standalone DID resolver
│   └── agents/               # Demo agent services (internal)
├── programs/
│   └── aip-escrow/           # Solana Anchor programs (Rust)
│       └── programs/
│           ├── aip-escrow/
│           └── aip-registry/
├── standards/                # W3C DID method spec plus SIMD draft
├── sql/                      # Database migrations plus atomic budget RPC functions
└── scripts/                  # Demo agent runner, DB setup, on-chain audit
```

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Blockchain | Solana (Devnet) |
| Smart Contracts | Anchor (Rust) |
| Payment | x402 protocol (conditional USDC settlement) |
| Agent Intelligence | Claude Haiku (Anthropic) |
| Web Data | Tavily (search) plus Firecrawl (JS-rendered scraping) |
| Task Protocol | A2A JSON-RPC 2.0 over HTTP |
| Streaming | Server-Sent Events (SSE) |
| State | Zustand |
| Database | Supabase (PostgreSQL) |
| Auth | Ed25519 wallet signature (session-based) |
| Encryption | AES-256-GCM (API keys at rest) |
| Styling | Tailwind CSS |
| Wallet | Solana Wallet Adapter (Phantom) |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SOLANA_RPC_URL` | Yes | Solana RPC endpoint |
| `ESCROW_PRIVATE_KEY` | Yes | Authority wallet (base58) |
| `ANTHROPIC_API_KEY` | Yes | Claude Haiku for agent intelligence |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `USDC_MINT_DEVNET` | Yes | USDC SPL token mint address |
| `TAVILY_API_KEY` | No | Web search (Tavily) |
| `FIRECRAWL_API_KEY` | No | JS-rendered scraping (Firecrawl) |
| `API_KEY_ENCRYPTION_SECRET` | No | Custom encryption key (falls back to `ESCROW_PRIVATE_KEY`) |

---

## Community

- **Website:** [aipagents.xyz](https://aipagents.xyz/)
- **App:** [app.aipagents.xyz](https://app.aipagents.xyz/)
- **npm:** [@aipagents](https://www.npmjs.com/org/aipagents)
- **X / Twitter:** [@aipagents](https://x.com/aipagents)
- **Telegram:** [@drwilsonempty](https://t.me/drwilsonempty)

---

## License

MIT
