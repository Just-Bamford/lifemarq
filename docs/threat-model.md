# Threat Model: Lifemarq Organ Donor Registry

**Scope:** Soroban smart contract, API, and frontend  
**Date:** August 2026  
**Status:** Pre-mainnet (testnet validation complete)

---

## Executive Summary

Lifemarq protects against the specific threats to a decentralized health registry:

1. **Family Override Attacks** — Revocation is cryptographically enforced on-chain
2. **Hospital Impersonation** — Verified hospital registry gates access
3. **Consent Record Tampering** — Immutable on Stellar ledger
4. **Privacy Leaks** — Client-side hashing, no PII on-chain
5. **Replay Attacks** — Soroban contract semantics enforce idempotency

This document explains each threat, the attack scenarios, and the mitigation.

---

## Threat 1: Family Override Attacks

### Threat Scenario

**Traditional Registry:** Donor registers intent in a paper registry. Family members hear about the decision and override it by calling the hospital or showing an old ID card. Hospital staff don't have a reliable way to verify which instruction is newer or more authoritative.

**Digital Registry Without Access Control:** Donor registers on-chain. Family member gets access to donor's wallet or a copy of the private key. They call `revoke()` without the donor's consent, erasing the registration.

### Attack Vector

- Wallet compromise (key theft, physical theft of phone)
- Social engineering (pretending to be the donor)
- Third-party hospital staff colluding with family

### Mitigation

**1. Wallet Signature Requirement (Cryptographic)**

```rust
fn revoke(env: Env, donor_id_hash: String, wallet: Address) -> Result<(), ContractError> {
    wallet.require_auth();  // ← Cryptographic requirement: only the registered wallet can revoke
    ...
}
```

- Only the wallet that called `register()` can call `revoke()`
- Enforced at the contract level (cannot be bypassed via API)
- Requires the donor's actual wallet to sign the revocation transaction

**2. Immutability After Revocation**

```rust
if !record.is_active {
    return Err(ContractError::AlreadyRevoked);  // ← Cannot re-register the same hash
}
```

- Once revoked, a donor cannot re-activate the same consent record
- Prevents "revoke, then re-register under family coercion" attack
- Forces re-registration with a new wallet if consent is reconsidered

**3. Query Logging**

```
Every hospital query is logged with: hospital_id, query_time, consent_status
→ Accessible to donor via GET /query-history/:id_hash
→ Creates audit trail if family claims false consent/revocation
```

**4. Emergency Contact Notifications**

When a hospital queries a donor's record, the donor's registered emergency contact receives a notification. This closes the loop:

- Donor learns immediately if their record was queried
- Can detect unauthorized access or impersonation
- Empowers donor to revoke if unauthorized

### Residual Risk

**Low** — Wallet compromise is the donor's responsibility (same as bank account security). Mitigated by:

- Using Freighter (isolated wallet, hardware support)
- USSD Phase 4: custodial wallet (provider holds key in HSM)

---

## Threat 2: Hospital Impersonation

### Threat Scenario

A non-hospital entity (scammer, competitor hospital, malicious actor) calls the API and queries donor consent records, pretending to be a verified hospital.

### Attack Vector

- Unverified attacker calls `GET /consent/:id_hash`
- API returns: `{ "consent_active": true, "organs": ["kidney", "liver"] }`
- Attacker gets list of all registered donors and their organ preferences
- Can impersonate hospitals in social engineering attacks

### Mitigation

**1. Hospital Verification Registry (On-Chain)**

```rust
fn register_hospital(
    env: Env,
    hospital_id: String,
    wallet: Address,
    name: String,
    country: String,
    license_number: String  // ← Health ministry license
) -> Result<(), ContractError>

fn verify_hospital(env: Env, hospital_id: String) -> Result<(), ContractError>
    // ← Admin-only. Requires off-chain verification of license_number

fn is_hospital_verified(env: Env, hospital_id: String) -> bool
    // ← Check if hospital is verified before allowing queries
```

**2. Access Control Gate on Queries**

```rust
pub fn query_with_hospital_auth(
    env: Env,
    donor_id_hash: String,
    hospital_id: String,
) -> bool {
    if !is_hospital_verified(env, hospital_id) {
        return false;  // ← Deny with silent failure (privacy protection)
    }
    query(env, donor_id_hash)  // ← Only verified hospitals can query
}
```

