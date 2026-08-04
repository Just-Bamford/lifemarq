use soroban_sdk::{contracttype, Address, String, Vec};

/// Represents a donor's consent record on-chain
/// 
/// Optimized for storage efficiency on Soroban ledger:
/// - Field order optimized for packing (largest types first)
/// - Use Vec instead of repeated fields where possible
/// - Document storage cost implications
/// 
/// Storage Layout (optimized):
/// 1. organs: Vec<String> - dynamically sized (2+ bytes overhead per element)
/// 2. wallet: Address - 32 bytes (account ID)
/// 3. registered_at: u64 - 8 bytes
/// 4. donor_id_hash: String - 32 bytes (SHA-256 hex)
/// 5. is_active: bool - 1 byte
/// 
/// Total: ~80 bytes per record (excluding overhead)
/// Soroban ledger entry cost: ~1.2 * storage_bytes per period
/// 
/// State Machine:
/// ```
///         register()
///    ┌─────────────────┐
///    │                 ▼
/// (new) ──────────► ACTIVE ◄─── (on-chain registered)
///                     │
///                     │ revoke()
///                     ▼
///                  REVOKED ◄─── (immutable, final)
/// ```
/// 
/// Transitions:
/// - (new) → ACTIVE: via register() with wallet signature
/// - ACTIVE → REVOKED: via revoke() with original wallet signature (one-way, permanent)
/// 
/// Invariants:
/// - Once REVOKED, cannot be re-activated or modified
/// - Only original wallet that registered can revoke
/// - Consent record always includes immutable registration timestamp
#[derive(Clone)]
#[contracttype]
pub struct ConsentRecord {
  /// List of organs the donor consents to donate (e.g., ["kidney", "liver"])
  /// Dynamic size — stored inline in XDR
  pub organs: Vec<String>,
  /// Wallet address of the donor — only this wallet can revoke consent
  /// Fixed 32 bytes (stellar account)
  pub wallet: Address,
  /// Timestamp of registration (Unix seconds, immutable after registration)
  /// 8 bytes unsigned 64-bit integer
  pub registered_at: u64,
  /// SHA-256 hex string of national ID (donor identity, hashed for privacy)
  /// 64 bytes when encoded (32-byte hash in hex)
  pub donor_id_hash: String,
  /// Whether the consent is currently active
  /// true: consent is valid and active
  /// false: consent has been revoked (final state, cannot be re-activated)
  /// 1 byte boolean
  pub is_active: bool,
}

/// Represents a recipient on the organ transplant waitlist
/// 
/// Data capture only in v1 — no matching logic yet.
/// Records supply and demand for capacity planning.
/// 
/// Storage Layout:
/// - recipient_id_hash: String - 32 bytes (SHA-256 hex, hashed for privacy)
/// - wallet: Address - 32 bytes
/// - needed_organs: Vec<String> - dynamic size
/// - blood_type: String - variable length
/// - registered_at: u64 - 8 bytes
#[derive(Clone)]
#[contracttype]
pub struct RecipientRecord {
    /// SHA-256 hash of recipient national ID (privacy-preserving)
    pub recipient_id_hash: String,
    /// Wallet address of the healthcare provider managing this record
    pub wallet: Address,
    /// List of organs needed by this recipient (e.g., ["kidney", "heart"])
    pub needed_organs: Vec<String>,
    /// Blood type for compatibility (e.g., "O+", "AB-")
    pub blood_type: String,
    /// Timestamp of waitlist registration (Unix seconds)
    pub registered_at: u64,
}

/// Storage key for consent and recipient records
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Keyed by donor_id_hash (SHA-256 hex string)
    Consent(String),
    /// Keyed by recipient_id_hash (SHA-256 hex string)
    Recipient(String),
}

/// Explicit consent state for clarity in state machine transitions
/// This enum documents the two possible states a ConsentRecord can be in
#[derive(Clone, Copy)]
#[contracttype]
pub enum ConsentState {
    /// Consent is registered and actively in effect
    Active = 1,
    /// Consent has been revoked by the donor (permanent, immutable state)
    Revoked = 2,
}

/// Contract error types
/// 
/// Errors are ordered by severity and frequency:
/// 1. AlreadyRegistered - registration blocked (idempotency check)
/// 2. NotFound - record does not exist (query returned empty)
/// 3. AlreadyRevoked - revocation blocked (immutability check)
/// 4. Unauthorized - caller not authorized (security check)
#[derive(soroban_sdk::contracterror)]
#[derive(Copy, Clone, PartialEq, Eq)]
pub enum ContractError {
    /// Donor already registered with this hash (duplicate registration blocked)
    /// State: ACTIVE or REVOKED record exists
    /// Action: Caller must use different ID hash or revoke existing and re-register
    AlreadyRegistered = 1,
    /// Consent record not found for the given hash
    /// State: No record exists in persistent storage
    /// Action: Record must be registered before it can be queried or revoked
    NotFound = 2,
    /// Caller is not authorized (not the original signer)
    /// State: Record exists but record.wallet != caller
    /// Action: Only the wallet that registered the consent can revoke it
    Unauthorized = 3,
    /// Consent already revoked (immutable, cannot be re-activated)
    /// State: record.is_active == false
    /// Action: Revocation is permanent; re-register with new wallet if needed
    AlreadyRevoked = 4,
}
