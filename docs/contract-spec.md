# Lifemarq Smart Contract Specification

## Overview

The Lifemarq smart contract is a Soroban contract written in Rust that manages organ donor consent records on the Stellar blockchain.

## Data Structures

### ConsentRecord

```rust
pub struct ConsentRecord {
    pub donor_id_hash: Vec<u8>,      // SHA-256 hash of national ID
    pub wallet: Address,              // Donor's Stellar wallet
    pub organs: Vec<String>,          // List of organs (e.g., ["Heart", "Kidney"])
    pub timestamp: u64,               // Unix timestamp of registration
    pub active: bool,                 // Consent status (true = active, false = revoked)
}
```

## Contract Methods

### 1. register()

Registers a new donor consent record on-chain.

**Signature:**

```rust
pub fn register(
    env: Env,
    donor_id_hash: Vec<u8>,
    wallet: Address,
    organs: Vec<String>,
) -> ConsentRecord
```

**Parameters:**

- `donor_id_hash`: SHA-256 hash of donor's national ID (32 bytes)
- `wallet`: Donor's Stellar wallet address
- `organs`: List of organs to donate (e.g., ["Heart", "Kidney", "Liver"])

**Returns:**

- `ConsentRecord`: The newly created consent record

**Requirements:**

- Caller must be the wallet owner (requires signature)
- `donor_id_hash` must be 32 bytes (SHA-256)
- `organs` list must not be empty
- `donor_id_hash` must be unique (no duplicate registrations)

**Events:**

- Emits `DonorRegistered` event with donor_id_hash, wallet, timestamp

**Example:**

```javascript
const idHash = sha256("KE123456789"); // 32-byte hash
const organs = ["Heart", "Kidney"];
const record = await contract.register(idHash, wallet, organs);
```

### 2. revoke()

Revokes a donor's consent. Only the original signer can call this.

**Signature:**

```rust
pub fn revoke(
    env: Env,
    donor_id_hash: Vec<u8>,
    wallet: Address,
) -> ConsentRecord
```

**Parameters:**

- `donor_id_hash`: SHA-256 hash of donor's national ID
- `wallet`: Donor's Stellar wallet address

**Returns:**

- `ConsentRecord`: The updated consent record (active = false)

**Requirements:**

- Caller must be the wallet owner (requires signature)
- Consent record must exist
- Caller must be the original signer (verified on-chain)

**Events:**

- Emits `ConsentRevoked` event with donor_id_hash, wallet, timestamp

**Example:**

```javascript
const idHash = sha256("KE123456789");
const record = await contract.revoke(idHash, wallet);
// record.active === false
```

### 3. query()

Queries a donor's consent status (read-only, no authentication required).

**Signature:**

```rust
pub fn query(
    env: Env,
    donor_id_hash: Vec<u8>,
) -> bool
```

**Parameters:**

- `donor_id_hash`: SHA-256 hash of donor's national ID

**Returns:**

- `bool`: true if consent is active, false otherwise

**Requirements:**

- No authentication required (public read)
- Returns false if record doesn't exist

**Events:**

- Emits `ConsentQueried` event with donor_id_hash, timestamp (for audit trail)

**Example:**

```javascript
const idHash = sha256("KE123456789");
const isActive = await contract.query(idHash);
// isActive === true or false
```

### 4. get_record()

Retrieves the full consent record for a donor (read-only).

**Signature:**

```rust
pub fn get_record(
    env: Env,
    donor_id_hash: Vec<u8>,
) -> Option<ConsentRecord>
```

**Parameters:**

- `donor_id_hash`: SHA-256 hash of donor's national ID

**Returns:**

- `Option<ConsentRecord>`: Full record if found, None otherwise

**Requirements:**

- No authentication required (public read)

**Example:**

```javascript
const idHash = sha256("KE123456789");
const record = await contract.get_record(idHash);
if (record) {
  console.log("Organs:", record.organs);
  console.log("Registered:", new Date(record.timestamp * 1000));
}
```

## Events

### DonorRegistered

Emitted when a donor registers consent.

```
Event: ("lifemarq", "registered")
Data: (donor_id_hash, wallet, timestamp)
```

### ConsentRevoked

Emitted when a donor revokes consent.

```
Event: ("lifemarq", "revoked")
Data: (donor_id_hash, wallet, timestamp)
```

### ConsentQueried

Emitted when consent is queried (for audit trail).

```
Event: ("lifemarq", "queried")
Data: (donor_id_hash, timestamp)
```

## Storage

The contract uses persistent storage to maintain a map of consent records:

```
Key: "consent"
Value: Map<Vec<u8>, ConsentRecord>
  - Key: donor_id_hash (SHA-256 hash)
  - Value: ConsentRecord struct
```

## Access Control

| Method       | Auth Required | Caller               |
| ------------ | ------------- | -------------------- |
| register()   | Yes           | Donor wallet         |
| revoke()     | Yes           | Original signer only |
| query()      | No            | Anyone               |
| get_record() | No            | Anyone               |

## Error Handling

| Error                                 | Condition                                |
| ------------------------------------- | ---------------------------------------- |
| "Consent record not found"            | Attempting to revoke non-existent record |
| "Only the original signer can revoke" | Caller is not the original signer        |
| "Invalid donor_id_hash"               | Hash is not 32 bytes                     |
| "Organs list cannot be empty"         | No organs specified                      |

## Gas Considerations

- **register()**: ~5,000 stroops (write operation)
- **revoke()**: ~3,000 stroops (write operation)
- **query()**: ~1,000 stroops (read operation)
- **get_record()**: ~1,000 stroops (read operation)

## Deployment

### Testnet

```bash
soroban contract deploy \
  --network testnet \
  --source <account> \
  target/wasm32-unknown-unknown/release/lifemarq_contract.wasm
```

### Mainnet

```bash
soroban contract deploy \
  --network public \
  --source <account> \
  target/wasm32-unknown-unknown/release/lifemarq_contract.wasm
```

## Testing

Run contract tests:

```bash
cargo test
```

## Security Audit Checklist

- [ ] Immutability of consent records verified
- [ ] Access control enforced (only donor can revoke)
- [ ] No PII stored on-chain
- [ ] Event logging complete
- [ ] Gas costs acceptable
- [ ] Error handling comprehensive
- [ ] Contract state consistency verified