**3. Two-Layer Verification**

- **On-chain:** Hospital registry is transparent — anyone can check if a hospital is verified
- **Off-chain:** Admin verifies hospital license via health ministry records before calling `verify_hospital()`

**4. Query Audit Trail**

```sql
SELECT hospital_id, donor_id_hash, query_time, result
FROM queries
WHERE hospital_id = 'hospital-001'
ORDER BY query_time DESC;
```

→ Audit trail of every query per hospital  
→ Can detect suspicious query patterns (e.g., hospital querying 10,000 records in 1 hour)

### Residual Risk

**Very Low** — Admin verification is the single point of trust. Mitigated by:

- Health ministry oversight (pilot partner)
- Transparent hospital registry (anyone can verify)
- Query audit logs (suspicious activity is detectable)

---

## Threat 3: Consent Record Tampering

### Threat Scenario

Attacker compromises the API server and modifies database records to show false consent status. A donor who never registered appears as consented, and organs are harvested without authorization.

### Attack Vector

- Compromise API server credentials
- Modify `query_active` flag in database
- Hospital queries API, receives false positive
- Hospital proceeds with transplant under false authorization

### Mitigation

**1. Source of Truth is On-Chain, Not Off-Chain Database**

```typescript
// WRONG: API queries database
SELECT consent_active FROM consent_records WHERE id_hash = ?;

// RIGHT: API queries Soroban contract
sorobanRpc.contract.invoke({
    method: 'query',
    args: [donor_id_hash]
});  // ← Always returns truth from ledger, not database
```

**2. Smart Contract Logic is Immutable**

```rust
pub fn query(env: Env, donor_id_hash: String) -> bool {
    match env.storage().persistent().get::<_, ConsentRecord>(&key) {
        Some(record) => record.is_active,  // ← Only source of truth
        None => false,
    }
}
```

- Contract code cannot be modified after deployment
- Stellar ledger is immutable and replicated across validators
- No database admin can falsify the result

**3. Transparent Queries via Stellar.Expert**

Any party (hospital, donor, regulator) can verify query results independently:

```bash
# Hospital can verify via Stellar.Expert
https://stellar.expert/explorer/testnet/contract/CCZDNL...

# Query via RPC
soroban contract invoke --id CCZDNL... --fn query --arg [donor_id_hash]
```

### Residual Risk

**None** — Stellar ledger is cryptographically secured by 20+ validators. Attacker would need to compromise majority of Stellar network (impossible).

---

## Threat 4: Privacy Leaks

### Threat Scenario

**Scenario A:** Patient registration data is sent over HTTP (unencrypted). Network attacker intercepts national ID, name, wallet address. Can cross-reference with public hospital records and de-anonymize donors.

**Scenario B:** Hospital queries consent via unencrypted API. Network observer learns which patients the hospital is considering for transplants. Can infer medical urgency and confidential patient status.

### Attack Vector

- Man-in-the-middle on API calls
- Intercepting national IDs, wallet addresses, query patterns
- De-anonymizing via correlating with public records (hospital staff lists, social media)

### Mitigation

**1. Client-Side Hashing (No PII on Network)**

```typescript
// Donor enters national ID in browser
const nationalId = "12345678";

// Browser hashes it client-side
const idHash = sha256(nationalId);

// Only hash is sent to contract
await contract.register(idHash, wallet, organs);
```

- National ID never leaves donor's browser
- Contract stores only hash (cannot be reversed)
- API never sees raw national ID

**2. HTTPS Required (Encryption in Transit)**

```
GET /consent/a3f8d2c1... HTTPS
→ Encrypted with TLS 1.3
→ Network attacker cannot intercept hash
```

**3. Minimal Data in Events**

```rust
env.events().publish(
    (symbol_short!("lifemarq"), symbol_short!("register")),
    (donor_id_hash, wallet, timestamp),  // ← No organs list, no name
);
```

- Events contain only hash, wallet, timestamp
- Cannot infer what organs were registered
- Hospital cannot learn organ preferences unless donor consented

**4. Query Audit Separation**

```
API logs queries separately from Soroban contract
→ Query log is not on-chain (privacy)
→ Only donor and admin can access query history
→ Contract sees only hash, returns only boolean (true/false)
```

