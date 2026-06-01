use soroban_sdk::{contracttype, Address, Vec};

/// Represents a donor's consent record on-chain
#[derive(Clone)]
#[contracttype]
pub struct ConsentRecord {
    /// Hashed national ID (SHA-256)
    pub donor_id_hash: Vec<u8>,
    /// Wallet address of the donor
    pub wallet: Address,
    /// List of organs the donor consents to donate
    pub organs: Vec<String>,
    /// Timestamp of registration (Unix seconds)
    pub timestamp: u64,
    /// Whether the consent is currently active
    pub active: bool,
}

/// Enum for contract events
#[derive(Clone)]
#[contracttype]
pub enum LifemarqEvent {
    /// Emitted when a donor registers
    DonorRegistered {
        donor_id_hash: Vec<u8>,
        wallet: Address,
        timestamp: u64,
    },
    /// Emitted when a donor revokes consent
    ConsentRevoked {
        donor_id_hash: Vec<u8>,
        wallet: Address,
        timestamp: u64,
    },
    /// Emitted when a hospital queries consent
    ConsentQueried {
        donor_id_hash: Vec<u8>,
        timestamp: u64,
    },
}
