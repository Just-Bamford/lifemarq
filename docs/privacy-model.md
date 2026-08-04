# Privacy Model: What Data Lives Where

**Principle:** No personally identifiable information (PII) ever touches the blockchain or API logs.

---

## Data Classification

### ON-CHAIN (Public, Immutable, Forever)

```
ConsentRecord {
  donor_id_hash: String,        // SHA-256(national_id) - 64 hex chars, irreversible
  wallet: Address,               // Stellar wallet address
  organs: Vec<String>,          // ["kidney", "liver"] - organ type only
  registered_at: u64,           // Unix timestamp
  is_active: bool               // true/false
}
```

**What an attacker who reads Stellar ledger learns:**

- ✅ Someone registered consent for kidneys
- ❌ NOT who that person is (hash is irreversible)
- ❌ NOT their national ID (hashed)
- ❌ NOT their name, age, blood type, address

**Rationale:** Public ledger is immutable and transparent. Only non-reversible hashes stored.

---

### OFF-CHAIN (API Database, Access Controlled)

#### Query Audit Log

```sql
SELECT donor_id_hash, hospital_id, query_time, consent_status, result
FROM queries
WHERE created_at > NOW() - INTERVAL '90 days';
```

**Access:** Only donor (with wallet signature) + health ministry admin  
**Why separate:** Query patterns are sensitive (tells which hospitals queried which patients)  
**Retention:** 90 days standard, 7 years for compliance audit trail

#### Emergency Contact Registry

```
contact_hash: SHA-256(phone_number)
contact_type: "phone" | "email"
contact_last4: "+254...7890"     // Last 4 chars for UI only
is_verified: bool
notifications_enabled: bool
```

**Access:** Only donor (wallet signature required)  
**Why hashed:** Emergency contact info is PII. Never stored in plaintext.  
**Two-factor:** SMS/email verification code required before enabling notifications

#### Hospital Registry

```
hospital_id: String              // "hospital-001"
name: String                      // "Kenyatta National Hospital"
country: String                   // "KE" (ISO 3166)
license_number: String           // Health ministry license (for off-chain verification)
is_verified: bool                // Admin-set after verification
wallet: Address                  // Hospital's signing wallet
```

**Access:** Public read (`is_hospital_verified()` callable by anyone)  
**Why:** Transparency - any donor can verify hospital is legitimate  
**Admin-controlled:** Only health ministry can call `verify_hospital()`

#### Analytics Aggregates

```
total_registrations: u32
total_revocations: u32
active_consents: u32
recipients_waiting_by_organ: Map<String, u32>
```

**Access:** Public (no PII, only counts)  
**Why:** Ministry dashboard needs real numbers, not individual records

---

### NEVER STORED

```
❌ National ID (raw) - only hash
❌ Name - not stored anywhere
❌ Age / Date of birth - not stored
❌ Blood type - not stored (only by recipient's choice)
❌ Address - not stored
❌ Phone number (raw) - only hash + last 4 chars
❌ Email (raw) - only hash + last 4 chars
❌ Hospital ID of donor's regular hospital - not stored
❌ Medical history - not stored
```

---

## Hashing Scheme

### SHA-256 Client-Side

**Process:**

```typescript
// Browser
const nationalId = "12345678";
const idHash = sha256(nationalId); // Always in browser, never sent raw

// Send only hash to contract
await contract.register(idHash, wallet, organs);
```

**Why client-side:**

- API never sees raw national ID
- Network attacker cannot intercept ID
- Same hash for same ID (deterministic) - enables duplicate detection

**Hash format:** 64-character hex string (SHA-256 output)

```
Example: a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7
```

**Irreversibility:** SHA-256 is one-way cryptographic hash

- Given hash: cannot recover original national ID
- 2^256 possible hash outputs, but only 1 matches any input
- Brute-force attack requires trying billions of combinations (infeasible)

---

## What Each Actor Can See

### Donor

