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
  <img src="https://github.com/Just-Bamford/lifemarq/actions/workflows/contract.yml/badge.svg" alt="Contract CI" />
</p>

</div>

---

## Live Deployment

**Contract ID (Stellar Testnet):**

```
CCZDNLCAHHLDG4W4QZLXJ5IQVBIQGK3F6GZLSAEJVZ2AHVTV2CTBTFE
```

**Links:**

- 📱 **Donor Portal:** https://lifemarq.vercel.app
- 🏥 **Hospital Dashboard:** https://lifemarq.vercel.app/hospital
- 📊 **Ministry Analytics:** https://lifemarq.vercel.app/ministry
- 🔗 **Blockchain Explorer:** https://stellar.expert/explorer/testnet/contract/CCZDNLCAHHLDG4W4QZLXJ5IQVBIQGK3F6GZLSAEJVZ2AHVTV2CTBTFE
- 📡 **API Endpoint:** https://api.lifemarq.io (v1.0.0-testnet)

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

## Quick Start

Deploy the contract to testnet in one command:

```bash
# macOS/Linux
./deploy-testnet.sh

# Windows
deploy-testnet.bat
```

This will:

1. Build the Rust smart contract to WASM
2. Deploy to Stellar testnet
3. Output the contract ID
4. Generate environment files for API and frontend
5. Print explorer link so you can verify it's live

---

## Testnet Deployment

**Status:** ✅ Live on Stellar Testnet (v0.1.0-testnet)

**Contract ID:**

```
CCZDNLCAHHLDG4W4QZLXJ5IQVBIQGK3F6GZLSAEJVZ2AHVTV2CTBTFE
```

**Explorer Links:**

