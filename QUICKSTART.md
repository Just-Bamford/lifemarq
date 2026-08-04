# Lifemarq Quick Start Guide

Get the system running locally in under 5 minutes.

## Prerequisites

- **Node.js 18+** — `node --version`
- **Rust 1.70+** — `rustc --version`
- **Soroban CLI** — `soroban --version`
- **Freighter Wallet** — Browser extension from https://freighter.app
- **Git** — `git --version`

## Step 1: Clone & Setup

```bash
git clone https://github.com/Just-Bamford/lifemarq.git
cd lifemarq
```

## Step 2: Deploy Contract to Testnet (One-time)

```bash
cd contract

# Build WASM
cargo build --target wasm32-unknown-unknown --release

# Create testnet account (if you don't have one)
soroban config identity generate --global testnet-account --network testnet

# Fund with testnet XLM
soroban config identity fund testnet-account --network testnet

# Deploy contract
CONTRACT_ID=$(soroban contract deploy \
  --network testnet \
  --source testnet-account \
  target/wasm32-unknown-unknown/release/lifemarq_contract.wasm)

echo "CONTRACT_ID=$CONTRACT_ID"
```

Save the `CONTRACT_ID` output — you'll need it in Step 3.

## Step 3: Configure Environment

**Create `api/.env`:**

```env
NETWORK=testnet
CONTRACT_ID=<paste-contract-id-from-step-2>
PORT=3001
```

**Create `frontend/.env.local`:**

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CONTRACT_ID=<paste-contract-id-from-step-2>
NEXT_PUBLIC_NETWORK=testnet
```

## Step 4: Run Services

**Terminal 1 — API:**

```bash
cd api
npm install
npm run dev
```

You should see:

```
Lifemarq API running on http://localhost:3001
Network: testnet
Contract ID: CAAAA...
```

**Terminal 2 — Frontend:**

```bash
cd frontend
npm install
npm run dev
```

You should see:

```
▲ Next.js 14.0.0
- Local: http://localhost:3000
```

## Step 5: Test the Flow

### Register a Donor

1. Open http://localhost:3000/donor
2. Click **"Connect Freighter Wallet"**
3. Approve in Freighter extension
4. Enter national ID: `KE123456789`
5. Select organs: **Kidney** and **Liver**
6. Click **"Register & Sign with Freighter"**
7. Approve transaction in Freighter
8. See success message with **hashed ID**

### Download QR Donor Card

1. On the success screen, you'll see a **QR code**
2. Click **"Download Donor Card (PNG)"**
3. Print and carry it

### Query as Hospital

1. Open http://localhost:3000/hospital
2. Copy the **hashed ID** from donor success screen
3. Paste into hospital portal
4. Click **"Query Consent Status"**
5. See **✓ Consent Active** with organs listed

### Check Public Status Page

1. Open http://localhost:3000/status/[paste-hash-here]
2. See public consent verification page

### Revoke Consent

1. Return to http://localhost:3000/donor
2. Connect wallet again
3. Enter same national ID
4. Click **"Revoke Consent"**
5. Approve revocation in Freighter
6. Query hospital portal again
7. See **"No Active Consent Found"**

## Next Steps

### Run Tests

```bash
# Contract tests
cd contract && cargo test

# API tests
cd api && npm test
```

### Deploy to Testnet

```bash
# API
cd api && npm run build && vercel deploy

# Frontend
cd frontend && npm run build && vercel deploy
```

### Deploy to Mainnet

See [`docs/deployment.md`](docs/deployment.md) for full production deployment guide.

## Troubleshooting

### "Freighter not found"

Install Freighter: https://freighter.app

### "Connection refused on port 3001"

API not running. Check Terminal 1:

```bash
cd api && npm run dev
```

### "Contract not found"

Invalid CONTRACT_ID in environment. Check Step 3.

### "Transaction failed"

- Ensure testnet account is funded: `soroban config identity fund testnet-account --network testnet`
- Wait 10 seconds after deployment before testing

### "CORS error"

Frontend can't reach API. Verify `NEXT_PUBLIC_API_URL=http://localhost:3001` in `frontend/.env.local`

## What Happened

1. **Contract** — Soroban smart contract on Stellar testnet stores consent records
2. **API** — Node.js API at port 3001 queries the contract for hospitals
3. **Frontend** — Next.js portal at port 3000 handles donor registration and queries
4. **Freighter** — Signs all transactions with your wallet (private key never leaves browser)
5. **QR Code** — Encodes consent hash for emergency hospital access

## Architecture

```
Donor Browser                 Lifemarq API              Soroban Contract
    │                             │                          │
    │──Register (hash ID)────────▶│                          │
    │                             │──register()──────────────▶│
    │                             │                          │
    │◀─Success────────────────────│◀─Stored on-chain─────────│
    │                             │                          │
    │ [Print QR Code]             │                          │
    │                             │                          │
                    Hospital        │
                       │            │
                       │──Query────▶│
                       │◀─Result────│
```

## Support

- **Docs**: [`docs/architecture.md`](docs/architecture.md)
- **Issues**: Open GitHub issue
- **Security**: See [`SECURITY.md`](SECURITY.md)

---

**You now have a working organ donor registry on Stellar!**
