# Lifemarq Quick Start

Get Lifemarq running locally in 5 minutes.

## Prerequisites

- Node.js 18+
- Rust 1.70+
- Soroban CLI: `cargo install soroban-cli`
- Freighter wallet (browser extension)

## 1. Build Smart Contract

```bash
cd contract
cargo build --target wasm32-unknown-unknown --release
cd ..
```

## 2. Deploy to Testnet

```bash
# Create testnet account
soroban config identity generate --global testnet-account
soroban config identity fund testnet-account --network testnet

# Deploy contract
soroban contract deploy \
  --network testnet \
  --source testnet-account \
  contract/target/wasm32-unknown-unknown/release/lifemarq_contract.wasm
```

**Save the Contract ID** (looks like `CAAAA...`)

## 3. Configure Frontend

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CONTRACT_ID=<your-contract-id>
NEXT_PUBLIC_NETWORK=testnet
```

## 4. Configure API

Create `api/.env`:

```env
NETWORK=testnet
CONTRACT_ID=<your-contract-id>
PORT=3001
```

## 5. Run Services

**Terminal 1 - Frontend:**

```bash
cd frontend
npm install
npm run dev
```

**Terminal 2 - API:**

```bash
cd api
npm install
npm run dev
```

## 6. Test It

1. Open http://localhost:3000
2. Go to **Donor Portal**
3. Enter a test national ID (e.g., "KE123456789")
4. Select organs
5. Click "Register & Sign with Freighter"
6. Approve in Freighter wallet
7. Go to **Hospital Query**
8. Enter the hashed ID
9. Click "Query Consent Status"

## Project Structure

```
lifemarq/
├── contract/          # Soroban smart contract (Rust)
├── frontend/          # Next.js donor portal + hospital dashboard
├── api/               # Hospital query REST API (Node.js)
├── docs/              # Architecture, specs, deployment guides
└── README.md          # Full documentation
```

## Key Files

- **Contract**: `contract/src/lib.rs` — Main contract logic
- **Frontend**: `frontend/app/donor/page.tsx` — Donor registration
- **Frontend**: `frontend/app/hospital/page.tsx` — Hospital query
- **API**: `api/src/index.ts` — REST endpoints

## Next Steps

1. Read `docs/architecture.md` for system overview
2. Read `docs/contract-spec.md` for contract details
3. Read `docs/deployment.md` for mainnet deployment
4. Implement Freighter wallet integration in frontend
5. Implement Soroban contract queries in API

## Troubleshooting

**Contract deployment fails:**

- Ensure Rust WASM target: `rustup target add wasm32-unknown-unknown`
- Fund testnet account: `soroban config identity fund testnet-account --network testnet`

**Frontend can't connect:**

- Check CONTRACT_ID in `.env.local`
- Verify Freighter is installed and set to Testnet

**API returns errors:**

- Check CONTRACT_ID in `api/.env`
- Verify NETWORK is set to `testnet`

## Support

For issues, check:

1. `docs/deployment.md` — Deployment troubleshooting
2. `contract/README.md` — Contract details
3. `frontend/README.md` — Frontend setup
4. `api/README.md` — API setup
