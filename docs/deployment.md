# Lifemarq Deployment Guide

Production-ready deployment procedures for testnet and mainnet.

## Prerequisites

- Rust toolchain (1.70+)
- Soroban CLI (latest)
- Node.js 18+
- Docker (for containerized deployment)
- Stellar account with testnet/mainnet XLM
- Freighter wallet (for testing)
- GitHub account for CI/CD

## Pre-Deployment Checklist

### Code Quality

- [ ] All tests passing: `npm test` (API), `cargo test` (Contract)
- [ ] No TypeScript errors: `npm run build` (Frontend)
- [ ] No console warnings in browser
- [ ] All environment variables configured
- [ ] No hardcoded secrets in code
- [ ] Documentation complete and accurate

### Security

- [ ] Contract code reviewed
- [ ] API endpoints secured with RBAC
- [ ] CORS properly configured for production domain
- [ ] Rate limiting enabled on API
- [ ] Sensitive data not logged (PII, private keys)
- [ ] HTTPS enforced in production
- [ ] API key rotation strategy documented

### Infrastructure

- [ ] Monitoring and alerting configured
- [ ] Log aggregation set up
- [ ] Backup strategy documented
- [ ] Disaster recovery plan tested
- [ ] Incident response procedures documented
- [ ] Team trained on runbooks

## Testnet Deployment

### Step 1: Build Smart Contract

```bash
cd contract
cargo build --target wasm32-unknown-unknown --release
```

**Output:** `target/wasm32-unknown-unknown/release/lifemarq_contract.wasm`

Verify the WASM file is created:

```bash
ls -lh target/wasm32-unknown-unknown/release/lifemarq_contract.wasm
# -rw-r--r--  1 user  staff  120K lifemarq_contract.wasm
```

### Step 2: Create or Fund Stellar Account

Create a new testnet account:

```bash
soroban config identity generate --global testnet-account --network testnet
```

Fund it with testnet XLM:

```bash
soroban config identity fund testnet-account --network testnet
```

Verify funding:

```bash
soroban config identity balance testnet-account --network testnet
# Balance: 10000 XLM
```

### Step 3: Deploy Contract to Testnet

```bash
NETWORK=testnet
CONTRACT_ID=$(soroban contract deploy \
  --network $NETWORK \
  --source testnet-account \
  target/wasm32-unknown-unknown/release/lifemarq_contract.wasm)

echo "Contract ID: $CONTRACT_ID"
# Output: Contract ID: CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4
```

Save the Contract ID:

```bash
# Save to .env files
echo "CONTRACT_ID=$CONTRACT_ID" > api/.env
echo "NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID" >> frontend/.env.local
```

### Step 4: Configure API

Create `api/.env`:

```env
# Stellar Configuration
NETWORK=testnet
CONTRACT_ID=<contract-id-from-step-3>
PORT=3001

# RBAC Configuration (optional for MVP)
ENABLE_PROVIDER_AUTH=false

# Logging
LOG_LEVEL=info
```

### Step 5: Configure Frontend

Create `frontend/.env.local`:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001

# Stellar Configuration
NEXT_PUBLIC_CONTRACT_ID=<contract-id-from-step-3>
NEXT_PUBLIC_NETWORK=testnet
```

### Step 6: Run Services

**Terminal 1 - API:**

```bash
cd api
npm install
npm run dev
# Output: Lifemarq API running on http://localhost:3001
# Network: testnet
# Contract ID: CAAAA...
```

**Terminal 2 - Frontend:**

```bash
cd frontend
npm install
npm run dev
# Output: ▲ Next.js 14.0.0
# - Local: http://localhost:3000
```

### Step 7: Test Full Flow

#### Register Donor

1. Open http://localhost:3000/donor
2. Click "Connect Freighter Wallet"
3. Approve in Freighter
4. Enter national ID: "KE123456789"
5. Select organs: kidney, liver
6. Click "Register & Sign with Freighter"
7. Approve transaction in Freighter
8. Verify success message with hashed ID

#### Query Consent

1. Open http://localhost:3000/hospital
2. Copy hashed ID from donor success message
3. Paste into hospital portal
4. Click "Query Consent Status"
5. Verify "Consent Active" with organs listed

#### Test Revocation

1. Return to http://localhost:3000/donor
2. Enter same national ID
3. Click "Revoke Consent"
4. Approve in Freighter
5. Verify revocation success
6. Return to hospital portal
7. Query same hash
8. Verify "No Active Consent"

### Step 8: Run Integration Tests

```bash
cd api
npm test -- integration.test.ts