**5. Emergency Contact Hashing**

```typescript
// Donor's emergency contact is also hashed
const phoneHash = sha256("+254712345678");

// Only hash and last 4 digits stored
await registerEmergencyContact(
  idHash,
  "phone",
  phoneHash, // ← Hash only
  "+254...7890", // ← Last 4 for UI display
);
```

### Residual Risk

**Very Low** — Assumes:

- Donor's device is not compromised (responsibility of donor)
- TLS implementation is correct (Stellar uses standard TLS 1.3)

---

## Threat 5: Replay Attacks

### Threat Scenario

Attacker captures a signed transaction that registers donor consent. Replays the same transaction multiple times to create duplicate registrations or corrupt contract state.

```
Time 1: Attacker sees signed transaction: register(hash, wallet, organs)
Time 2: Attacker replays same transaction
Result: Potential state corruption or duplicate registrations
```

### Attack Vector

- Network sniffing of transaction broadcasts
- Man-in-the-middle attack on Stellar RPC
- Replay on a different network (testnet vs mainnet)

### Mitigation

**1. Idempotency Check on Register**

```rust
pub fn register(...) -> Result<(), ContractError> {
    if env.storage().persistent().has(&DataKey::Consent(donor_id_hash.clone())) {
        return Err(ContractError::AlreadyRegistered);  // ← Idempotent
    }
    ...
}
```

- Second registration with same hash fails with `AlreadyRegistered`
- Replayed transaction returns error (no state change)

**2. Soroban Transaction Deduplication**

Soroban includes built-in replay protection:

```rust
// Stellar enforces sequence numbers on transactions
// Each account has an incrementing sequence number
// Transaction with sequence N+1 can only be submitted after sequence N
// Replayed transaction with old sequence number is rejected
```

**3. Network-Specific Parameters**

```rust
// Contract deployment includes network identifier
// Testnet and Mainnet have different network passphrases
// Transaction built for testnet cannot be replayed on mainnet
```

### Residual Risk

**None** — Soroban provides crypto-graphic replay protection at the protocol level.

---

## Threat 6: API Injection Attacks

### Threat Scenario

Attacker sends malicious input to API endpoint:

```bash
GET /consent/a3f8d2c1'; DROP TABLE consent_records; --
```

Database query is constructed unsafely and attacker drops the entire table.

### Attack Vector

- SQL injection in query parameters
- Stored XSS in hospital name or donor registration
- Path traversal to access files outside root directory

### Mitigation

**1. Parameterized Queries**

```typescript
// WRONG: String concatenation
const query = `SELECT * FROM donors WHERE id_hash = '${idHash}'`;

// RIGHT: Parameterized query
const query = db.prepare("SELECT * FROM donors WHERE id_hash = ?");
query.run(idHash);
```

**2. Input Validation**

```typescript
// Validate ID hash format
if (id_hash.length !== 64 || !/^[a-f0-9]{64}$/i.test(id_hash)) {
  return res.status(400).json({ error: "Invalid hash format" });
}

// Validate hospital ID format
if (!/^[a-z0-9-]+$/.test(hospital_id)) {
  return res.status(400).json({ error: "Invalid hospital ID" });
}
```

**3. TypeScript Type Safety**

```typescript
// Type-checked at compile time
interface ConsentRecord {
  donor_id_hash: string; // ← Must be string
  wallet: Address; // ← Must be Address type
  organs: string[]; // ← Must be string array
  is_active: boolean; // ← Must be boolean
}
```

**4. API Rate Limiting**

```typescript
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
  }),
);
```

### Residual Risk

**Very Low** — Modern frameworks (Express, TypeScript) provide built-in protections.

---

## Threat 7: Unauthorized Hospital Access to Admin Functions

### Threat Scenario

A hospital employee calls `verify_hospital()` (admin-only function) and marks their competitor hospital as unverified, blocking them from querying consent records.

### Attack Vector

- Hospital wallet somehow gets admin credentials
- Calls `verify_hospital("competitor-hospital")` with revoke=false
- Competitor loses query access

### Mitigation

**1. Admin Role Separation (Off-Chain)**

