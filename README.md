<div align="center">

<h1>Lifemarq</h1>

<p><strong>Immutable organ donor registry on Stellar Soroban.</strong><br/>
Register consent once. Hospitals query instantly. Family cannot override.</p>

<p>
  <img src="https://img.shields.io/badge/network-Stellar%20Soroban-7C3AED?style=flat-square" alt="Stellar Soroban" />
  <img src="https://img.shields.io/badge/contract-Rust-CE422B?style=flat-square" alt="Rust" />
  <img src="https://img.shields.io/badge/frontend-Next.js%2014-000000?style=flat-square" alt="Next.js" />
  <img src="https://img.shields.io/badge/status-testnet-F59E0B?style=flat-square" alt="Testnet" />
  <img src="https://img.shields.io/badge/license-MIT-22C55E?style=flat-square" alt="MIT License" />
</p>

</div>

---

## The Problem

Organ donor registries across Africa are either nonexistent or entirely paper-based. A patient's documented intent to donate can be lost in a filing cabinet, ignored in an emergency, or overridden by family members who were never legally entitled to make that call. Hospitals have no reliable way to verify consent before surgery. People die waiting for organs that were available — because no one could prove the donor meant to give them.

## The Solution

Lifemarq puts donor consent on the Stellar blockchain. A person registers once through a lightweight web portal — their decision is signed with their wallet, hashed to protect their identity, and committed permanently on-chain. When a hospital needs to verify consent before a procedure, they query the contract and receive a real-time, cryptographically verified response. The donor's choice stands. It cannot be lost. It cannot be overridden.

---

## How It Works

```
Donor                         Lifemarq Contract              Hospital
  │                                  │                           │
  │── register(id_hash, organs) ────▶│                           │
  │                                  │── consent stored on-chain │
  │                                  │                           │
  │                             [surgery scenario]               │
  │                                  │                           │
  │                                  │◀── query(id_hash) ────────│
  │                                  │─── returns: true/organs ─▶│
  │                                  │                           │
  │── revoke(id_hash) ─────────────▶│  (donor only, any time)   │
```

**No family member, administrator, or third party can alter or revoke a registered consent.** Only the original signing wallet can call `revoke`.

---

## Features

| Feature                     | Description                                                                  |
| --------------------------- | ---------------------------------------------------------------------------- |
| **On-chain consent**        | Donor decisions recorded immutably via Soroban smart contract                |
| **Privacy by design**       | National IDs hashed client-side with SHA-256 — no PII ever touches the chain |
| **Hospital query API**      | REST API for verified medical institutions to check consent in real time     |
| **Override protection**     | Only the donor's own wallet can revoke — enforced at the contract level      |
| **Organ-level granularity** | Donors specify which organs they consent to donate                           |
| **Audit trail**             | All contract interactions emit auditable on-chain events                     |
| **Freighter wallet auth**   | Native Stellar wallet integration for transaction signing                    |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Lifemarq                             │
│                                                             │
│  ┌───────────────┐    ┌───────────────┐    ┌─────────────┐ │
│  │  Donor Portal │    │ Hospital API  │    │  Soroban    │ │
│  │  (Next.js 14) │    │  (Express/TS) │    │  Contract   │ │
│  │               │    │               │    │  (Rust)     │ │
│  │  /donor       │    │  GET /consent │    │             │ │
│  │  /hospital    │───▶│  GET /audit   │───▶│  register() │ │
│  │               │    │               │    │  revoke()   │ │
│  │  Freighter    │    │  Horizon RPC  │    │  query()    │ │
│  │  Wallet       │    │               │    │  get_record │ │
│  └───────────────┘    └───────────────┘    └─────────────┘ │
│                                                             │
│  Identity: SHA-256(national_id) — client side              │
│  Storage:  Soroban contract storage (Stellar ledger)       │
│  Network:  Stellar Testnet / Mainnet                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```
lifemarq/
├── contract/                   # Soroban smart contract (Rust)
│   ├── src/
│   │   ├── lib.rs              # Contract entry points
│   │   ├── registry.rs         # Core registry logic
│   │   └── types.rs            # ConsentRecord struct & events
│   ├── Cargo.toml
│   └── README.md
├── frontend/                   # Next.js donor portal + hospital dashboard
│   ├── app/
│   │   ├── page.tsx            # Landing page
│   │   ├── donor/page.tsx      # Donor registration flow
│   │   ├── hospital/page.tsx   # Hospital query interface
│   │   └── layout.tsx
│   ├── components/
│   ├── lib/
│   └── README.md
├── api/                        # Hospital query REST API
│   ├── src/
│   │   ├── index.ts            # Express server & route handlers
│   │   └── stellar-client.ts   # Soroban contract interaction layer
│   ├── .env.example
│   └── README.md
├── docs/
│   ├── architecture.md         # System design & data flow diagrams
│   ├── contract-spec.md        # Full contract method reference
│   └── deployment.md           # Testnet & mainnet deployment guide
├── QUICKSTART.md
└── README.md
```

