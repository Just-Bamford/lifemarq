# Lifemarq Project Scaffold — Complete

## What's Been Built

A complete, production-ready scaffold for Lifemarq — an immutable organ donor registry on Stellar Soroban.

## Project Structure

```
lifemarq/
├── contract/                          # Soroban Smart Contract (Rust)
│   ├── src/
│   │   ├── lib.rs                    # Contract entry points (register, revoke, query)
│   │   ├── registry.rs               # Core registry logic
│   │   └── types.rs                  # ConsentRecord struct & events
│   ├── Cargo.toml                    # Rust dependencies
│   └── README.md                     # Contract documentation
│
├── frontend/                          # Next.js Frontend
│   ├── app/
│   │   ├── page.tsx                  # Home page
│   │   ├── donor/page.tsx            # Donor registration portal
│   │   ├── hospital/page.tsx         # Hospital query interface
│   │   ├── layout.tsx                # Root layout
│   │   └── globals.css               # Global styles
│   ├── package.json                  # Dependencies
│   └── README.md                     # Frontend documentation
│
├── api/                               # Hospital Query REST API (Node.js)
│   ├── src/
│   │   ├── index.ts                  # Express server & endpoints
│   │   └── stellar-client.ts         # Soroban contract interaction
│   ├── .env.example                  # Environment template
│   ├── package.json                  # Dependencies
│   ├── tsconfig.json                 # TypeScript config
│   └── README.md                     # API documentation
│
├── docs/                              # Documentation
│   ├── architecture.md               # System design & data flows
│   ├── contract-spec.md              # Contract methods & data structures
│   └── deployment.md                 # Testnet & mainnet deployment guide
│
├── README.md                          # Main project README
├── QUICKSTART.md                      # 5-minute setup guide
├── PROJECT_SUMMARY.md                # This file
└── .gitignore                         # Git ignore rules
```

## What Each Component Does

### Smart Contract (Rust/Soroban)

**File:** `contract/src/lib.rs`

Core methods:

- `register(donor_id_hash, wallet, organs)` — Register donor consent on-chain
- `revoke(donor_id_hash, wallet)` — Revoke consent (donor only)
- `query(donor_id_hash)` → bool — Check if consent is active
- `get_record(donor_id_hash)` → ConsentRecord — Get full record

Key features:

- Immutable consent records
- Only donor can revoke (enforced on-chain)
- Hashed identity (no PII on-chain)
- Event logging for audit trail

### Frontend (Next.js)

**Files:** `frontend/app/donor/page.tsx`, `frontend/app/hospital/page.tsx`

Two user flows:

1. **Donor Portal** (`/donor`)
   - Connect Freighter wallet
   - Enter national ID (hashed client-side with SHA-256)
   - Select organs to donate
   - Sign transaction to register on-chain

2. **Hospital Query** (`/hospital`)
   - Enter patient ID hash
   - Query consent status via REST API
   - Display consent result (active/inactive + organs)

### Hospital API (Node.js/Express)

**File:** `api/src/index.ts`

Endpoints:

- `GET /health` — Health check
- `GET /consent/:id_hash` — Query consent status (public)
- `GET /consent/:id_hash/full` — Get full record (auth required)
- `GET /audit/queries` — Audit log

Responsibilities:

- Query Soroban contract
- Return consent status to hospital systems
- Log audit trail
- Manage provider authentication (optional)

## Key Design Decisions

1. **Client-Side Hashing**: National IDs hashed with SHA-256 in browser before any on-chain write
2. **No PII On-Chain**: Only hashed identifiers stored on blockchain
3. **Immutable Consent**: Once registered, can only be revoked by original signer
4. **Public Queries**: Hospitals can query consent without authentication (read-only)
5. **Event Logging**: All actions emit auditable events for compliance

## Technology Stack

| Layer      | Technology                             |
| ---------- | -------------------------------------- |
| Blockchain | Stellar / Soroban (Rust)               |
| Frontend   | Next.js 14 + React 18                  |
| API        | Node.js + Express + TypeScript         |
| Wallet     | Freighter (Stellar wallet)             |
| Identity   | SHA-256 hashing (client-side)          |
| Network    | Stellar Testnet (dev) / Mainnet (prod) |

## Getting Started

### Quick Start (5 minutes)

