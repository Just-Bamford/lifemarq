# Lifemarq Definition of Done

Clear, measurable criteria for completing each phase.

## Phase 1: Smart Contract

### Criteria

✅ **Contract compiles without errors**

```bash
cd contract
cargo build --target wasm32-unknown-unknown --release
# Output: target/wasm32-unknown-unknown/release/lifemarq_contract.wasm
```

✅ **Contract deploys to Stellar Testnet**

```bash
soroban contract deploy \
  --network testnet \
  --source testnet-account \
  target/wasm32-unknown-unknown/release/lifemarq_contract.wasm
# Output: Contract ID: CAAAA...
```

✅ **Query function returns a result**

```bash
soroban contract invoke \
  --network testnet \
  --id CAAAA... \
  --source testnet-account \
  -- query \
  --donor_id_hash "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7"
# Output: false (or true if record exists)
```

✅ **All contract tests pass**

```bash
cd contract
cargo test
# Output: test result: ok. X passed; 0 failed; 0 ignored
```

✅ **Contract ID saved**

- Contract ID documented
- Saved to `api/.env` as `CONTRACT_ID`
- Saved to `frontend/.env.local` as `NEXT_PUBLIC_CONTRACT_ID`

### Verification Checklist

- [ ] `cargo build` succeeds
- [ ] `soroban contract deploy` returns Contract ID
- [ ] `soroban contract invoke --fn query` returns boolean
- [ ] `cargo test` passes all tests
- [ ] Contract ID is saved and accessible
- [ ] No compilation warnings

### Rollback Plan

If Phase 1 fails:

1. Check Rust toolchain: `rustup update`
2. Check Soroban CLI: `soroban --version`
3. Verify testnet account has XLM: `soroban config identity balance testnet-account`
4. Review contract code for errors: `cargo check`

---

## Phase 2: Hospital API

### Criteria

✅ **API starts without errors**

```bash
cd api
npm install
npm run dev
# Output: Lifemarq API running on http://localhost:3001
# Network: testnet
# Contract ID: CAAAA...
```

✅ **Health endpoint returns 200**

```bash
curl http://localhost:3001/health
# Output: {"status":"ok","network":"testnet","contractId":"CAAAA...","timestamp":"..."}
```

✅ **Consent query endpoint returns valid JSON**

```bash
curl http://localhost:3001/consent/a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7
# Output: {"id_hash":"a3f8...","consent_active":false,"organs":[],"queried_at":"..."}
```

✅ **Response reflects on-chain state**

- Query returns `consent_active: false` for unregistered hash
- Query returns `consent_active: true` after registration
- Query returns correct organs list
- Query returns correct timestamp

✅ **All API tests pass**

```bash
cd api
npm test
# Output: PASS  src/__tests__/index.test.ts
# PASS  src/__tests__/stellar-client.test.ts
# Tests: X passed, 0 failed
```

✅ **Error handling works**

- Invalid hash returns 400
- Network error returns 503
- Unknown endpoint returns 404

### Verification Checklist

- [ ] `npm run dev` starts without errors
- [ ] `curl /health` returns 200
- [ ] `curl /consent/:hash` returns valid JSON
- [ ] Response shape matches spec
- [ ] `npm test` passes all tests
- [ ] Error handling verified
- [ ] No console errors

### Rollback Plan

If Phase 2 fails:

1. Check Node.js version: `node --version` (should be 18+)
2. Check dependencies: `npm install`
3. Check environment: `cat api/.env`
4. Check contract ID: `echo $CONTRACT_ID`
5. Review API logs for errors

---

## Phase 3: Frontend

### Criteria

✅ **Frontend builds without errors**

```bash
cd frontend
npm install
npm run build
# Output: ✓ compiled successfully
```

✅ **Frontend starts in development**

```bash
cd frontend
npm run dev
# Output: ▲ Next.js 14.0.0
# - Local: http://localhost:3000
```

✅ **Donor can register through browser**

1. Open http://localhost:3000/donor
2. Click "Connect Freighter Wallet"
3. Approve connection in Freighter
4. Enter national ID (e.g., "KE123456789")
5. Select organs
6. Click "Register & Sign with Freighter"
7. Approve transaction in Freighter
8. See success message with hashed ID

✅ **Hospital page immediately reflects registration**

1. Open http://localhost:3000/hospital
2. Enter the hashed ID from donor registration
3. Click "Query Consent Status"
4. See "Consent Active" with organs listed

✅ **All frontend tests pass** (when implemented)

```bash
cd frontend
npm test
# Output: PASS  src/__tests__/wallet.test.ts
# Tests: X passed, 0 failed
```

