# Lifemarq Environment Configuration

Complete environment setup for all three components.

## API Configuration

**File:** `api/.env`

```env
# Stellar Configuration
CONTRACT_ID=CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK=testnet

# API Configuration
PORT=3001

# Optional: Hospital Provider Authentication
ENABLE_PROVIDER_AUTH=false
```

### Environment Variables

| Variable               | Required | Default   | Description                                 |
| ---------------------- | -------- | --------- | ------------------------------------------- |
| `CONTRACT_ID`          | Yes      | —         | Deployed Soroban contract ID (from Phase 1) |
| `STELLAR_RPC_URL`      | Yes      | —         | Soroban RPC endpoint URL                    |
| `STELLAR_NETWORK`      | Yes      | `testnet` | Network name (testnet or public)            |
| `PORT`                 | No       | `3001`    | API server port                             |
| `ENABLE_PROVIDER_AUTH` | No       | `false`   | Enable hospital provider API key auth       |

### Getting CONTRACT_ID

After deploying the contract in Phase 1:

```bash
cd contract
cargo build --target wasm32-unknown-unknown --release

soroban contract deploy \
  --network testnet \
  --source testnet-account \
  target/wasm32-unknown-unknown/release/lifemarq_contract.wasm
```

The output will show:

```
Contract ID: CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4
```

Copy this ID to `api/.env` and `frontend/.env.local`.

## Frontend Configuration

**File:** `frontend/.env.local`

```env
# Stellar Configuration
NEXT_PUBLIC_CONTRACT_ID=CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4
NEXT_PUBLIC_STELLAR_NETWORK=testnet

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Environment Variables

| Variable                      | Required | Default   | Description                                |
| ----------------------------- | -------- | --------- | ------------------------------------------ |
| `NEXT_PUBLIC_CONTRACT_ID`     | Yes      | —         | Deployed Soroban contract ID (same as API) |
| `NEXT_PUBLIC_STELLAR_NETWORK` | Yes      | `testnet` | Network name (testnet or public)           |
| `NEXT_PUBLIC_API_URL`         | Yes      | —         | Hospital API URL                           |

### Important Notes

- All `NEXT_PUBLIC_*` variables are exposed to the browser
- Never put secrets in `NEXT_PUBLIC_*` variables
- Use `.env.local` for local development (not committed to git)
- Use `.env.production` for production builds

## Development Setup

### 1. Deploy Contract

```bash
cd contract
cargo build --target wasm32-unknown-unknown --release
soroban contract deploy --network testnet --source testnet-account \
  target/wasm32-unknown-unknown/release/lifemarq_contract.wasm
```

Save the Contract ID.

### 2. Configure API

```bash
cd api
cp .env.example .env
# Edit .env and set CONTRACT_ID
```

### 3. Configure Frontend

```bash
cd frontend
cp .env.local.example .env.local
# Edit .env.local and set CONTRACT_ID and API_URL
```

### 4. Run Services

**Terminal 1 — API:**

```bash
cd api
npm install
npm run dev
```

**Terminal 2 — Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## Production Setup

### 1. Deploy Contract to Mainnet

```bash
cd contract
cargo build --target wasm32-unknown-unknown --release

soroban contract deploy \
  --network public \
  --source mainnet-account \
  target/wasm32-unknown-unknown/release/lifemarq_contract.wasm
```

### 2. Configure API for Production

Create `api/.env.production`:

```env
CONTRACT_ID=<mainnet-contract-id>
STELLAR_RPC_URL=https://soroban.stellar.org
STELLAR_NETWORK=public
PORT=3001
ENABLE_PROVIDER_AUTH=true
```

### 3. Configure Frontend for Production

Create `frontend/.env.production`:

```env
NEXT_PUBLIC_CONTRACT_ID=<mainnet-contract-id>
NEXT_PUBLIC_STELLAR_NETWORK=public
NEXT_PUBLIC_API_URL=https://api.lifemarq.org
```

### 4. Deploy Services

**API:**

```bash
cd api
npm run build
npm start
```

**Frontend:**

```bash
cd frontend
npm run build
npm start
```

## Environment Validation

### API Startup Check

The API will log configuration on startup:

```
Lifemarq API running on http://localhost:3001
Network: testnet
Contract ID: CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4
```

If CONTRACT_ID is missing:

```
ERROR: CONTRACT_ID environment variable not set
```

### Frontend Build Check

The frontend will fail to build if required env vars are missing:

```
Error: NEXT_PUBLIC_CONTRACT_ID is not set
```

## Troubleshooting

### "CONTRACT_ID not configured"

**Solution:** Set `CONTRACT_ID` in `api/.env` and `NEXT_PUBLIC_CONTRACT_ID` in `frontend/.env.local`

### "API connection failed"

**Solution:** Verify `NEXT_PUBLIC_API_URL` matches the API server address

### "Contract not found"

**Solution:** Verify `CONTRACT_ID` is correct and contract is deployed to the specified network

### "Network mismatch"

**Solution:** Ensure `STELLAR_NETWORK` and `NEXT_PUBLIC_STELLAR_NETWORK` match (both testnet or both public)

## Security Best Practices

1. **Never commit .env files** — Add to .gitignore
2. **Use .env.example** — Template for required variables
3. **Rotate secrets regularly** — If using API keys
4. **Use HTTPS in production** — All endpoints must be HTTPS
5. **Validate all inputs** — Never trust user input
6. **Log securely** — Never log PII or secrets

## Environment Files Checklist

- [ ] `api/.env` created with CONTRACT_ID
- [ ] `frontend/.env.local` created with CONTRACT_ID and API_URL
- [ ] Both files added to `.gitignore`
- [ ] `.env.example` files committed to git
- [ ] Production `.env` files created separately
- [ ] All required variables set
- [ ] API starts without errors
- [ ] Frontend builds without errors