```bash
# 1. Build contract
cd contract
cargo build --target wasm32-unknown-unknown --release

# 2. Deploy to testnet
soroban contract deploy --network testnet --source testnet-account \
  target/wasm32-unknown-unknown/release/lifemarq_contract.wasm

# 3. Configure frontend & API with contract ID

# 4. Run services
cd frontend && npm install && npm run dev  # Terminal 1
cd api && npm install && npm run dev       # Terminal 2

# 5. Open http://localhost:3000
```

See `QUICKSTART.md` for detailed steps.

### Full Documentation

- **Architecture**: `docs/architecture.md` — System design, data flows, components
- **Contract Spec**: `docs/contract-spec.md` — Methods, data structures, events
- **Deployment**: `docs/deployment.md` — Testnet & mainnet deployment guide

## What's Ready

✅ **Smart Contract**

- Full Soroban contract with register/revoke/query methods
- ConsentRecord data structure
- Event logging for audit trail
- Access control (only donor can revoke)

✅ **Frontend**

- Donor registration portal (Freighter integration ready)
- Hospital query interface
- Client-side SHA-256 hashing
- Responsive UI with Tailwind-like styling

✅ **API**

- Express server with REST endpoints
- Stellar SDK integration (placeholder for contract queries)
- Error handling & CORS
- TypeScript for type safety

✅ **Documentation**

- Architecture diagram & data flows
- Contract specification with all methods
- Deployment guide for testnet & mainnet
- Quick start guide

## What Needs Implementation

⚠️ **Freighter Wallet Integration**

- Frontend needs to connect to Freighter wallet
- Sign transactions for register/revoke
- Handle wallet errors & user rejection

⚠️ **Soroban Contract Queries**

- API needs to build & submit contract invocation transactions
- Parse contract responses
- Handle contract errors

⚠️ **Hospital Provider Registry** (Optional)

- API key validation for hospital systems
- Provider authentication & authorization
- Rate limiting per provider

⚠️ **Audit Log Persistence**

- Store query logs in database (SQLite/PostgreSQL)
- Retrieve audit logs via API
- Compliance reporting

⚠️ **Testing**

- Unit tests for contract
- Integration tests for API
- E2E tests for frontend

## Next Steps

1. **Implement Freighter Integration**
   - Update `frontend/app/donor/page.tsx` to connect wallet
   - Sign transactions for register/revoke

2. **Implement Contract Queries**
   - Update `api/src/stellar-client.ts` to build contract invocations
   - Parse responses from Soroban RPC

3. **Add Hospital Authentication**
   - Implement API key validation in `api/src/index.ts`
   - Add provider registry

4. **Deploy to Testnet**
   - Follow `docs/deployment.md`
   - Test all flows end-to-end

5. **Prepare for Mainnet**
   - Security audit of contract
   - Load testing of API
   - Production deployment

## File Checklist

### Contract

- ✅ `contract/Cargo.toml` — Dependencies
- ✅ `contract/src/lib.rs` — Main contract
- ✅ `contract/src/registry.rs` — Registry logic
- ✅ `contract/src/types.rs` — Data structures
- ✅ `contract/README.md` — Documentation

### Frontend

- ✅ `frontend/package.json` — Dependencies
- ✅ `frontend/app/page.tsx` — Home page
- ✅ `frontend/app/donor/page.tsx` — Donor portal
- ✅ `frontend/app/hospital/page.tsx` — Hospital query
- ✅ `frontend/app/layout.tsx` — Root layout
- ✅ `frontend/app/globals.css` — Styles
- ✅ `frontend/README.md` — Documentation

### API

- ✅ `api/package.json` — Dependencies
- ✅ `api/tsconfig.json` — TypeScript config
- ✅ `api/src/index.ts` — Express server
- ✅ `api/src/stellar-client.ts` — Stellar integration
- ✅ `api/.env.example` — Environment template
- ✅ `api/README.md` — Documentation

### Documentation

- ✅ `docs/architecture.md` — System design
- ✅ `docs/contract-spec.md` — Contract specification
- ✅ `docs/deployment.md` — Deployment guide
- ✅ `README.md` — Main README
- ✅ `QUICKSTART.md` — Quick start guide
- ✅ `.gitignore` — Git ignore rules

## Summary

Lifemarq is now fully scaffolded with:

- Production-ready smart contract structure
- Complete frontend with two user flows
- REST API for hospital integration
- Comprehensive documentation
- Quick start guide for local development

The project is ready for implementation of wallet integration, contract queries, and testing. All core architecture is in place and documented.

**Next action:** Follow `QUICKSTART.md` to deploy to testnet and test locally.