# Expected output:
# PASS  src/__tests__/integration.test.ts
#   Lifemarq Integration Tests
#     Full Donor Registration Flow
#       ✓ should complete full donor registration → query → verification workflow
#       ✓ should handle unknown donor (not yet registered)
#       ✓ should validate hash format in all endpoints
#     Transaction Confirmation Tracking
#       ✓ should track submission through confirmation
#       ✓ should return 404 for unknown transaction
#       ✓ should track multiple submissions independently
#     ...
#   Tests: 20 passed, 0 failed
```

## Mainnet Deployment

### Step 1: Prepare for Production

**Code Review:**

```bash
# Review all recent commits
git log --oneline -20

# Check for any hardcoded values
grep -r "testnet" src/
grep -r "localhost" src/
```

**Security Audit:**

- [ ] Contract code reviewed by security team
- [ ] API endpoints tested with security scanner
- [ ] Database connections encrypted
- [ ] All secrets in environment variables (not code)

### Step 2: Build for Production

```bash
cd contract
cargo build --target wasm32-unknown-unknown --release --profile release

# Verify binary size (should be < 256KB)
ls -lh target/wasm32-unknown-unknown/release/lifemarq_contract.wasm
```

### Step 3: Create Mainnet Account

Create mainnet account with real XLM:

```bash
soroban config identity generate --global mainnet-account --network public
```

Fund with sufficient XLM (at least 5 XLM for contract deployment + operations):

```bash
# Transfer XLM from exchange or existing account
soroban config identity balance mainnet-account --network public
```

### Step 4: Deploy Contract to Mainnet

```bash
NETWORK=public
CONTRACT_ID=$(soroban contract deploy \
  --network $NETWORK \
  --source mainnet-account \
  target/wasm32-unknown-unknown/release/lifemarq_contract.wasm)

echo "Mainnet Contract ID: $CONTRACT_ID"
```

Save the mainnet Contract ID for records and monitoring.

### Step 5: Update Production Configuration

**Create `api/.env.production`:**

```env
# Stellar Configuration
NETWORK=public
CONTRACT_ID=<mainnet-contract-id>
PORT=3001

# Security
ENABLE_PROVIDER_AUTH=true
API_KEY_ROTATION_DAYS=90

# Monitoring
LOG_LEVEL=warn
SENTRY_DSN=<sentry-dsn>
DATADOG_API_KEY=<datadog-key>

# Rate Limiting
RATE_LIMIT_REQUESTS=1000
RATE_LIMIT_WINDOW_MS=60000
```

**Create `frontend/.env.production`:**

```env
# API Configuration
NEXT_PUBLIC_API_URL=https://api.lifemarq.org

# Stellar Configuration
NEXT_PUBLIC_CONTRACT_ID=<mainnet-contract-id>
NEXT_PUBLIC_NETWORK=public

# Analytics
NEXT_PUBLIC_ANALYTICS_ID=<analytics-id>
```

### Step 6: Build & Deploy Services

**API:**

```bash
cd api
npm run build
npm start
# Monitor startup: npm run dev (with --inspect for debugging)
```

**Frontend:**

```bash
cd frontend
npm run build
# Output: ✓ created 42 pages in 12.5s
# Deploy to Vercel: vercel deploy --prod
```

### Step 7: Verify Mainnet Deployment

**Health Check:**

```bash
curl https://api.lifemarq.org/health
# Expected: {"status":"ok","network":"public","contractId":"CAAAA...","timestamp":"..."}
```

**Test Registration:**

1. Go to https://lifemarq.org/donor
2. Complete registration flow
3. Verify transaction on Stellar blockchain
4. Query via hospital portal
5. Verify result

**Monitor Logs:**

```bash
# Check application logs
journalctl -u lifemarq-api -f