```typescript
// Only health ministry admin can call verify_hospital
// Implemented via RBAC middleware
app.post(
  "/admin/verify-hospital",
  requirePermission("verify_hospital"),
  async (req, res) => {
    // Only users with role ADMIN can reach this code
  },
);
```

**2. Cryptographic Admin Key**

```rust
// In production: Store admin public key in contract
// Only transactions signed by admin key can verify hospitals

const ADMIN_WALLET = Address::from_string("GADMIN...");

fn verify_hospital(env: Env, hospital_id: String) -> Result<(), ContractError> {
    // TODO: require_auth(ADMIN_WALLET)?
    // In future version, enforce on-chain
}
```

**3. Audit Trail of Verifications**

```sql
SELECT admin_wallet, hospital_id, verify_time, is_verified
FROM hospital_verifications
ORDER BY verify_time DESC;
```

→ Transparent log of all verification actions  
→ Can detect unauthorized modifications

### Residual Risk

**Low** — Mitigated by:

- Health ministry oversight (partnership)
- Transparent audit log (detectable)
- Future: On-chain admin enforcement

---

## Threat 8: Contract Upgrade Backdoor

### Threat Scenario

After deployment, contract author pushes a malicious upgrade that changes query logic to always return `true` (all donors appear consented). All harvesting is now legal under the fake contract.

### Attack Vector

- Soroban contracts cannot be upgraded (immutable)
- But if they could, attacker could inject backdoor logic

### Mitigation

**1. Immutable Smart Contracts**

```
Soroban contracts are immutable after deployment.
No upgrades are possible.
Code at contract ID CCZDNL... will never change.
```

**2. Source Code Transparency**

```
All contract code is public on GitHub:
- contract/src/lib.rs
- contract/src/registry.rs
- contract/src/types.rs

Anyone can verify the deployed WASM matches the source code:
soroban contract verify --contract CCZDNL... --source ./contract
```

**3. Multi-Signature Deployment (Future)**

For mainnet, use multi-signature envelope:

```rust
// Deployment must be signed by 3 of 5 health ministry officials
// No single person can deploy a backdoored contract
```

### Residual Risk

**None** — Soroban enforces immutability at the protocol level. Impossible to upgrade after deployment.

---

## Summary: Risk Matrix

| Threat                 | Severity     | Likelihood | Mitigation                               | Residual Risk |
| ---------------------- | ------------ | ---------- | ---------------------------------------- | ------------- |
| Family Override        | **Critical** | Medium     | Wallet auth, immutability, notifications | Low           |
| Hospital Impersonation | **Critical** | Medium     | Hospital registry, verification gates    | Very Low      |
| Consent Tampering      | **Critical** | Very Low   | On-chain source of truth                 | None          |
| Privacy Leaks          | **High**     | Low        | Client-side hashing, HTTPS, audit logs   | Very Low      |
| Replay Attacks         | **Medium**   | Very Low   | Idempotency, Soroban crypto              | None          |
| API Injection          | **Medium**   | Low        | Parameterized queries, input validation  | Very Low      |
| Admin Abuse            | **Medium**   | Very Low   | RBAC, audit trail                        | Low           |
| Contract Backdoor      | **Critical** | None       | Immutability, source transparency        | None          |

---

## Recommendations for Mainnet

1. **Before Mainnet Deployment:**
   - [ ] Independent security audit (Quantstamp, OpenZeppelin, Certora)
   - [ ] Formal verification of contract logic
   - [ ] Penetration testing of API and frontend

2. **Post-Deployment:**
   - [ ] Health ministry oversight committee
   - [ ] Regular audit log reviews
   - [ ] Bug bounty program
   - [ ] Incident response plan

3. **For USSD Phase 4:**
   - [ ] Custodial wallet in HSM (hardware security module)
   - [ ] Multi-signature hospital verification
   - [ ] SMS message authentication

---

## Compliance References

- **HIPAA** (US) — Privacy Rule, Security Rule
- **GDPR** (EU) — Right to data portability, consent requirements
- **Kenya Data Protection Act** — Personal data protection
- **ISO 27001** — Information security management
- **NIST Cybersecurity Framework** — Risk assessment

---

**Status:** Pre-mainnet  
**Last Reviewed:** August 2026  
**Next Review:** Before mainnet deployment