- ✅ Own consent record (organs, registration date)
- ✅ Query history (who queried, when)
- ✅ Emergency contact list (with last 4 only)
- ✅ Whether they're verified as donor
- ❌ Cannot see: other donors' records
- ❌ Cannot see: hospital identities (only hospital_id)

### Hospital (Verified)

- ✅ Query a donor by hash: returns `true/false` + organs
- ✅ Get hospital verification status: `is_hospital_verified(hospital_id)`
- ❌ Cannot see: donor's name, ID, age
- ❌ Cannot see: other hospitals' queries
- ❌ Cannot see: emergency contact info
- ❌ Cannot learn: what queries other hospitals made

### Health Ministry Admin

- ✅ List all hospitals + verification status
- ✅ Verify hospitals (`verify_hospital()`)
- ✅ View all query audit logs (for compliance)
- ✅ View event stats (registrations, revocations, recipients)
- ❌ Cannot see: donor names or personal details
- ❌ Cannot see: emergency contact details
- ❌ Cannot modify: registered consents or revocations

### Network Observer (Attacker)

- ✅ Can see: on-chain events (hashes, wallets, timestamps)
- ✅ Can see: Stellar.Expert transaction details
- ❌ Cannot see: query audit logs (off-chain)
- ❌ Cannot see: emergency contact info
- ❌ Cannot reverse: SHA-256 hashes to original IDs
- ❌ Cannot impersonate: hospital (wallet auth required)

---

## API Encryption

All API calls use HTTPS (TLS 1.3):

```
GET /consent/a3f8d2c1... HTTP/1.1
↓ Encrypted with TLS
→ Unreadable to network observer
```

Query example (encrypted in transit):

```
POST /emergency-contact/a3f8d2c1.../register
{
  "contactType": "phone",
  "contactHash": "b4f9e3d2...",    // Hash, not plaintext phone
  "contactLast4": "+254...7890"    // Only last 4 for display
}
```

---

## Audit Trail Retention

| Data Type                 | Retention                                | Reason                  |
| ------------------------- | ---------------------------------------- | ----------------------- |
| Query logs                | 90 days standard, 7 years for compliance | Hospital accountability |
| Event indexing            | Permanent (on Stellar ledger)            | Immutable audit trail   |
| Emergency contact changes | 30 days                                  | Security audit          |
| Hospital verifications    | Permanent (on-chain)                     | Regulatory audit        |
| API error logs            | 30 days                                  | Debugging + security    |

**Deletion:** After retention expires, records are securely deleted (not archived unless required by law).

---

## GDPR Compliance (if deployed in EU)

**Right to be Forgotten:**

- Donor can request deletion of all records
- API deletes query logs and contact info
- On-chain record (SHA-256 hash) remains (immutable ledger)
- Donor can create new hash with new national ID if needed

**Data Portability:**

- Donor can export: full query history, event data, consent record
- Format: JSON or CSV
- Via: `GET /export/:id_hash` endpoint

**Consent:**

- All data collection is explicit (donor registers intentionally)
- No tracking, no profiling
- Hospital queries are single transactions (not ongoing surveillance)

---

## DRC/Kenya/Senegal Regulations

| Country     | Law                       | Compliance                                     |
| ----------- | ------------------------- | ---------------------------------------------- |
| **Kenya**   | Data Protection Act 2019  | ✅ SHA-256 hashing, access control, audit logs |
| **DRC**     | Health Privacy Law 13/022 | ✅ Minimal data collection, explicit consent   |
| **Senegal** | French health code (CNIL) | ✅ GDPR-aligned, encryption in transit         |

---

## Summary: Security by Design

**Layer 1 - Data Collection:** Only hash stored (irreversible)  
**Layer 2 - Storage:** Separate on-chain (public, non-PII) and off-chain (access-controlled, PII)  
**Layer 3 - Transmission:** HTTPS encryption (TLS 1.3)  
**Layer 4 - Access:** Role-based (donor, hospital, admin, public)  
**Layer 5 - Audit:** Complete query logs for compliance  
**Layer 6 - Retention:** Data deleted after retention period

**Result:** Donor privacy protected while maintaining transparency and regulatory compliance.
