use soroban_sdk::{contracttype, Address, String, Vec};

/// Represents a donor's consent record on-chain
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
    /// SHA-256 hex string of national ID (donor identity, hashed for privacy)
    pub donor_id_hash: String,
    /// Wallet address of the donor — only this wallet can revoke consent
    pub wallet: Address,
    /// List of organs the donor consents to donate (e.g., ["kidney", "liver"])
    pub organs: Vec<String>,
    /// Timestamp of registration (Unix seconds, immutable after registration)
    pub registered_at: u64,
    /// Whether the consent is currently active
    /// true: consent is valid and active
    /// false: consent has been revoked (final state, cannot be re-activated)
    pub is_active: bool,
}

/// Storage key for consent records
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Keyed by donor_id_hash (SHA-256 hex string)
    Consent(String),
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
#[contracterror]
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
