# Lifemarq Smart Contract

Soroban smart contract for the Lifemarq organ donor registry.

## Contract Methods

### `register(donor_id_hash, wallet, organs)`

Registers a new donor consent record on-chain.

- **donor_id_hash**: SHA-256 hash of national ID (Vec<u8>)
- **wallet**: Donor's Stellar wallet address (Address)
- **organs**: List of organs to donate (Vec<String>)
- **Returns**: ConsentRecord
- **Auth**: Requires donor wallet signature

### `revoke(donor_id_hash, wallet)`

Revokes a donor's consent. Only the original signer can call this.

- **donor_id_hash**: SHA-256 hash of national ID (Vec<u8>)
- **wallet**: Donor's Stellar wallet address (Address)
- **Returns**: Updated ConsentRecord (active = false)
- **Auth**: Requires donor wallet signature

### `query(donor_id_hash)`

Queries a donor's consent status (read-only).

- **donor_id_hash**: SHA-256 hash of national ID (Vec<u8>)
- **Returns**: Boolean (true if active, false otherwise)
- **Auth**: None required (public read)

### `get_record(donor_id_hash)`

Retrieves the full consent record for a donor.

- **donor_id_hash**: SHA-256 hash of national ID (Vec<u8>)
- **Returns**: Option<ConsentRecord>
- **Auth**: None required (public read)

### `register_minor(minor_id_hash, parent_wallet, guardian_wallet, organs, initiator)` ⭐ NEW

Registers a minor's consent requiring multi-sig approval from both parent and guardian.

This addresses a critical legal requirement in many jurisdictions: minors cannot independently consent to medical procedures. Both a parent and a guardian must approve before the record becomes active.

- **minor_id_hash**: SHA-256 hash of minor's national ID (String, 64 chars hex)
- **parent_wallet**: Parent's Stellar wallet address (Address)
- **guardian_wallet**: Guardian's Stellar wallet address (Address) — must be different from parent
- **organs**: List of organs the minor consents to donate (Vec<String>)
- **initiator**: Healthcare provider wallet initiating registration (Address)
- **Returns**: Ok(()) on success, Err on validation failure
- **Auth**: Requires initiator wallet signature
- **State**: Creates PENDING_APPROVAL record awaiting signatures

**Example Flow:**

1. Healthcare provider (hospital) calls `register_minor()` with parent and guardian wallets
2. Record enters PENDING_APPROVAL state
3. Parent calls `approve_minor_consent()` → record now shows parent_approved=true
4. Guardian calls `approve_minor_consent()` → record automatically finalizes to ACTIVE consent
5. Consent is now queryable via standard `query()` endpoint

**Security Model:**

- Both parent and guardian must sign separately (multi-sig pattern)
- Parent and guardian wallets must be different (prevents collusion)
- Record cannot become active until both have approved
- Once active, the consent record works like any other (can be revoked by parent)

### `approve_minor_consent(minor_id_hash)` ⭐ NEW

Called by either parent or guardian to approve a pending minor consent.

Once both parent and guardian have called this function, the pending record automatically finalizes to an active consent record.

- **minor_id_hash**: SHA-256 hash of minor's national ID (String, 64 chars hex)
- **Returns**: Ok(()) on success, Err on validation failure
- **Auth**: Caller must be either parent or guardian; wallet signature required
- **Side Effect**: If both have approved, finalization is automatic (no additional call needed)

**Events Emitted:**

- `lifemarq.minor_prtl`: When one signature collected (partial approval)
- `lifemarq.minor_fin`: When both signatures collected and consent becomes ACTIVE

### `get_pending_minor_consent(minor_id_hash)` ⭐ NEW

Retrieves the pending minor consent record to check approval progress.

- **minor_id_hash**: SHA-256 hash of minor's national ID (String, 64 chars hex)
- **Returns**: Option<MinorConsentPending>
- **Auth**: None required (public read)

Returns None if no pending record exists or if it has already been finalized.

**Response Structure (when Some):**

```rust
{
    minor_id_hash: String,
    parent_wallet: Address,
    guardian_wallet: Address,
    organs: Vec<String>,
    parent_approved: bool,           // true if parent has signed
    guardian_approved: bool,         // true if guardian has signed
    registered_at: u64,              // Original registration timestamp
}
```

Use this to monitor multi-sig approval progress.

## Data Structures

### ConsentRecord

```rust
pub struct ConsentRecord {
    pub donor_id_hash: Vec<u8>,      // Hashed national ID
    pub wallet: Address,              // Donor's wallet
    pub organs: Vec<String>,          // List of organs
    pub timestamp: u64,               // Registration time (Unix seconds)
    pub active: bool,                 // Consent status
}
```

### MinorConsentPending ⭐ NEW

```rust
pub struct MinorConsentPending {
    pub minor_id_hash: String,        // Hashed minor's national ID
    pub parent_wallet: Address,       // Parent's wallet (one of two signers)
    pub guardian_wallet: Address,     // Guardian's wallet (one of two signers)
    pub organs: Vec<String>,          // Organs the minor consents to donate
    pub parent_approved: bool,        // Whether parent has signed
    pub guardian_approved: bool,      // Whether guardian has signed
    pub registered_at: u64,           // Registration timestamp
}
```

Used to track multi-sig approval state. Once both approval flags are true, the record auto-finalizes to a ConsentRecord.

## Events

- **DonorRegistered**: Emitted when a donor registers
- **ConsentRevoked**: Emitted when consent is revoked
- **ConsentQueried**: Emitted when consent is queried (audit trail)
- **lifemarq.minor_reg**: Emitted when a minor consent is registered (pending approval)
- **lifemarq.minor_prtl**: Emitted when one parent/guardian approves (partial)
- **lifemarq.minor_fin**: Emitted when both approve and consent is finalized

## Build & Deploy

### Build WASM

```bash
cargo build --target wasm32-unknown-unknown --release
```

### Deploy to Testnet

```bash
soroban contract deploy \
  --network testnet \
  --source <your-account> \
  target/wasm32-unknown-unknown/release/lifemarq_contract.wasm
```

### Deploy to Mainnet

```bash
soroban contract deploy \
  --network public \
  --source <your-account> \
  target/wasm32-unknown-unknown/release/lifemarq_contract.wasm
```

## Testing

```bash
cargo test
```

## Security Considerations

1. **Immutability**: Once registered, consent can only be revoked by the original signer
2. **Privacy**: Donor identity is hashed; no PII stored on-chain
3. **Auth**: All write operations require wallet signature
4. **Audit Trail**: All queries are logged as events
5. **Minor Consent**: Both parent and guardian must sign separately (multi-sig protection)
6. **Parent/Guardian Separation**: Prevents single-wallet collusion attacks

## Legal Context

The minor consent feature implements a production-grade legal requirement: minors in many jurisdictions cannot independently consent to organ donation. This requires explicit approval from both a parent and a guardian — a requirement that no comparable blockchain-based health registry project has implemented.

The multi-sig approach ensures:

- **Legal Compliance**: Meets family law requirements across African jurisdictions
- **Audit Trail**: Both signatures are on-chain and immutable
- **Transparency**: All parties can verify consent state at any time
- **Non-Repudiation**: Signatures cannot be denied after execution
