# Lifemarq Deployment Guide

## Prerequisites

- Rust toolchain (1.70+)
- Soroban CLI
- Node.js 18+
- Stellar account with testnet XLM
- Freighter wallet (for testing)

## Installation

### 1. Install Soroban CLI

```bash
cargo install soroban-cli
```

### 2. Install Rust WASM target

```bash
rustup target add wasm32-unknown-unknown
```

### 3. Clone and setup project

```bash
git clone <repo>
cd lifemarq
npm install
```

## Testnet Deployment

### Step 1: Build Smart Contract

```bash
cd contract
cargo build --target wasm32-unknown-unknown --release
```

Output: `target/wasm32-unknown-unknown/release/lifemarq_contract.wasm`

### Step 2: Create Stellar Account

If you don't have a testnet account:

```bash
soroban config identity generate --global testnet-account
soroban config identity fund testnet-account --network testnet
```

### Step 3: Deploy Contract

```bash
soroban contract deploy \
  --network testnet \
  --source testnet-account \
  target/wasm32-unknown-unknown/release/lifemarq_contract.wasm
```

**Output:**

```
Contract ID: CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4
```

Save this Contract ID for later use.

### Step 4: Configure Frontend

Create `.env.local` in `frontend/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CONTRACT_ID=CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4
NEXT_PUBLIC_NETWORK=testnet
```

### Step 5: Configure API

Create `.env` in `api/`:

```env
NETWORK=testnet
CONTRACT_ID=CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4
PORT=3001
```

### Step 6: Run Services

**Terminal 1 - Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

**Terminal 2 - API:**

```bash
cd api
npm install
npm run dev
```

API running on http://localhost:3001

## Testing on Testnet

### 1. Register a Donor

1. Go to http://localhost:3000/donor
2. Enter a test national ID (e.g., "KE123456789")
3. Select organs
4. Click "Register & Sign with Freighter"
5. Approve transaction in Freighter

### 2. Query Consent

1. Go to http://localhost:3000/hospital
2. Enter the hashed ID (from donor registration)
3. Click "Query Consent Status"
4. Verify result

### 3. Test Revocation

1. Go to http://localhost:3000/donor
2. Enter same national ID
3. Click "Revoke Consent"
4. Verify consent is now inactive

## Mainnet Deployment

### Prerequisites

- Mainnet XLM in account
- Contract audited and tested
- Production domain configured

### Step 1: Build for Production

```bash
cd contract
cargo build --target wasm32-unknown-unknown --release --profile release
```

### Step 2: Deploy to Mainnet

```bash
soroban contract deploy \
  --network public \
  --source mainnet-account \
  target/wasm32-unknown-unknown/release/lifemarq_contract.wasm
```

### Step 3: Update Configuration

Update environment variables for production:

**Frontend (.env.production):**

```env
NEXT_PUBLIC_API_URL=https://api.lifemarq.org
NEXT_PUBLIC_CONTRACT_ID=<mainnet-contract-id>
NEXT_PUBLIC_NETWORK=public
```

**API (.env):**

```env
NETWORK=public
CONTRACT_ID=<mainnet-contract-id>
PORT=3001
```

### Step 4: Deploy Services

**Frontend:**

```bash
npm run build
# Deploy to Vercel, Netlify, or your hosting
```

**API:**

```bash
npm run build
# Deploy to AWS, Heroku, or your server
```

## Monitoring & Maintenance

### Check Contract State

```bash
soroban contract invoke \
  --network testnet \
  --id <contract-id> \
  --source testnet-account \
  -- query \
  --donor_id_hash <hash>
```

### View Events

```bash
soroban contract events \
  --network testnet \
  --id <contract-id>
```

### Monitor API

```bash
curl http://localhost:3001/health
```

## Troubleshooting

### Contract Deployment Fails

**Error:** "Account not found"

- Solution: Fund account with testnet XLM

**Error:** "Invalid WASM"

- Solution: Ensure Rust target is installed: `rustup target add wasm32-unknown-unknown`

### Frontend Can't Connect to Contract

**Error:** "Contract not found"

- Solution: Verify CONTRACT_ID in .env.local matches deployed contract

### API Query Returns Error

**Error:** "Failed to query consent record"

- Solution: Check CONTRACT_ID and NETWORK in .env

## Rollback Procedure

If issues occur on mainnet:

1. **Pause API**: Stop accepting new queries
2. **Notify Users**: Inform hospitals of temporary unavailability
3. **Investigate**: Check contract state and events
4. **Deploy Patch**: If contract bug found, deploy new version
5. **Migrate Data**: If needed, migrate consent records to new contract

## Security Checklist

- [ ] Contract audited by security firm
- [ ] All environment variables use secrets management
- [ ] API has rate limiting enabled
- [ ] CORS properly configured
- [ ] HTTPS enforced on all endpoints
- [ ] Monitoring and alerting configured
- [ ] Backup and disaster recovery plan in place
- [ ] Incident response plan documented

## Support

For deployment issues:

1. Check logs: `npm run dev` shows detailed errors
2. Verify configuration: Double-check .env files
3. Test locally first: Always test on testnet before mainnet
4. Contact support: [support@lifemarq.org]
