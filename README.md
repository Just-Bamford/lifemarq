# Lifemarq — Stellar-Based Organ Donor Registry

An immutable, blockchain-powered organ donor registry built on Stellar Soroban. Donors register consent once. Hospitals query instantly. Family cannot override.

## Project Structure

```
lifemarq/
├── contract/                 # Soroban smart contract (Rust)
│   ├── src/
│   │   ├── lib.rs           # Contract entry points
│   │   ├── registry.rs      # Core registry logic
│   │   └── types.rs         # Data structures
│   ├── Cargo.toml
│   └── README.md
├── frontend/                 # Next.js donor portal + hospital dashboard
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── package.json
│   └── README.md
├── api/                      # Hospital query REST API
│   ├── src/
│   ├── package.json
│   └── README.md
├── docs/
│   ├── architecture.md
│   ├── contract-spec.md
│   └── deployment.md
└── README.md
```

## Quick Start

### 1. Deploy Smart Contract

```bash
cd contract
cargo build --target wasm32-unknown-unknown --release
soroban contract deploy --network testnet
```

### 2. Run Frontend

```bash
cd frontend
npm install
npm run dev
```

### 3. Start Hospital API

```bash
cd api
npm install
npm start
```

## Core Features

- **On-Chain Consent**: Immutable donor registration via Soroban
- **Hospital Query API**: Real-time consent verification
- **Family Override Protection**: Only donor can revoke
- **Privacy by Design**: Hashed identity, no PII on-chain
- **Audit Trail**: Transparent query logs

## Tech Stack

- **Blockchain**: Stellar / Soroban (Rust)
- **Frontend**: Next.js
- **API**: Node.js / Express
- **Wallet**: Freighter
- **Identity**: SHA-256 hashing (client-side)

## Deployment

- **Testnet**: Initial deployment and testing
- **Mainnet**: Production rollout (post-audit)

## Impact Targets (Year One)

- 10,000+ donor registrations across 3 pilot countries
- 50+ partner hospitals onboarded
- 0 successful family overrides

## License

MIT
