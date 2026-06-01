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

## Events

- **DonorRegistered**: Emitted when a donor registers
- **ConsentRevoked**: Emitted when consent is revoked
- **ConsentQueried**: Emitted when consent is queried (audit trail)

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
