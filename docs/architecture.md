# Lifemarq Architecture

## System Overview

Lifemarq is a three-tier system for managing organ donor consent on the Stellar blockchain.

```
┌─────────────────────────────────────────────────────────────┐
│                    Stellar Blockchain                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Soroban Smart Contract (Rust)                       │   │
│  │  - register(donor_id_hash, wallet, organs)           │   │
│  │  - revoke(donor_id_hash, wallet)                     │   │
│  │  - query(donor_id_hash) → bool                       │   │
│  │  - get_record(donor_id_hash) → ConsentRecord         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         ▲                                    ▲
         │                                    │
    Write (Sign)                         Read (Query)
         │                                    │
┌────────┴──────────────┐          ┌─────────┴──────────────┐
│   Frontend (Next.js)  │          │  Hospital API (Node)   │
├───────────────────────┤          ├────────────────────────┤
│ Donor Portal          │          │ GET /consent/:id_hash  │
│ - Connect Freighter   │          │ - Query contract       │
│ - Hash national ID    │          │ - Return status        │
│ - Select organs       │          │ - Log audit trail      │
│ - Sign transaction    │          └────────────────────────┘
│                       │                    ▲
│ Hospital Query        │                    │
│ - Enter patient ID    │              HTTP Request
│ - Display consent     │                    │
│ - Show organs         │          ┌─────────┴──────────────┐
└───────────────────────┘          │  Hospital Systems      │
                                   │  - EMR/EHR             │
                                   │  - Surgery Scheduling  │
                                   │  - Transplant Mgmt     │
                                   └────────────────────────┘
```

## Data Flow

### 1. Donor Registration

```
Donor
  ↓
[Enter National ID + Select Organs]
  ↓
[Hash National ID (SHA-256) client-side]
  ↓
[Connect Freighter Wallet]
  ↓
[Sign Soroban Transaction]
  ↓
Stellar Network
  ↓
[Soroban Contract: register()]
  ↓
[Store ConsentRecord on-chain]
  ↓
[Emit DonorRegistered event]
  ↓
✓ Consent Immutable
```

### 2. Hospital Query

```
Hospital System
  ↓
[Enter Patient ID Hash]
  ↓
[HTTP GET /consent/:id_hash]
  ↓
Hospital API
  ↓
[Query Soroban Contract]
  ↓
Stellar Network
  ↓
[Soroban Contract: query()]
  ↓
[Return boolean (active/inactive)]
  ↓
[Emit ConsentQueried event]
  ↓
Hospital API
  ↓
[Return JSON response]
  ↓
Hospital System
  ↓
✓ Consent Verified
```

### 3. Consent Revocation

```
Donor
  ↓
[Connect Freighter Wallet]
  ↓
[Sign Revocation Transaction]
  ↓
Stellar Network
  ↓
[Soroban Contract: revoke()]
  ↓
[Verify caller is original signer]
  ↓
[Mark ConsentRecord as inactive]
  ↓
[Emit ConsentRevoked event]
  ↓
✓ Consent Revoked (Only by donor)
```

## Component Details

### Smart Contract (Soroban/Rust)

**Responsibilities:**

- Store consent records immutably
- Enforce access control (only donor can revoke)
- Provide query interface for hospitals
- Emit audit events

**Key Methods:**

- `register()` - Create new consent record
- `revoke()` - Deactivate consent (donor only)
- `query()` - Check consent status (public read)
- `get_record()` - Retrieve full record (public read)

**Storage:**

- Map<Vec<u8>, ConsentRecord> - donor_id_hash → consent data

### Frontend (Next.js)

**Responsibilities:**

- Provide user interfaces for donors and hospitals
- Hash national IDs client-side (SHA-256)
- Integrate with Freighter wallet
- Display consent status

**Pages:**

- `/` - Home/overview
- `/donor` - Donor registration portal
- `/hospital` - Hospital query interface

**Key Features:**

- Client-side hashing (PII never leaves browser)
- Freighter wallet integration
- Real-time consent status display

### Hospital API (Node.js/Express)

**Responsibilities:**

- Expose REST endpoints for hospital systems
- Query Soroban contract
- Log audit trail
- Manage provider authentication (optional)

**Endpoints:**

- `GET /health` - Health check
- `GET /consent/:id_hash` - Query consent status
- `GET /consent/:id_hash/full` - Get full record (auth required)
- `GET /audit/queries` - Audit log

## Privacy & Security

### Privacy by Design

1. **Client-Side Hashing**: National IDs hashed with SHA-256 before any on-chain write
2. **No PII On-Chain**: Only hashed identifiers stored on blockchain
3. **Minimal Data Exposure**: Hospital queries return only boolean status
4. **Audit Trail**: All queries logged but not linked to PII