### Verification Checklist

- [ ] `npm run build` succeeds
- [ ] `npm run dev` starts without errors
- [ ] Freighter wallet connects
- [ ] Donor registration completes
- [ ] Transaction signs with Freighter
- [ ] Success message displays
- [ ] Hospital query shows registration
- [ ] No console errors
- [ ] No TypeScript errors

### Rollback Plan

If Phase 3 fails:

1. Check Freighter: Is it installed and connected to testnet?
2. Check environment: `cat frontend/.env.local`
3. Check API: Is it running on the configured URL?
4. Check contract ID: Does it match Phase 1?
5. Review browser console for errors

---

## Phase 4: Tests

### Criteria

✅ **All contract tests pass**

```bash
cd contract
cargo test
# Output: test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured
```

✅ **All API tests pass**

```bash
cd api
npm test
# Output: PASS  src/__tests__/index.test.ts
# PASS  src/__tests__/stellar-client.test.ts
# Tests: 12 passed, 0 failed, 0 skipped
```

✅ **No skipped tests**

- No `.skip` in test files
- No `.todo` in test files
- All tests execute

✅ **Code coverage meets targets**

- Contract: 100% coverage
- API: 80%+ coverage
- Frontend: 70%+ coverage (when implemented)

✅ **All tests are deterministic**

- Tests pass consistently
- No flaky tests
- No timing-dependent tests

### Verification Checklist

- [ ] `cargo test` passes all tests
- [ ] `npm test` passes all tests
- [ ] No skipped tests
- [ ] No pending tests
- [ ] Coverage meets targets
- [ ] Tests run consistently
- [ ] No console warnings

### Rollback Plan

If Phase 4 fails:

1. Run tests with verbose output: `cargo test -- --nocapture`
2. Run specific failing test: `npm test -- specific-test.ts`
3. Check for flaky tests: Run tests multiple times
4. Review test mocks: Are they set up correctly?
5. Check for timing issues: Add delays if needed

---

## End-to-End Verification

After all phases are complete, verify the full flow:

### 1. Contract is deployed

```bash
soroban contract invoke --network testnet --id CAAAA... -- query --donor_id_hash "hash"
# Returns: false
```

### 2. API is running

```bash
curl http://localhost:3001/health
# Returns: {"status":"ok",...}
```

### 3. Frontend is running

```bash
curl http://localhost:3000
# Returns: HTML page
```

### 4. Full registration flow works

1. Donor registers via frontend
2. Transaction submitted to testnet
3. Hospital queries API
4. API queries contract
5. Result reflects registration

### 5. All tests pass

```bash
cd contract && cargo test && cd ../api && npm test
# All tests pass
```

---

## Sign-Off Checklist

- [ ] Phase 1: Contract deployed and tested
- [ ] Phase 2: API running and tested
- [ ] Phase 3: Frontend working end-to-end
- [ ] Phase 4: All tests passing
- [ ] Environment variables configured
- [ ] Code follows standards
- [ ] Documentation complete
- [ ] Ready for production deployment

---

## Production Readiness

Before deploying to mainnet:

- [ ] Contract audited by security firm
- [ ] All tests passing on mainnet testnet
- [ ] Load testing completed
- [ ] Error handling verified
- [ ] Monitoring configured
- [ ] Backup and recovery plan in place
- [ ] Incident response plan documented
- [ ] Team trained on operations

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Code reviewed
- [ ] Environment variables set
- [ ] Backups created
- [ ] Monitoring enabled

### Deployment

- [ ] Contract deployed to mainnet
- [ ] API deployed to production
- [ ] Frontend deployed to production
- [ ] DNS configured
- [ ] SSL certificates valid

### Post-Deployment

- [ ] Health checks passing
- [ ] Monitoring alerts working
- [ ] Logs being collected
- [ ] Users can register
- [ ] Hospitals can query
- [ ] No errors in logs

---

## Rollback Procedure

If production deployment fails:

1. **Immediate**: Stop accepting new registrations
2. **Within 5 minutes**: Revert to previous version
3. **Within 15 minutes**: Verify system is stable
4. **Within 1 hour**: Notify users and hospitals
5. **Within 24 hours**: Root cause analysis
6. **Within 48 hours**: Fix and redeploy

---

## Success Metrics

After deployment:

- **Uptime**: 99.9%+ availability
- **Latency**: <100ms for queries
- **Throughput**: 1000+ queries/minute
- **Errors**: <0.1% error rate
- **Adoption**: 10,000+ donors in Year 1
- **Hospitals**: 50+ hospitals onboarded
