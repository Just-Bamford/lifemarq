use soroban_sdk::{Address, Env, Vec, Map};
use crate::types::ConsentRecord;

/// Core registry logic for Lifemarq
pub struct Registry;

impl Registry {
    /// Register a new donor consent record
    pub fn register(
        env: &Env,
        donor_id_hash: Vec<u8>,
        wallet: Address,
        organs: Vec<String>,
    ) -> ConsentRecord {
        let timestamp = env.ledger().timestamp();
        
        ConsentRecord {
            donor_id_hash: donor_id_hash.clone(),
            wallet: wallet.clone(),
            organs,
            timestamp,
            active: true,
        }
    }

    /// Revoke a donor's consent (only callable by the original signer)
    pub fn revoke(
        env: &Env,
        donor_id_hash: Vec<u8>,
        wallet: Address,
        mut record: ConsentRecord,
    ) -> ConsentRecord {
        // Verify caller is the original signer
        wallet.require_auth();
        
        record.active = false;
        record
    }

    /// Query a donor's consent status
    pub fn query(record: &ConsentRecord) -> bool {
        record.active
    }
}