### Security Measures

1. **Immutability**: Consent records cannot be altered once registered
2. **Access Control**: Only original signer can revoke consent
3. **Wallet Authentication**: All writes require Freighter signature
4. **Event Logging**: All actions emit auditable events
5. **Read-Only Queries**: Hospital queries don't require authentication

## Deployment Architecture

### Testnet (Development)

```
Stellar Testnet
  ↓
Soroban Contract (deployed)
  ↓
Frontend (localhost:3000)
Hospital API (localhost:3001)
```

### Mainnet (Production)

```
Stellar Mainnet
  ↓
Soroban Contract (audited, deployed)
  ↓
Frontend (production domain)
Hospital API (production server)
  ↓
Hospital Systems (integrated)
```

## Scalability Considerations

1. **Contract State**: Map-based storage scales with number of donors
2. **Query Performance**: O(1) lookups by donor_id_hash
3. **Event Streaming**: Audit trail via Soroban events
4. **API Caching**: Optional caching layer for frequently queried records
5. **Rate Limiting**: Implement on API for hospital queries

## Future Enhancements

1. **Multi-Organ Preferences**: Granular consent per organ type
2. **Temporal Consent**: Time-limited consent records
3. **Delegation**: Allow healthcare proxies to manage consent
4. **Analytics**: Aggregated, anonymized donation statistics
5. **Mobile App**: Native iOS/Android for donor registration
6. **Passkey Auth**: Passwordless authentication for low-tech users

## Repository Structure

The codebase is organized into three independent deployable modules:

```
lifemarq/
├── contract/                   # Soroban smart contract (Rust)
│   ├── src/
│   │   ├── lib.rs              # Contract entry points & public interface
│   │   ├── registry.rs         # Core registry logic (register, revoke, query)
│   │   ├── types.rs            # ConsentRecord struct, DataKey enum, events
│   │   └── __tests__/          # Unit tests (100% coverage)
│   ├── Cargo.toml              # Dependencies (soroban-sdk v21.0 pinned)
│   └── README.md               # Contract-specific documentation
│
├── frontend/                   # Next.js 14 donor portal + hospital dashboard
│   ├── app/
│   │   ├── page.tsx            # Landing page / home route
│   │   ├── donor/page.tsx      # Donor registration flow (3-state UI)
│   │   ├── hospital/page.tsx   # Hospital query interface
│   │   ├── globals.css         # Global styles
│   │   └── layout.tsx          # Root layout (App Router)
│   ├── lib/
│   │   └── wallet.ts           # Freighter wallet integration (connectWallet, signTransaction)
│   ├── tsconfig.json           # Strict TypeScript + App Router conventions (NEW)
│   ├── package.json            # Dependencies & build scripts
│   ├── .env.local.example      # Environment template
│   └── README.md               # Frontend documentation
│
├── api/                        # Express REST API (TypeScript + Jest)
│   ├── src/
│   │   ├── index.ts            # Express server, route handlers, audit logging
│   │   ├── stellar-client.ts   # Soroban RPC interaction layer (queries & record fetching)
│   │   └── __tests__/          # Jest + Supertest test suite
│   ├── tsconfig.json           # Strict TypeScript configuration (UPDATED)
│   ├── jest.config.js          # Jest configuration with coverage thresholds
│   ├── package.json            # Dependencies & test scripts
│   ├── .env.example            # Environment template
│   └── README.md               # API documentation
│
├── docs/
│   ├── architecture.md         # System design & data flows (this file)
│   ├── contract-spec.md        # Complete contract method reference & XDR types
│   ├── standards.md            # Code standards, best practices & patterns
│   ├── testing.md              # Testing strategy for all components
│   ├── environment.md          # Environment variable setup & secrets management
│   ├── deployment.md           # Testnet & mainnet deployment walkthrough
│   └── definition-of-done.md   # Phase completion criteria & checklist
│
├── .editorconfig               # Cross-IDE code formatting standards (NEW)
├── .gitignore                  # Standard Node.js + Rust ignores
├── README.md                   # Project overview, features, quick start
└── .github/                    # GitHub workflows, templates (optional)
```

### Key Files by Role

**For Developers:**

- `docs/standards.md` - Before committing code
- `docs/testing.md` - Before writing tests
- `docs/architecture.md` - To understand the system (you are here)

**For DevOps/Deployment:**

- `docs/deployment.md` - Testnet and mainnet procedures
- `docs/environment.md` - Required environment variables

**For Hospitals/Integrators:**

- `api/README.md` - API integration guide
- `api/.env.example` - API configuration

**For Donors:**

- `frontend/.env.local.example` - Frontend configuration
- Running `npm run dev` in `frontend/` locally