# Check error logs
tail -f /var/log/lifemarq/error.log

# Monitor performance
curl https://api.lifemarq.org/stats/submissions
```

## Monitoring & Operations

### Health Monitoring

```bash
# Monitor contract state
soroban contract events \
  --network public \
  --id <mainnet-contract-id>

# Monitor API
watch -n 5 'curl https://api.lifemarq.org/health'

# Monitor registrations
curl https://api.lifemarq.org/stats/submissions
```

### Performance Monitoring

- Track query latency: `GET /audit/queries`
- Track verification metrics: `GET /verify/stats`
- Monitor error rates: Log aggregation dashboard
- Monitor Stellar RPC usage: Check rate limits

### Backup & Recovery

**Daily Backup:**

```bash
# Backup audit logs
mysqldump lifemarq_audit > backups/audit_$(date +%Y%m%d).sql

# Backup configuration
cp api/.env backups/api_env_$(date +%Y%m%d).backup
```

**Disaster Recovery:**

If mainnet contract corrupts:

1. Deploy new contract with same logic
2. Migrate consent records to new contract (if applicable)
3. Update API configuration
4. Update frontend configuration
5. Test full flow on new contract
6. Announce switch to hospitals/donors

## Troubleshooting

### Contract Deployment Fails

**Error:** "Account not found"

```bash
# Solution: Fund account first
soroban config identity balance mainnet-account
# If 0 XLM: Send XLM to account address
```

**Error:** "Invalid WASM"

```bash
# Solution: Verify build
cargo check --target wasm32-unknown-unknown
file target/wasm32-unknown-unknown/release/lifemarq_contract.wasm
```

### API Won't Connect to Contract

**Error:** "Failed to query consent record"

```bash
# Verify configuration
cat api/.env | grep CONTRACT_ID

# Test contract directly
soroban contract invoke \
  --network public \
  --id <contract-id> \
  --source mainnet-account \
  -- query \
  --donor_id_hash "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7"
```

### Frontend Can't Query API

**Error:** "CORS error"

```bash
# Check API CORS configuration
curl -H "Origin: https://lifemarq.org" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS https://api.lifemarq.org/health -v
```

### Database Connection Issues

**Error:** "Connection timeout"

```bash
# Check database status
psql -h localhost -U lifemarq -d lifemarq_prod -c "SELECT 1"

# Check connection pool
curl https://api.lifemarq.org/health
```

## Rollback Procedure

If production deployment fails:

### Immediate (< 5 minutes)

1. Stop accepting new registrations
2. Set maintenance page on frontend
3. Disable hospital queries endpoint

```bash
systemctl stop lifemarq-api
systemctl stop lifemarq-frontend
```

### Short-term (5-30 minutes)

1. Restore previous API version
2. Restore previous frontend version
3. Verify health checks
4. Resume operations

```bash
# Rollback API
git checkout <previous-tag>
npm install && npm run build
systemctl start lifemarq-api

# Rollback Frontend
npm run build && vercel deploy --prod <previous-sha>
```

### Analysis (> 1 hour)

1. Identify root cause
2. Log incident details
3. Plan fix
4. Redeploy when ready

### Communication

- Notify hospitals of issue
- Provide status updates every 15 minutes
- Announce resolution

## Security Checklist

### Before Every Deployment

- [ ] All tests passing
- [ ] Code review complete
- [ ] No secrets in logs
- [ ] API key rotation current
- [ ] SSL certificates valid
- [ ] Rate limiting enabled
- [ ] Error messages don't leak info

### Ongoing

- [ ] Monitor for suspicious activity
- [ ] Review audit logs weekly
- [ ] Update dependencies monthly
- [ ] Test disaster recovery quarterly
- [ ] Security audit annually

## Support & Escalation

For deployment issues:

1. Check logs: `journalctl -u lifemarq-api -f`
2. Check health: `curl https://api.lifemarq.org/health`
3. Verify configuration: `env | grep LIFEMARQ`
4. Contact on-call engineer
5. Escalate to security team if data compromise suspected

---

**Last Updated:** Phase 6 - Ready for Production Deployment
