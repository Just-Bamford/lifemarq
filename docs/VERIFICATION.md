# Hospital Access Control Verification

This document verifies that the hospital registry access control is working correctly.

## Definition of Done

- [x] `cargo test` passes (contract library compiles)
- [x] `npm test` passes (all 12 API tests pass)
- [x] Contract implements `is_hospital_verified()` function
- [x] Contract implements `query_verified_only()` that checks hospital verification
- [x] API implements hospital registration with pending/approved states
- [x] API implements admin approval/revoke endpoints
- [x] Frontend implements hospital onboarding form
- [ ] Manual verification: Unverified wallet gets rejected when querying
- [ ] Manual verification: Verified hospital gets real consent response

## Test Results

### Contract Tests (Rust)

```
test_register_hospital_succeeds_with_valid_inputs ✓
test_register_hospital_fails_on_duplicate ✓
test_is_verified_returns_false_before_approval ✓
test_is_verified_returns_true_after_approval ✓
test_is_verified_returns_false_after_revocation ✓
test_query_returns_unauthorized_for_unverified_hospital ✓
```

### API Tests (Node.js + Jest)

```
POST /hospitals/register
  ✓ should return 201 with pending status when given valid inputs
  ✓ should return 400 when required fields are missing
  ✓ should return 400 when wallet format is invalid

GET /hospitals/pending
  ✓ should return 401 when authorization header is missing
  ✓ should return 401 when API key is invalid
  ✓ should return 200 with pending hospitals list when authorized

POST /hospitals/:id/approve
  ✓ should return 401 when authorization header is missing
  ✓ should return 200 with approved status when authorized

POST /hospitals/:id/revoke
  ✓ should return 401 when authorization header is missing
  ✓ should return 200 with revoked status when authorized

GET /hospitals/:id
  ✓ should return 200 with hospital record

GET /hospitals/:id/verified
  ✓ should return 200 with verification status

Total: 12 tests passing
```

## Architecture Verification

### Contract Layer

The contract implements on-chain access control:

1. **HospitalRecord struct** — Stores hospital_id, wallet, name, country, license_number, is_verified, and timestamps
2. **register_hospital()** — Registers a hospital with is_verified = false (pending)
3. **approve_hospital()** — Admin function sets is_verified = true
4. **revoke_hospital()** — Admin function sets is_verified = false
5. **is_hospital_verified()** — Returns verification status
6. **query_verified_only()** — Calls is_hospital_verified() before returning consent data

### API Layer

REST endpoints for hospital management:

- POST `/hospitals/register` — Submit registration (public)
- GET `/hospitals/pending` — List pending hospitals (admin only, requires Bearer token)
- POST `/hospitals/:id/approve` — Approve hospital (admin only)
- POST `/hospitals/:id/revoke` — Revoke hospital (admin only)
- GET `/hospitals/:id` — Get hospital details
- GET `/hospitals/:id/verified` — Check verification status

### Frontend Layer

- `/hospital/register` — Hospital onboarding form with country dropdown
- Form submits to POST `/hospitals/register`
- Shows pending approval confirmation state

## Security Properties

- ✅ **Unverified hospitals cannot query donor records** — contract-enforced
- ✅ **Only admin can approve hospitals** — API key protection
- ✅ **Approval is on-chain** — immutable, auditable
- ✅ **Revocation is possible** — license revocation scenarios covered
- ✅ **No API key leakage** — Bearer token in header, not in URL
- ✅ **Hospital wallet identifies caller** — Stellar address as credential

## Access Control Flow

```
Donor Registration (any wallet)
        ↓
Donor ID hash + consent stored on-chain
        ↓
Hospital Registration (public API, pending status)
        ↓
Admin Approval (admin API key required, sets is_verified=true)
        ↓
Hospital Query (query_verified_only checks hospital_id against is_verified)
        ↓
Consent Returned (only if hospital is verified)
```

## Deployment Checklist

- [x] Contract compiles without errors
- [x] Contract tests pass for hospital registry
- [x] API tests pass for all hospital endpoints
- [x] API enforces admin authentication on sensitive endpoints
- [x] Frontend form submits to correct endpoint
- [x] Frontend shows pending approval state
- [x] README documentation complete
- [x] Code committed with appropriate messages

## Next Steps for Manual Testing (when deployed)

1. Deploy contract to testnet
2. Deploy API to hosting provider
3. Register a test hospital via `/hospitals/register`
4. Verify it appears in `/hospitals/pending` (with admin auth)
5. Approve it via `/hospitals/:id/approve` (with admin auth)
6. Register a test donor and get their ID hash
7. Query as unverified hospital — should get false
8. Verify hospital and query again — should get true (or organ list if full response)
9. Revoke hospital verification — should get false again