- [Contract on Stellar.Expert](https://stellar.expert/explorer/testnet/contract/CCZDNLCAHHLDG4W4QZLXJ5IQVBIQGK3F6GZLSAEJVZ2AHVTV2CTBTFE)
- [All Transactions](https://stellar.expert/explorer/testnet/contract/CCZDNLCAHHLDG4W4QZLXJ5IQVBIQGK3F6GZLSAEJVZ2AHVTV2CTBTFE/operations)

**Network:** Stellar Testnet

**Try it yourself:**

1. [Visit the donor portal](https://lifemarq.vercel.app/donor) with Freighter wallet (testnet)
2. [Check consent status](https://lifemarq.vercel.app/status/[id_hash]) with any ID hash
3. [Query via hospital dashboard](https://lifemarq.vercel.app/hospital) to test integration

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

### Health & Status

#### `GET /health`

Health check. Returns `200 OK` when the API and Stellar RPC connection are operational.

### Consent Queries

#### `GET /consent/:id_hash`

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

#### `GET /consent/:id_hash/full`

Returns the complete `ConsentRecord`. Requires a valid `Authorization: Bearer <api_key>` header issued to a registered medical provider.

#### `GET /audit/queries`

Returns a paginated audit log of all consent queries made through this API instance. Requires provider authentication.

### Hospital Management (Admin Only)

All endpoints require `Authorization: Bearer ${ADMIN_API_KEY}` header.

#### `POST /hospitals/register`

Submit a hospital for verification. Can be called by the hospital directly or by an admin on their behalf.

**Request**

```json
{
  "hospital_id": "KNH-KE-001",
  "wallet": "GCZXL34YSKZNM4YWFZ5C45G5CVPQRUVSK7VJHQ2PF3D4GY7GSAPMVPQQ",
  "name": "Kenyatta National Hospital",
  "country": "KE",
  "license_number": "LIC-123456"
}
```

**Response (201 Created)**

```json
{
  "status": "registered",
  "hospital_id": "KNH-KE-001",
  "verification_status": "pending",
  "message": "Hospital registered. Awaiting admin approval.",
  "registered_at": "2025-09-14T10:23:00Z"
}
```

#### `GET /hospitals/pending`

List all hospitals awaiting admin approval. **Admin only.**

**Response (200 OK)**

```json
{
  "count": 2,
  "pending": [
    {
      "hospital_id": "KNH-KE-001",
      "wallet": "GCZXL34YSKZNM4YWFZ5C45G5CVPQRUVSK7VJHQ2PF3D4GY7GSAPMVPQQ",
      "name": "Kenyatta National Hospital",
      "country": "KE",
      "license_number": "LIC-123456",
      "registered_at": "2025-09-14T10:23:00Z"
    }
  ],
  "timestamp": "2025-09-14T10:30:00Z"
}
```

#### `POST /hospitals/:id/approve`

Approve a hospital's registration and verify their wallet on-chain. **Admin only.**

**Response (200 OK)**

```json
{
  "status": "approved",
  "hospital_id": "KNH-KE-001",
  "verification_status": "verified",
  "message": "Hospital approved and verified",
  "approved_at": "2025-09-14T10:35:00Z"
}
```

#### `POST /hospitals/:id/revoke`

Revoke a hospital's verification status. Unverified hospitals cannot query donor records. **Admin only.**

**Response (200 OK)**

```json
{
  "status": "revoked",
  "hospital_id": "KNH-KE-001",
  "verification_status": "revoked",
  "message": "Hospital verification revoked",
  "revoked_at": "2025-09-14T10:40:00Z"
}
```

#### `GET /hospitals/:id`

Retrieve a hospital's registration record.

**Response (200 OK)**

```json
{
  "hospital_id": "KNH-KE-001",
  "wallet": "GCZXL34YSKZNM4YWFZ5C45G5CVPQRUVSK7VJHQ2PF3D4GY7GSAPMVPQQ",
  "name": "Kenyatta National Hospital",
  "country": "KE",
  "license_number": "LIC-123456",
  "is_verified": true,
  "registered_at": "2025-09-14T10:23:00Z",
  "approved_at": "2025-09-14T10:35:00Z"
}
```

#### `GET /hospitals/:id/verified`

Quick check if a hospital is verified and can query consent records.

**Response (200 OK)**

```json
{
  "hospital_id": "KNH-KE-001",
  "verified": true,
  "verified_at": "2025-09-14T10:35:00Z"
}
```

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

## Hospital Onboarding & Access Control

Lifemarq implements **on-chain access control** to ensure only verified medical institutions can query donor consent records. This prevents unauthorized data access while maintaining a transparent, auditable approval process.

### Why Access Control?

In a health registry, access is a security boundary. Any wallet can register as a donor (that's the point — individual autonomy). But only credentialed hospitals should retrieve consent data. Lifemarq enforces this at the contract level, not the API level, so the security model is cryptographic and portable across systems.

### Registration Flow

```
Hospital                 API Layer               Soroban Contract          Admin
   │                        │                          │                    │
   │─ POST /hospitals/register ────▶│                  │                    │
   │  {hospital_id, wallet,         │                  │                    │
   │   name, country, license}      │                  │                    │
   │                        │── store ────────────────▶│ (pending)           │
   │                        │                          │                    │
   │                        └─ return 201 pending ─────│                    │
   │                                                    │ [approval pending] │
   │                                                    │                    │
   │                                                    │◀─ POST /hospitals/:id/approve ─│
   │                                                    │   {hospital_id, admin_wallet}  │
   │                                                    │─ approve_hospital() ──────────▶│
   │                        [hospital now verified]    │                    │
   │                                                    │                    │
   │─ query_verified_only(id_hash, hospital_id) ─────▶│                    │
   │                        │                ✓ verified│                    │
   │◀─ returns: organs ─────│                          │                    │
```

### Registration Requirements

1. **Hospital ID** — e.g., `KNH-KE-001` (country code + sequential ID)
2. **Wallet Address** — Stellar testnet account that will sign queries
3. **Hospital Name** — e.g., `Kenyatta National Hospital`
4. **Country Code** — ISO 3166-1 alpha-2 (KE, NG, GH, ZA, etc.)
5. **License Number** — Official medical license or registration number

### Approval Process

1. Hospital submits registration via `POST /hospitals/register`
2. Admin reviews credentials against national health ministry records
3. Admin calls `POST /hospitals/:id/approve` with admin API key
4. Hospital wallet is marked as verified on-chain
5. Subsequent `query_verified_only()` calls from that wallet return actual consent data

**Until approved, queries return `false` (access denied)** — no error message, no indication that the record exists. This protects privacy: an unauthorized party cannot enumerate the registry.

### Query with Hospital Verification

Once verified, a hospital calls `query_verified_only()`:

```rust
pub fn query_verified_only(
    env: Env,
    donor_id_hash: String,    // SHA-256 of donor's national ID
    hospital_id: String,      // e.g. "KNH-KE-001"
) -> bool
```

The contract:

1. Calls `is_hospital_verified(hospital_id)` — must return `true`
2. If unverified, returns `false` (silent failure)
3. If verified, returns actual consent status from the registry
4. Emits an audit event with timestamp, hospital, and query result

### Revocation

Admin can revoke a hospital's verification with:

```
POST /hospitals/:id/revoke
Authorization: Bearer ${ADMIN_API_KEY}
```

This is a permanent action — useful if a hospital's license is revoked, if there is suspected abuse, or if credentials cannot be verified.

### Security Model

- **On-chain enforcement** — The contract checks `is_verified()` before returning data, not the API
- **No API keys for queries** — Hospitals sign transactions with their wallet; the wallet itself is the credential
- **Audit trail** — Every query emits an on-chain event; ministry can retrieve full history
- **Gradual rollout** — API can query with hospital verification check; contract enforces it at query time
- **Cross-border ready** — Hospitals in Kenya can query donors registered in Nigeria using federated contract calls (Phase 2)

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

**Phase 1 — Make It Real (current)**

- [x] Soroban contract: register, revoke, query, get_record
- [x] Frontend donor portal and hospital query interface
- [x] Hospital REST API scaffold
- [x] Freighter wallet integration (client-side signing)
- [x] Multi-language support (English, Swahili, French)
- [x] Public consent status page (/status/:id_hash)
- [x] Audit logging and query history
- [x] GitHub CI/CD workflows
- [ ] Complete Soroban RPC contract query implementation in API

**Phase 2 — Wire Everything Together (Days 4-6)**

- [ ] Deploy contract to Stellar testnet
- [ ] Deploy API to Railway/Render (free tier)
- [ ] Deploy frontend to Vercel
- [ ] Hospital provider authentication and API key registry
- [ ] Audit log persistence (PostgreSQL)
- [ ] Testnet end-to-end testing with pilot hospital partners
- [ ] Independent contract security audit

**Phase 3 — Expand**

- [x] Recipient waitlist contract extension (data capture v1)
- [ ] Ministry analytics dashboard with Recharts
- [ ] Recipient demand visualization (organ distribution by need)
- [ ] Hospital KPI tracking (query volume, average response time)
- [ ] Compliance reporting (CSV export)

**Phase 4 — USSD Gateway (Feature Phone Access)**

**Most of the target population registers consent from a feature phone on 2G.** Phase 4 will integrate [Africa's Talking](https://africastalking.com) USSD gateway so donors can register by dialling a short code, navigating a simple text menu, and confirming — no smartphone or internet required.

```
Donor dials: *384*502#
---
Welcome to Lifemarq Donor Registry

1. Register organs
2. Revoke consent
3. Check status

> 1

Which organs?
1. Kidney
2. Liver
3. Heart
... (select multiple)

Confirm? Yes/No
> Yes

✓ Your organs are registered.
ID: a3f8d2...
---
```

A custodial backend wallet handles the Soroban transaction. The USSD server collects the donor's choice, hashes their national ID (by phone number), calls the contract, and returns confirmation in SMS.

This single feature would unlock the product for the 80% of sub-Saharan Africa on basic phones — turning Lifemarq from a tech demo into actual health infrastructure.

**Phase 5 — Mainnet**

- [ ] Mainnet deployment
- [ ] Regulatory approval for 3-country pilot (Kenya, DRC, Senegal)
- [ ] Health ministry integration
- [ ] Hospital network enrollment

---

## Recipient Waitlist (Demand-Side Registry)

V1 includes a second contract function `register_recipient()` for data capture only — no matching logic yet.

```rust
register_recipient(
    recipient_id_hash: String,    // Hashed for privacy
    wallet: Address,               // Healthcare provider
    needed_organs: Vec<String>,    // ["kidney", "heart"]
    blood_type: String            // "O+", "AB-", etc
) -> Result<(), ContractError>
```

**Why this matters:**

Donor registries solve _supply_. Recipient registries illuminate _demand_. Together they provide a complete picture: _How many kidneys are available vs. how many patients need them?_ This transforms Lifemarq from a tool for consent into infrastructure for capacity planning.

The ministry dashboard surfaces recipient counts by organ type, allowing health planners to:

- Identify organ shortages and mobilize resources
- Track regional disparities in donor availability
- Set realistic transplant program targets

In later phases, the contract will add matching logic: when a donor registers, check the recipient queue and notify providers of a potential match. But v1 focuses on data capture — getting consent and demand both onto the chain so they can be analyzed together.

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
