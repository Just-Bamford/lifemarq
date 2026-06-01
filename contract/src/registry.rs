use soroban_sdk::{Address, Env, String, Vec, symbol_short};
use crate::types::{ConsentRecord, DataKey, ContractError};

/// Core registry logic for Lifemarq
pub struct Registry;

impl Registry {
    /// Register a new donor consent record
    pub fn register(
        env: &Env,
        donor_id_hash: String,
        wallet: Address,
        organs: Vec<String>,
    ) -> Result<(), ContractError> {
        // Require wallet signature
        wallet.require_auth();

        // Check if record already exists
        if env
            .storage()
            .persistent()
            .has(&DataKey::Consent(donor_id_hash.clone()))
        {
            return Err(ContractError::AlreadyRegistered);
        }

        // Create new consent record
        let record = ConsentRecord {
            donor_id_hash: donor_id_hash.clone(),
            wallet: wallet.clone(),
            organs,
            registered_at: env.ledger().timestamp(),
            is_active: true,
        };

        // Store in persistent storage
        env.storage()
            .persistent()
            .set(&DataKey::Consent(donor_id_hash.clone()), &record);

        // Emit event
        env.events().publish(
            (symbol_short!("lifemarq"), symbol_short!("register")),
            (donor_id_hash, wallet, env.ledger().timestamp()),
        );

        Ok(())
    }

    /// Revoke a donor's consent (only the original signer can call this)
    pub fn revoke(
        env: &Env,
        donor_id_hash: String,
        wallet: Address,
    ) -> Result<(), ContractError> {
        // Require wallet signature
        wallet.require_auth();

        // Fetch the record
        let record = env
            .storage()
            .persistent()
            .get::<_, ConsentRecord>(&DataKey::Consent(donor_id_hash.clone()))
            .ok_or(ContractError::NotFound)?;

        // Check if already revoked
        if !record.is_active {
            return Err(ContractError::AlreadyRevoked);
        }

        // Verify caller is the original signer
        if record.wallet != wallet {
            return Err(ContractError::Unauthorized);
        }

        // Update record: set is_active to false
        let mut updated_record = record;
        updated_record.is_active = false;

        // Write back to storage
        env.storage()
            .persistent()
            .set(&DataKey::Consent(donor_id_hash.clone()), &updated_record);

        // Emit event
        env.events().publish(
            (symbol_short!("lifemarq"), symbol_short!("revoke")),
            (donor_id_hash, wallet, env.ledger().timestamp()),
        );

        Ok(())
    }

    /// Query a donor's consent status (read-only, no auth required)
    pub fn query(env: &Env, donor_id_hash: String) -> bool {
        match env
            .storage()
            .persistent()
            .get::<_, ConsentRecord>(&DataKey::Consent(donor_id_hash.clone()))
        {
            Some(record) => record.is_active,
            None => false,
        }
    }

    /// Get full consent record (read-only, no auth required)
    pub fn get_record(env: &Env, donor_id_hash: String) -> Option<ConsentRecord> {
        env.storage()
            .persistent()
            .get::<_, ConsentRecord>(&DataKey::Consent(donor_id_hash))
    }
}