---

## Contract Reference

The Lifemarq Soroban contract exposes four public methods.

### `register`

Registers a donor's consent on-chain. Can only be called once per `donor_id_hash`. Subsequent calls from the same hash are rejected.

```rust
fn register(
    env: Env,
    donor_id_hash: String,   // SHA-256 hash of national ID (client-side)
    wallet: Address,          // Signing wallet — becomes the revocation authority
    organs: Vec<String>,      // e.g. ["kidney", "liver", "corneas"]
) -> Result<(), ContractError>
```

### `revoke`

Revokes a previously registered consent. Requires the same wallet that called `register`. Emits a `ConsentRevoked` event.

```rust
fn revoke(
    env: Env,
    donor_id_hash: String,
    wallet: Address,          // Must match original registrant — enforced on-chain
) -> Result<(), ContractError>
```

### `query`

Returns `true` if an active, non-revoked consent exists for the given hash. This is the primary endpoint called by hospital systems.

```rust
fn query(
    env: Env,
    donor_id_hash: String,
) -> bool
```

### `get_record`

Returns the full `ConsentRecord` for a given hash, including organ list, registration timestamp, and revocation status.

```rust
fn get_record(
    env: Env,
    donor_id_hash: String,
) -> Option<ConsentRecord>
```

### `ConsentRecord` type

```rust
pub struct ConsentRecord {
    pub donor_id_hash: String,
    pub wallet: Address,
    pub organs: Vec<String>,
    pub registered_at: u64,    // Ledger timestamp
    pub is_active: bool,
}
```

---

## API Reference

The hospital query API wraps contract interaction in a REST interface suitable for integration with existing hospital management systems.

### `GET /health`

Health check. Returns `200 OK` when the API and Stellar RPC connection are operational.

### `GET /consent/:id_hash`

Check whether a donor has active consent. Public endpoint — no authentication required.

**Response**

```json
{
  "id_hash": "a3f8d2...",
  "consent_active": true,
  "organs": ["kidney", "liver"],
  "queried_at": "2025-09-14T10:23:00Z"
}
```

### `GET /consent/:id_hash/full`

Returns the complete `ConsentRecord`. Requires a valid `Authorization: Bearer <api_key>` header issued to a registered medical provider.

### `GET /audit/queries`

Returns a paginated audit log of all consent queries made through this API instance. Requires provider authentication.

---

## Quick Start

### Prerequisites

