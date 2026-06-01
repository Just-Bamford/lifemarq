use soroban_sdk::{contracttype, Address, String, Vec};

/// Represents a donor's consent record on-chain
#[derive(Clone)]
#[contracttype]
pub struct ConsentRecord {
    /// SHA-256 hex string of national ID
    pub donor_id_hash: String,
    /// Wallet address of the donor — only this wallet can revoke
    pub wallet: Address,
    /// List of organs the donor consents to donate (e.g., ["kidney", "liver"])
    pub organs: Vec<String>,
    /// Timestamp of registration (Unix seconds)
    pub registered_at: u64,
    /// Whether the consent is currently active
    pub is_active: bool,
}

/// Storage key for consent records
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Keyed by donor_id_hash (SHA-256 hex string)
    Consent(String),
}

/// Contract error types
#[contracterror]
#[derive(Copy, Clone)]
pub enum ContractError {
    /// Donor already registered with this hash
    AlreadyRegistered = 1,
    /// Consent record not found
    NotFound = 2,
    /// Caller is not authorized (not the original signer)
    Unauthorized = 3,
    /// Consent already revoked
    AlreadyRevoked = 4,
}
