#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Env, Vec, Map, Symbol, symbol_short};

mod types;
mod registry;

use types::{ConsentRecord, LifemarqEvent};
use registry::Registry;

const CONSENT_KEY: &str = "consent";

#[contract]
pub struct LifemarqContract;

#[contractimpl]
impl LifemarqContract {
    /// Register a donor's consent on-chain
    pub fn register(
        env: Env,
        donor_id_hash: Vec<u8>,
        wallet: Address,
        organs: Vec<String>,
    ) -> ConsentRecord {
        wallet.require_auth();

        let record = Registry::register(&env, donor_id_hash.clone(), wallet.clone(), organs);

        // Store in contract state
        let mut records: Map<Vec<u8>, ConsentRecord> = env
            .storage()
            .persistent()
            .get(&Symbol::new(&env, CONSENT_KEY))
            .unwrap_or_else(|| Map::new(&env));

        records.set(donor_id_hash.clone(), record.clone());
        env.storage()
            .persistent()
            .set(&Symbol::new(&env, CONSENT_KEY), &records);

        // Emit event
        env.events().publish(
            (Symbol::new(&env, "lifemarq"), Symbol::new(&env, "registered")),
            (donor_id_hash, wallet, env.ledger().timestamp()),
        );

        record
    }

    /// Revoke a donor's consent (only the original signer can call this)
    pub fn revoke(env: Env, donor_id_hash: Vec<u8>, wallet: Address) -> ConsentRecord {
        wallet.require_auth();

        let mut records: Map<Vec<u8>, ConsentRecord> = env
            .storage()
            .persistent()
            .get(&Symbol::new(&env, CONSENT_KEY))
            .unwrap_or_else(|| Map::new(&env));

        let mut record = records
            .get(donor_id_hash.clone())
            .expect("Consent record not found");

        // Verify the caller is the original signer
        assert_eq!(record.wallet, wallet, "Only the original signer can revoke");

        record = Registry::revoke(&env, donor_id_hash.clone(), wallet.clone(), record);

        records.set(donor_id_hash.clone(), record.clone());
        env.storage()
            .persistent()
            .set(&Symbol::new(&env, CONSENT_KEY), &records);

        // Emit event
        env.events().publish(
            (Symbol::new(&env, "lifemarq"), Symbol::new(&env, "revoked")),
            (donor_id_hash, wallet, env.ledger().timestamp()),
        );

        record
    }

    /// Query a donor's consent status (read-only, no auth required)
    pub fn query(env: Env, donor_id_hash: Vec<u8>) -> bool {
        let records: Map<Vec<u8>, ConsentRecord> = env
            .storage()
            .persistent()
            .get(&Symbol::new(&env, CONSENT_KEY))
            .unwrap_or_else(|| Map::new(&env));

        if let Some(record) = records.get(donor_id_hash.clone()) {
            // Emit query event for audit trail
            env.events().publish(
                (Symbol::new(&env, "lifemarq"), Symbol::new(&env, "queried")),
                (donor_id_hash, env.ledger().timestamp()),
            );

            Registry::query(&record)
        } else {
            false
        }
    }

    /// Get full consent record (for authorized queries)
    pub fn get_record(env: Env, donor_id_hash: Vec<u8>) -> Option<ConsentRecord> {
        let records: Map<Vec<u8>, ConsentRecord> = env
            .storage()
            .persistent()
            .get(&Symbol::new(&env, CONSENT_KEY))
            .unwrap_or_else(|| Map::new(&env));

        records.get(donor_id_hash)
    }
}