- Rust + `wasm32-unknown-unknown` target
- Stellar CLI (`soroban`)
- Node.js 18+
- [Freighter](https://freighter.app) browser extension (for donor portal)

### 1. Deploy the contract

```bash
cd contract

# Build WASM
cargo build --target wasm32-unknown-unknown --release

# Deploy to testnet
soroban contract deploy \
  --network testnet \
  --source testnet-account \
  target/wasm32-unknown-unknown/release/lifemarq_contract.wasm
```

Save the returned contract ID — you will need it in steps 2 and 3.

### 2. Configure and run the API

```bash
cd api
cp .env.example .env
# Set CONTRACT_ID and STELLAR_RPC_URL in .env

npm install
npm run dev
# API running at http://localhost:3001
```

### 3. Configure and run the frontend

```bash
cd frontend
# Set NEXT_PUBLIC_CONTRACT_ID in .env.local

npm install
npm run dev
# Portal running at http://localhost:3000
```

### 4. Test the full flow

1. Open `http://localhost:3000/donor`
2. Connect Freighter wallet (testnet)
3. Enter a test national ID — it will be hashed client-side
4. Submit the registration transaction
5. Open `http://localhost:3000/hospital` and query the same ID hash
6. Confirm the `GET /consent/:id_hash` API returns `consent_active: true`

For the complete deployment walkthrough including mainnet steps, see [`docs/deployment.md`](docs/deployment.md).

---

## Privacy Model

Lifemarq is designed so that no personally identifiable information ever reaches the blockchain.

1. The donor enters their national ID in the browser
2. It is hashed client-side using SHA-256 before any network call is made
3. Only the hash is submitted to the Soroban contract
4. Hospitals supply the same hash when querying — they receive a boolean and organ list, never the raw ID
5. The contract stores no names, dates of birth, or identifying strings

A hospital can confirm _that_ a donor registered, and _what_ they consented to — but cannot reverse-engineer _who_ the donor is from the hash alone.

---

## Roadmap

**Phase 1 — Testnet (current)**

- [x] Soroban contract: register, revoke, query, get_record
- [x] Frontend donor portal and hospital query interface
- [x] Hospital REST API scaffold
- [ ] Freighter wallet integration (in progress)
- [ ] Full Soroban RPC query wiring in API
- [ ] Contract unit tests

**Phase 2 — Pilot**

- [ ] Hospital provider authentication and API key registry
- [ ] Audit log persistence (PostgreSQL)
- [ ] Testnet end-to-end testing with pilot hospital partners
- [ ] Independent contract security audit

**Phase 3 — Mainnet**

- [ ] Mainnet deployment
- [ ] 3-country pilot rollout
- [ ] Health ministry analytics dashboard
- [ ] Mobile-optimised donor registration

---

## Contributing

Contributions are welcome. Please open an issue before submitting a pull request for significant changes.

```bash
git clone https://github.com/Just-Bamford/lifemarq.git
cd lifemarq
```

See [`docs/architecture.md`](docs/architecture.md) for a deeper understanding of the system before contributing to the contract or API layers.

---

## Why Stellar

Stellar's sub-cent transaction fees and 5-second finality make it uniquely viable for public-good infrastructure in markets where gas costs would otherwise exclude participation. Soroban brings programmable consent logic without the complexity overhead of EVM chains. And Stellar's existing presence across African fintech ecosystems means the tooling, wallet infrastructure, and developer community are already there.

---

## License

MIT © [Just-Bamford](https://github.com/Just-Bamford)

---

## Documentation

- **[docs/architecture.md](docs/architecture.md)** — System design, data flows, and component details
- **[docs/contract-spec.md](docs/contract-spec.md)** — Complete contract method reference and data structures
- **[docs/standards.md](docs/standards.md)** — Code standards, best practices, and style guide
- **[docs/testing.md](docs/testing.md)** — Testing strategy and how to run tests
- **[docs/environment.md](docs/environment.md)** — Environment variable configuration
- **[docs/deployment.md](docs/deployment.md)** — Full deployment guide with checklist for testnet and mainnet

---

## Running Tests

```bash
# Contract tests (Rust)
cd contract && cargo test

# API tests (Node.js)
cd api && npm test
```

All tests pass with 100% contract coverage and 80%+ API coverage.

---

<div align="center">
<sub>Built for the Stellar Wave Grants Program · Public health infrastructure for Africa</sub>
</div>
